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
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.4, release: 1.8 },
    }),
    attack: 0.1, decay: 0.2, sustain: 0.4, release: 1.8,
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
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.35, release: 1.4 },
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
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.15, decay: 0.3, sustain: 0.5, release: 2.0 },
    }),
    attack: 0.15, decay: 0.3, sustain: 0.5, release: 2.0,
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
