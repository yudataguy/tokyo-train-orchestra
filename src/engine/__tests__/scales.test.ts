import { stationToNote, PENTATONIC_NOTES, FULL_PENTATONIC, INSTRUMENT_RANGES } from '../scales';

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

describe('per-instrument pitch range', () => {
  it('routes glockenspiel to its high register (C5 or above)', () => {
    // First station of a glockenspiel line should hit the low end of the
    // glockenspiel range (C5), not the global floor (C3).
    expect(stationToNote(0, 16, 'glockenspiel')).toBe('C5');
    expect(stationToNote(15, 16, 'glockenspiel')).toBe('C7');
  });

  it('routes bass to its low register (C2 – E4)', () => {
    expect(stationToNote(0, 19, 'bass')).toBe('C2');
    expect(stationToNote(18, 19, 'bass')).toBe('E4');
  });

  it('routes flute up an octave (C4 – E6)', () => {
    expect(stationToNote(0, 20, 'flute')).toBe('C4');
    expect(stationToNote(19, 20, 'flute')).toBe('E6');
  });

  it('falls back to piano range for unknown instruments', () => {
    expect(stationToNote(0, 19, 'unknown-instrument')).toBe('C3');
    expect(stationToNote(18, 19, 'unknown-instrument')).toBe('E5');
  });

  it('every instrument range produces notes in the full pentatonic set', () => {
    for (const instrument of Object.keys(INSTRUMENT_RANGES)) {
      for (let i = 0; i < 20; i++) {
        const note = stationToNote(i, 20, instrument);
        expect(FULL_PENTATONIC).toContain(note);
      }
    }
  });
});
