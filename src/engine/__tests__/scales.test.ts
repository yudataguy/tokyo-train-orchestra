import { stationToNote, PENTATONIC_NOTES } from '../scales';

describe('stationToNote', () => {
  it('maps first station to lowest note (C3)', () => {
    expect(stationToNote(0, 19)).toBe('C3');
  });

  it('maps last station to highest note (E5)', () => {
    expect(stationToNote(18, 19)).toBe('E5');
  });

  it('maps middle station to a middle note', () => {
    const note = stationToNote(9, 19);
    expect(PENTATONIC_NOTES).toContain(note);
  });

  it('works for lines with different station counts', () => {
    expect(stationToNote(0, 14)).toBe('C3');
    expect(stationToNote(13, 14)).toBe('E5');
  });

  it('always returns a valid pentatonic note', () => {
    for (let i = 0; i < 25; i++) {
      const note = stationToNote(i, 25);
      expect(PENTATONIC_NOTES).toContain(note);
    }
  });

  it('has exactly 13 notes in the pentatonic set', () => {
    expect(PENTATONIC_NOTES).toHaveLength(13);
  });
});
