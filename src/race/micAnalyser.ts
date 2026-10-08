import { foldChroma } from './chroma';

export const FFT_SIZE = 8192;
/** ~30 analysis frames per second; rAF runs at 60+, so frames are skipped. */
const FRAME_INTERVAL_MS = 1000 / 30;

export type MicErrorKind = 'denied' | 'unsupported' | 'unavailable';

export class MicError extends Error {
  constructor(public readonly kind: MicErrorKind, message: string) {
    super(message);
    this.name = 'MicError';
  }
}

export interface MicAnalyser {
  /** Start (or restart) emitting chroma frames on animation frames. */
  start(onFrame: (chroma: number[], nowMs: number) => void): void;
  /** Stop, release the mic, and close the audio context. */
  close(): Promise<void>;
}

/** Open the microphone for music analysis. Call from a click handler.
 *  `onEnded` fires if the mic goes away mid-use (unplugged, Bluetooth drop,
 *  permission revoked), so the UI can say so instead of "can't hear". */
export async function openMic(onEnded?: () => void): Promise<MicAnalyser> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
    throw new MicError('unsupported', 'getUserMedia/AudioContext unavailable (needs HTTPS and a modern browser)');
  }
  // Created before the first await so it is born inside the click's user
  // activation and starts running instead of suspended.
  const ctx = new AudioContext();
  let stream: MediaStream;
  try {
    // All three processors off: echo cancellation would subtract the music
    // coming out of our own speakers, noise suppression treats sustained
    // tones as noise, and AGC flattens the dynamics onsets depend on.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (err) {
    void ctx.close();
    const name = err instanceof DOMException ? err.name : '';
    const kind: MicErrorKind = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable';
    throw new MicError(kind, String(err));
  }
  if (ctx.state === 'suspended') await ctx.resume();
  let closing = false;
  for (const track of stream.getAudioTracks()) {
    track.addEventListener('ended', () => {
      if (!closing) onEnded?.();
    });
  }

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0;
  // Deliberately not connected to ctx.destination: playing the mic back
  // would feed the speakers into the mic.
  source.connect(analyser);
  const bins = new Float32Array(analyser.frequencyBinCount);

  let raf = 0;
  let lastEmit = -Infinity;

  return {
    start(onFrame) {
      cancelAnimationFrame(raf);
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        // 2 ms slack so a 60 Hz display doesn't alternate 33/50 ms frames.
        if (now - lastEmit < FRAME_INTERVAL_MS - 2) return;
        lastEmit = now;
        analyser.getFloatFrequencyData(bins);
        onFrame(foldChroma(bins, ctx.sampleRate, FFT_SIZE), now);
      };
      raf = requestAnimationFrame(loop);
    },
    async close() {
      closing = true;
      cancelAnimationFrame(raf);
      raf = 0;
      stream.getTracks().forEach((track) => track.stop());
      source.disconnect();
      if (ctx.state !== 'closed') await ctx.close();
    },
  };
}
