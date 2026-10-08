import { drawNotes } from '../draw';

/** Deterministic LCG so draws are reproducible in tests. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `line${i}`);

describe('drawNotes', () => {
  it('gives twelve lines all twelve pitch classes', () => {
    const notes = drawNotes(ids(12), seeded(1));
    expect(Object.values(notes).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('gives fewer lines distinct classes', () => {
    const notes = drawNotes(ids(4), seeded(2));
    expect(new Set(Object.values(notes)).size).toBe(4);
    expect(Object.keys(notes)).toEqual(ids(4));
  });

  it('is reproducible for the same rng seed', () => {
    expect(drawNotes(ids(6), seeded(42))).toEqual(drawNotes(ids(6), seeded(42)));
  });

  it('rejects fewer than 2, more than 12, or repeated lines', () => {
    expect(() => drawNotes(ids(1))).toThrow(RangeError);
    expect(() => drawNotes(ids(13))).toThrow(RangeError);
    expect(() => drawNotes(['ginza', 'ginza', 'oedo'])).toThrow(RangeError);
  });
});
