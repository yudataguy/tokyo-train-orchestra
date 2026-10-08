/** Pitch-class names, index = pitch class (C = 0 … B = 11). Sharps rather
 *  than flats: the lane board has room for exactly one spelling. */
export const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** C3. Below this, one 8192-point FFT bin (~5.9 Hz at 48 kHz) is wider than
 *  half the gap between neighbouring semitones, so bass notes would smear
 *  across two or three classes. */
export const CHROMA_MIN_HZ = 130.81;
/** C7. Above this, energy is mostly cymbals and overtones, not notes. */
export const CHROMA_MAX_HZ = 2093;

/** Nearest equal-tempered pitch class for a frequency, A4 = 440 Hz. */
export function pitchClassOf(freqHz: number): number {
  const semitonesFromC = Math.round(12 * Math.log2(freqHz / 440)) + 9;
  return ((semitonesFromC % 12) + 12) % 12;
}

/** Fold an AnalyserNode dB spectrum into 12 pitch-class energies (linear
 *  magnitude sums). Silent bins arrive as -Infinity and contribute nothing. */
export function foldChroma(freqDb: Float32Array, sampleRate: number, fftSize: number): number[] {
  const chroma = new Array<number>(12).fill(0);
  const binHz = sampleRate / fftSize;
  const lo = Math.ceil(CHROMA_MIN_HZ / binHz);
  const hi = Math.min(freqDb.length - 1, Math.floor(CHROMA_MAX_HZ / binHz));
  for (let i = lo; i <= hi; i++) {
    const db = freqDb[i];
    if (!Number.isFinite(db)) continue;
    chroma[pitchClassOf(i * binHz)] += Math.pow(10, db / 20);
  }
  return chroma;
}
