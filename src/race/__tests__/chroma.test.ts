import { foldChroma, pitchClassOf, PITCH_NAMES } from '../chroma';

const SR = 48000;
const FFT = 8192;
const BIN_HZ = SR / FFT;

/** A dB spectrum with 0 dB peaks at the given frequencies and true silence
 *  (-Infinity, what AnalyserNode reports for a zero signal) everywhere else. */
function spectrum(peaksHz: number[]): Float32Array {
  const db = new Float32Array(FFT / 2).fill(-Infinity);
  for (const f of peaksHz) db[Math.round(f / BIN_HZ)] = 0;
  return db;
}

const argsortDesc = (xs: number[]) => xs.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);

describe('pitchClassOf', () => {
  it('maps A4 and A5 to A', () => {
    expect(pitchClassOf(440)).toBe(9);
    expect(pitchClassOf(880)).toBe(9);
  });

  it('keeps B and C on the right side of the octave wrap', () => {
    expect(pitchClassOf(246.94)).toBe(11);
    expect(pitchClassOf(261.63)).toBe(0);
  });
});

describe('foldChroma', () => {
  it('puts a 440 Hz tone on A', () => {
    const chroma = foldChroma(spectrum([440]), SR, FFT);
    expect(chroma).toHaveLength(12);
    expect(argsortDesc(chroma)[0]).toBe(9);
    expect(PITCH_NAMES[9]).toBe('A');
  });

  it('puts an A-major triad on A, C#, E', () => {
    const chroma = foldChroma(spectrum([440, 554.37, 659.26]), SR, FFT);
    expect(argsortDesc(chroma).slice(0, 3).sort((a, b) => a - b)).toEqual([1, 4, 9]);
  });

  it('keeps B3 and C4 apart through the FFT bins', () => {
    expect(argsortDesc(foldChroma(spectrum([246.94]), SR, FFT))[0]).toBe(11);
    expect(argsortDesc(foldChroma(spectrum([261.63]), SR, FFT))[0]).toBe(0);
  });

  it('credits a smeared tone to its peak class, not its shoulders', () => {
    // A note that starts mid-window has a widened main lobe spilling into the
    // neighbouring semitones' bins. Only the spectral peak names the note.
    const db = spectrum([]);
    const center = Math.round(293.66 / BIN_HZ); // D4
    const lobe = [-14, -9, -5, -2, 0, -2, -5, -9, -14]; // dB, ±4 bins
    lobe.forEach((v, i) => { db[center - 4 + i] = v; });
    const chroma = foldChroma(db, SR, FFT);
    expect(argsortDesc(chroma)[0]).toBe(2);
    expect(chroma[1]).toBe(0); // C#
    expect(chroma[3]).toBe(0); // D#
  });

  it('ignores energy below C3 and above C7', () => {
    const chroma = foldChroma(spectrum([100, 3000]), SR, FFT);
    expect(chroma.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('returns all zeros (not NaN) for a silent spectrum', () => {
    const chroma = foldChroma(spectrum([]), SR, FFT);
    expect(chroma).toEqual(new Array(12).fill(0));
  });
});
