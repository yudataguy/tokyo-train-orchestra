import * as Tone from 'tone';

export interface InstrumentConfig {
  id: string;
  name: string;
  create: () => Tone.PolySynth;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

const INSTRUMENT_CONFIGS: Record<string, InstrumentConfig> = {
  piano: {
    id: 'piano', name: 'Piano',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.2, release: 1.5 },
    }),
    attack: 0.05, decay: 0.3, sustain: 0.2, release: 1.5,
  },
  violin: {
    id: 'violin', name: 'Violin',
    // FM synth gives a warmer bowed-string timbre than raw sawtooth.
    create: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 2,
      oscillator: { type: 'sine' },
      modulation: { type: 'triangle' },
      envelope: { attack: 0.12, decay: 0.2, sustain: 0.4, release: 1.8 },
      modulationEnvelope: { attack: 0.3, decay: 0.2, sustain: 0.5, release: 1.0 },
    }),
    attack: 0.12, decay: 0.2, sustain: 0.4, release: 1.8,
  },
  frenchhorn: {
    id: 'frenchhorn', name: 'French Horn',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.15, decay: 0.4, sustain: 0.5, release: 2.0 },
    }),
    attack: 0.15, decay: 0.4, sustain: 0.5, release: 2.0,
  },
  flute: {
    id: 'flute', name: 'Flute',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.08, decay: 0.2, sustain: 0.3, release: 1.2 },
    }),
    attack: 0.08, decay: 0.2, sustain: 0.3, release: 1.2,
  },
  clarinet: {
    id: 'clarinet', name: 'Clarinet',
    // FM with triangle modulator produces a mellower reed than raw square.
    create: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 1.5,
      oscillator: { type: 'sine' },
      modulation: { type: 'triangle' },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.35, release: 1.4 },
      modulationEnvelope: { attack: 0.2, decay: 0.2, sustain: 0.4, release: 0.8 },
    }),
    attack: 0.1, decay: 0.3, sustain: 0.35, release: 1.4,
  },
  harp: {
    id: 'harp', name: 'Harp',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.5, sustain: 0.1, release: 2.0 },
    }),
    attack: 0.02, decay: 0.5, sustain: 0.1, release: 2.0,
  },
  cello: {
    id: 'cello', name: 'Cello',
    // AM synth with sine carrier gives a warm woody body, much gentler at
    // low pitches than raw sawtooth.
    create: () => new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 1.5,
      oscillator: { type: 'sine' },
      modulation: { type: 'triangle' },
      envelope: { attack: 0.18, decay: 0.3, sustain: 0.6, release: 2.2 },
      modulationEnvelope: { attack: 0.4, decay: 0.2, sustain: 0.6, release: 1.0 },
    }),
    attack: 0.18, decay: 0.3, sustain: 0.6, release: 2.2,
  },
  marimba: {
    id: 'marimba', name: 'Marimba',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.05, release: 1.0 },
    }),
    attack: 0.01, decay: 0.4, sustain: 0.05, release: 1.0,
  },
  vibraphone: {
    id: 'vibraphone', name: 'Vibraphone',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.6, sustain: 0.15, release: 2.5 },
    }),
    attack: 0.02, decay: 0.6, sustain: 0.15, release: 2.5,
  },
  guitar: {
    id: 'guitar', name: 'Guitar',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.8, sustain: 0.1, release: 1.5 },
    }),
    attack: 0.01, decay: 0.8, sustain: 0.1, release: 1.5,
  },
  trumpet: {
    id: 'trumpet', name: 'Trumpet',
    // Higher modulationIndex gives brass bite; sine carrier keeps it clean.
    create: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1,
      modulationIndex: 8,
      oscillator: { type: 'sine' },
      modulation: { type: 'square' },
      envelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 1.2 },
      modulationEnvelope: { attack: 0.1, decay: 0.3, sustain: 0.3, release: 0.8 },
    }),
    attack: 0.06, decay: 0.2, sustain: 0.5, release: 1.2,
  },
  oboe: {
    id: 'oboe', name: 'Oboe',
    // Moderate modulation keeps the reedy double-reed character without the
    // raw sawtooth harshness.
    create: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 3,
      oscillator: { type: 'sine' },
      modulation: { type: 'sawtooth' },
      envelope: { attack: 0.08, decay: 0.25, sustain: 0.4, release: 1.5 },
      modulationEnvelope: { attack: 0.2, decay: 0.2, sustain: 0.5, release: 1.0 },
    }),
    attack: 0.08, decay: 0.25, sustain: 0.4, release: 1.5,
  },
  bass: {
    id: 'bass', name: 'Bass',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 1.8 },
    }),
    attack: 0.05, decay: 0.3, sustain: 0.4, release: 1.8,
  },
};

export function getInstrumentConfig(instrument: string): InstrumentConfig {
  const config = INSTRUMENT_CONFIGS[instrument];
  if (!config) {
    throw new Error(`Unknown instrument: ${instrument}`);
  }
  return config;
}

export function getAllInstrumentIds(): string[] {
  return Object.keys(INSTRUMENT_CONFIGS);
}
