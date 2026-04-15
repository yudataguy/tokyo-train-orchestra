/**
 * Full C-pentatonic scale across 5 octaves. Every line's pitch range is a
 * window into this single array, which guarantees all lines harmonize
 * regardless of which register they inhabit — the pentatonic invariant
 * (no minor seconds, no tritones) still holds across the whole set.
 */
export const FULL_PENTATONIC = [
  'C2', 'D2', 'E2', 'G2', 'A2',   // 0–4   deep
  'C3', 'D3', 'E3', 'G3', 'A3',   // 5–9   low-mid (was our old floor)
  'C4', 'D4', 'E4', 'G4', 'A4',   // 10–14 mid
  'C5', 'D5', 'E5', 'G5', 'A5',   // 15–19 upper-mid (was our old ceiling at E5)
  'C6', 'D6', 'E6', 'G6', 'A6',   // 20–24 high
  'C7',                            // 25    very high
] as const;

export type PentatonicNote = (typeof FULL_PENTATONIC)[number];

/**
 * Per-instrument pentatonic window as [startIndex, endIndex] inclusive into
 * FULL_PENTATONIC. Chosen to match each instrument's natural register so
 * notes never fall below where a real instrument would sit (which made the
 * synth sound muddy) or above its top (which sounded thin).
 *
 * Instruments not listed fall back to PIANO_RANGE.
 */
export const INSTRUMENT_RANGES: Record<string, readonly [number, number]> = {
  piano:        [5, 17],  // C3 – E5
  violin:       [8, 18],  // G3 – G5   (violin bottoms at G3)
  frenchhorn:   [5, 17],  // C3 – E5
  flute:        [10, 22], // C4 – E6   (flute range starts at C4)
  clarinet:     [7, 19],  // E3 – A5   (clarinet bottoms at E3)
  harp:         [0, 17],  // C2 – E5   (harp has the widest natural range)
  cello:        [0, 12],  // C2 – E4
  marimba:      [5, 17],  // C3 – E5
  vibraphone:   [10, 22], // C4 – E6
  guitar:       [7, 19],  // E3 – A5
  trumpet:      [7, 19],  // E3 – A5   (trumpet bottoms around E3)
  oboe:         [10, 22], // C4 – E6   (oboe cannot play below Bb3)
  bass:         [0, 12],  // C2 – E4
  glockenspiel: [15, 25], // C5 – C7   (glockenspiel is a high bell)
  xylophone:    [12, 22], // E4 – E6   (xylophone bottoms at F4)
  celesta:      [10, 22], // C4 – E6
  kalimba:      [10, 22], // C4 – E6
};

const PIANO_RANGE = INSTRUMENT_RANGES.piano;

/**
 * Alias for the default (piano) 13-note range. Kept so existing tests and
 * any legacy callers without an instrument argument still observe the
 * pre-expansion C3–E5 pentatonic.
 */
export const PENTATONIC_NOTES = FULL_PENTATONIC.slice(
  PIANO_RANGE[0],
  PIANO_RANGE[1] + 1,
);

/**
 * Map a station's position along a line to a pentatonic note. When an
 * instrument id is provided, the pitch is drawn from that instrument's
 * natural range; otherwise the default piano range is used.
 */
export function stationToNote(
  stationIndex: number,
  totalStations: number,
  instrument?: string,
): PentatonicNote {
  const [lo, hi] = (instrument && INSTRUMENT_RANGES[instrument]) || PIANO_RANGE;
  const windowLen = hi - lo + 1;
  const denom = Math.max(1, totalStations - 1);
  const noteIndex = Math.round((stationIndex / denom) * (windowLen - 1));
  return FULL_PENTATONIC[lo + noteIndex];
}
