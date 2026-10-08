export const MIN_LANES = 2;
export const MAX_LANES = 12;

/** Randomly deal distinct pitch classes to lines (Fisher–Yates over 0…11).
 *  Random rather than fixed per line so nobody can pick the winner from the
 *  song's key. */
export function drawNotes(lineIds: string[], rng: () => number = Math.random): Record<string, number> {
  if (lineIds.length < MIN_LANES || lineIds.length > MAX_LANES) {
    throw new RangeError(`need ${MIN_LANES}–${MAX_LANES} lines, got ${lineIds.length}`);
  }
  if (new Set(lineIds).size !== lineIds.length) throw new RangeError('lines must be distinct');
  const classes = Array.from({ length: 12 }, (_, i) => i);
  for (let i = classes.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [classes[i], classes[j]] = [classes[j], classes[i]];
  }
  return Object.fromEntries(lineIds.map((id, i) => [id, classes[i]]));
}
