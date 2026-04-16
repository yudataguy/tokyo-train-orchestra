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
  glockenspiel: {
    id: 'glockenspiel', name: 'Glockenspiel',
    // High-harmonicity FM gives bell-like inharmonic partials. Short mallet
    // strike, long metallic ring-out; zero sustain so each note is struck
    // and decays, never held. Fits the automated-guideway Yurikamome voice.
    create: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 10,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.001, decay: 1.8, sustain: 0, release: 1.5 },
      modulationEnvelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.2 },
    }),
    attack: 0.001, decay: 1.8, sustain: 0, release: 1.5,
  },
  xylophone: {
    id: 'xylophone', name: 'Xylophone',
    // Bright wooden mallet — distinct from marimba (darker, lower).
    create: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 4,
      modulationIndex: 8,
      oscillator: { type: 'sine' },
      modulation: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.8 },
      modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.2 },
    }),
    attack: 0.001, decay: 0.6, sustain: 0, release: 0.8,
  },
  celesta: {
    id: 'celesta', name: 'Celesta',
    // Ethereal bell, higher and sweeter than glockenspiel. AM with sine
    // modulator produces a purer tone than FM at this register.
    create: () => new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 5,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.001, decay: 2.0, sustain: 0, release: 1.8 },
      modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.3 },
    }),
    attack: 0.001, decay: 2.0, sustain: 0, release: 1.8,
  },
  kalimba: {
    id: 'kalimba', name: 'Kalimba',
    // African thumb-piano: warm plucked tine. FM with moderate modulation
    // gives the characteristic metallic pluck + wooden body resonance.
    create: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 5,
      oscillator: { type: 'sine' },
      modulation: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 1.0 },
      modulationEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.3 },
    }),
    attack: 0.001, decay: 1.2, sustain: 0, release: 1.0,
  },
  pipeorgan: {
    id: 'pipeorgan', name: 'Pipe Organ',
    // Sustained, rich harmonic stack. Sawtooth gives the classic reed-pipe
    // bite; high sustain + near-zero decay means notes hold flat until
    // release, like stops pulled on a real organ (no natural decay envelope).
    create: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 2,
      oscillator: { type: 'sawtooth' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.08, decay: 0.1, sustain: 0.85, release: 1.8 },
      modulationEnvelope: { attack: 0.1, decay: 0.1, sustain: 0.7, release: 1.0 },
    }),
    attack: 0.08, decay: 0.1, sustain: 0.85, release: 1.8,
  },
  shakuhachi: {
    id: 'shakuhachi', name: 'Shakuhachi',
    // Japanese bamboo flute: breathy, gentle, slightly hollow. Low
    // modulationIndex keeps it pure; longer attack evokes the soft onset
    // of blown bamboo rather than a struck or bowed entry.
    create: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1,
      modulationIndex: 1.2,
      oscillator: { type: 'sine' },
      modulation: { type: 'triangle' },
      envelope: { attack: 0.18, decay: 0.25, sustain: 0.45, release: 1.6 },
      modulationEnvelope: { attack: 0.25, decay: 0.2, sustain: 0.4, release: 0.8 },
    }),
    attack: 0.18, decay: 0.25, sustain: 0.45, release: 1.6,
  },
  rhodes: {
    id: 'rhodes', name: 'Rhodes',
    // Electric piano: bell-like metallic attack over a warm body. High
    // modulationIndex at strike gives the characteristic "clang"; the
    // modulation envelope decays fast so only the fundamental sustains.
    create: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1,
      modulationIndex: 6,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.8, sustain: 0.15, release: 1.4 },
      modulationEnvelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.3 },
    }),
    attack: 0.005, decay: 0.8, sustain: 0.15, release: 1.4,
  },
  koto: {
    id: 'koto', name: 'Koto',
    // Japanese 13-string plucked zither — voice of the Yamanote Line.
    // Tuned defaults: harmonicity 2.5 and modulationIndex 5 give the
    // woody-but-bright silk-string pluck; triangle modulator softens the
    // attack transient vs. sawtooth; decay 2.0 matches a real koto's long
    // ring-out. Short modulation decay (0.25) means the initial "twang"
    // fades fast, leaving a pure tone that decays naturally.
    create: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2.5,
      modulationIndex: 5,
      oscillator: { type: 'sine' },
      modulation: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 2.0, sustain: 0, release: 1.5 },
      modulationEnvelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.3 },
    }),
    attack: 0.001, decay: 2.0, sustain: 0, release: 1.5,
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
