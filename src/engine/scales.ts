export const PENTATONIC_NOTES = [
  'C3', 'D3', 'E3', 'G3', 'A3',
  'C4', 'D4', 'E4', 'G4', 'A4',
  'C5', 'D5', 'E5',
] as const;

export type PentatonicNote = (typeof PENTATONIC_NOTES)[number];

export function stationToNote(stationIndex: number, totalStations: number): PentatonicNote {
  const noteIndex = Math.round(
    (stationIndex / (totalStations - 1)) * (PENTATONIC_NOTES.length - 1)
  );
  return PENTATONIC_NOTES[noteIndex];
}
