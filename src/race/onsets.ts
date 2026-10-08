/** Threshold = mean + ONSET_K · stddev of a class's recent flux. */
export const ONSET_K = 1.5;
/** Flux history length per class, in frames (~1 s at 30 fps). */
export const ONSET_WINDOW = 30;
/** Minimum gap between two onsets of the same class. One struck note
 *  wobbles for a few frames; this keeps it to one train step. */
export const ONSET_REFRACTORY_MS = 120;
/** The silence floor is this multiple of the room level measured during
 *  the countdown. Calibrated rather than fixed: mic sensitivity varies too
 *  much between devices for a single constant. */
export const SILENCE_FACTOR = 2;
/** Room level = this percentile of the countdown's frame loudness, not the
 *  mean: players chanting "3, 2, 1!" (or a song started early) would drag a
 *  mean up and gate out most of the race. */
export const CALIBRATION_PERCENTILE = 0.2;
/** Room frames required before a race may start (~1/3 s at 30 fps). */
export const MIN_CALIBRATION_FRAMES = 10;
/** A class's rise must be at least this fraction of the loudest class's
 *  energy in the same frame. Any attack lifts every bin a little (FFT
 *  leakage, broadband transients); without this floor every quiet class
 *  would "fire" in lockstep with the real note, since each class is
 *  otherwise judged only against its own near-silent history. */
export const ONSET_REL_MIN = 0.1;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function meanStd(xs: number[]): { mean: number; std: number } {
  if (xs.length === 0) return { mean: 0, std: 0 };
  const mean = sum(xs) / xs.length;
  const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length;
  return { mean, std: Math.sqrt(variance) };
}

/** Per-pitch-class onset detection: a class "fires" when its energy rises
 *  sharply relative to its own recent history — the audio stand-in for the
 *  reference installation's MIDI key press. */
export class OnsetDetector {
  private prev: number[] | null = null;
  private readonly history: number[][] = Array.from({ length: 12 }, () => []);
  private readonly lastOnsetMs: number[] = new Array<number>(12).fill(-Infinity);
  private readonly calibSums: number[] = [];
  private floor = 0;

  /** Feed a room-noise frame (countdown, before the song starts). */
  calibrate(chroma: number[]): void {
    this.calibSums.push(sum(chroma));
    const sorted = [...this.calibSums].sort((a, b) => a - b);
    const room = sorted[Math.floor(CALIBRATION_PERCENTILE * (sorted.length - 1))];
    this.floor = SILENCE_FACTOR * room;
  }

  get silenceFloor(): number {
    return this.floor;
  }

  /** Room frames heard so far. The race waits for some: a countdown run in
   *  a hidden tab (no animation frames) would otherwise leave the floor at
   *  0 and the loudness gate off. */
  get calibrationFrames(): number {
    return this.calibSums.length;
  }

  push(chroma: number[], nowMs: number): boolean[] {
    const out = new Array<boolean>(12).fill(false);
    const prev = this.prev;
    this.prev = chroma;
    if (!prev) return out;

    const loudEnough = sum(chroma) >= this.floor;
    const relFloor = ONSET_REL_MIN * Math.max(...chroma);
    for (let c = 0; c < 12; c++) {
      const flux = Math.max(0, chroma[c] - prev[c]);
      const hist = this.history[c];
      const { mean, std } = meanStd(hist);
      if (
        loudEnough
        && flux > 0
        && flux >= relFloor
        && flux > mean + ONSET_K * std
        && nowMs - this.lastOnsetMs[c] >= ONSET_REFRACTORY_MS
      ) {
        out[c] = true;
        this.lastOnsetMs[c] = nowMs;
      }
      hist.push(flux);
      if (hist.length > ONSET_WINDOW) hist.shift();
    }
    return out;
  }
}
