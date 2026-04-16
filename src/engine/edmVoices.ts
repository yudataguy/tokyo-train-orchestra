import * as Tone from 'tone';
import type { EdmVoiceId } from './edmMapping';

/**
 * Voice that responds to `triggerAttackRelease(note, duration, time)`.
 * Pitched voices (bass, lead, pad) accept a note; drums and FX ignore the
 * note arg and fire at their hard-coded pitch.
 */
export interface EdmVoice {
  triggerAttackRelease: (note: string, duration: string, time?: number) => void;
  dispose: () => void;
  connect: (dest: Tone.InputNode) => EdmVoice;
}

export type EdmVoices = Record<EdmVoiceId, EdmVoice>;

/** Create all 16 EDM voices and connect them to the given destination. */
export function createEdmVoices(destination: Tone.InputNode): EdmVoices {
  const mk = <T extends { connect: (d: Tone.InputNode) => unknown; dispose: () => void }>(
    synth: T,
    triggerFn: (note: string, duration: string, time?: number) => void,
  ): EdmVoice => {
    synth.connect(destination);
    return {
      triggerAttackRelease: triggerFn,
      dispose: () => synth.dispose(),
      connect: (d) => { synth.connect(d); return mk(synth, triggerFn); },
    };
  };

  // --- Drums ---
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 },
  });
  const lowTom = new Tone.MembraneSynth({
    pitchDecay: 0.1,
    octaves: 3,
    envelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.6 },
  });
  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 },
  });
  const clap = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.15 },
  });
  const closedHat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
  });
  const openHat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.3 },
  });
  const shaker = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.08 },
  });
  const rim = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.08, release: 0.05 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  });
  const cowbell = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.2, release: 0.1 },
    harmonicity: 3.1,
    modulationIndex: 22,
    resonance: 800,
    octaves: 0.5,
  });

  // --- Bass ---
  const bass = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { Q: 3, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.3 },
    filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.3, baseFrequency: 200, octaves: 3 },
  });

  // --- Lead ---
  const lead = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.3 },
  });

  // --- FX ---
  const fxRiser = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.8, decay: 0.2, sustain: 0, release: 0.2 },
  });
  const fxReverseCymbal = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 1.0, decay: 0.05, sustain: 0, release: 0.05 },
  });
  const fxZap = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.3, release: 0.1 },
    harmonicity: 8,
    modulationIndex: 40,
    resonance: 6000,
    octaves: 2,
  });
  const fxImpact = new Tone.MembraneSynth({
    pitchDecay: 0.3,
    octaves: 10,
    envelope: { attack: 0.001, decay: 1.0, sustain: 0, release: 1.0 },
  });

  // --- Pad (base track) ---
  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 1.5, decay: 0.5, sustain: 0.7, release: 3.0 },
  });
  // Pad sits 20 % quieter than other voices so arrival hits read on top.
  // gainToDb(0.8) ≈ -1.94 dB.
  pad.volume.value = -2;

  return {
    kick: mk(kick, (_n, d, t) => kick.triggerAttackRelease('C1', d, t)),
    lowTom: mk(lowTom, (_n, d, t) => lowTom.triggerAttackRelease('G1', d, t)),
    snare: mk(snare, (_n, d, t) => snare.triggerAttackRelease(d, t)),
    clap: mk(clap, (_n, d, t) => clap.triggerAttackRelease(d, t)),
    closedHat: mk(closedHat, (_n, d, t) => closedHat.triggerAttackRelease(d, t)),
    openHat: mk(openHat, (_n, d, t) => openHat.triggerAttackRelease(d, t)),
    shaker: mk(shaker, (_n, d, t) => shaker.triggerAttackRelease(d, t)),
    rim: mk(rim, (_n, d, t) => rim.triggerAttackRelease('C5', d, t)),
    cowbell: mk(cowbell, (_n, d, t) => cowbell.triggerAttackRelease('G4', d, t)),
    bass: mk(bass, (n, d, t) => bass.triggerAttackRelease(n, d, t)),
    lead: mk(lead, (n, d, t) => lead.triggerAttackRelease(n, d, t)),
    fxRiser: mk(fxRiser, (_n, d, t) => fxRiser.triggerAttackRelease(d, t)),
    fxReverseCymbal: mk(fxReverseCymbal, (_n, d, t) => fxReverseCymbal.triggerAttackRelease(d, t)),
    fxZap: mk(fxZap, (_n, d, t) => fxZap.triggerAttackRelease('A3', d, t)),
    fxImpact: mk(fxImpact, (_n, d, t) => fxImpact.triggerAttackRelease('A0', d, t)),
    pad: mk(pad, (n, d, t) => pad.triggerAttackRelease(n, d, t)),
  };
}
