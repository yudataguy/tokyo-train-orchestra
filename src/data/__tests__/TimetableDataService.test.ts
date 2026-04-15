import {
  pickCalendar,
  findArrivalsAt,
  type CompactTimetable,
} from '../TimetableDataService';

describe('pickCalendar', () => {
  it('returns Weekday for Monday-Friday', () => {
    // 2026-04-13 is a Monday
    expect(pickCalendar(new Date('2026-04-13T04:00:00Z'))).toBe('Weekday');
    // 2026-04-17 is a Friday
    expect(pickCalendar(new Date('2026-04-17T04:00:00Z'))).toBe('Weekday');
  });

  it('returns SaturdayHoliday for Saturday/Sunday', () => {
    // 2026-04-18 is a Saturday
    expect(pickCalendar(new Date('2026-04-18T04:00:00Z'))).toBe('SaturdayHoliday');
    // 2026-04-19 is a Sunday
    expect(pickCalendar(new Date('2026-04-19T04:00:00Z'))).toBe('SaturdayHoliday');
  });
});

describe('findArrivalsAt', () => {
  const timetable: CompactTimetable = {
    n: 'A1029',
    d: 'Shibuya',
    stops: [
      { t: '10:06', a: false, s: 0 }, // origin, no arrival
      { t: '10:09', a: true, s: 1 },
      { t: '10:11', a: true, s: 2 },
      { t: '10:13', a: true, s: 3 },
    ],
  };

  it('returns arrivals matching the target time', () => {
    const hits = findArrivalsAt([timetable], '10:09');
    expect(hits).toHaveLength(1);
    expect(hits[0].stationIndex).toBe(1);
    expect(hits[0].trainNumber).toBe('A1029');
  });

  it('skips origin stops (a=false)', () => {
    // 10:06 is the departure time of the origin — no arrival should fire
    const hits = findArrivalsAt([timetable], '10:06');
    expect(hits).toHaveLength(0);
  });

  it('returns empty when no match', () => {
    const hits = findArrivalsAt([timetable], '23:59');
    expect(hits).toHaveLength(0);
  });

  it('matches multiple trains arriving at same HH:MM', () => {
    const t2: CompactTimetable = {
      n: 'B2030',
      d: 'Asakusa',
      stops: [{ t: '10:09', a: true, s: 7 }],
    };
    const hits = findArrivalsAt([timetable, t2], '10:09');
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.trainNumber).sort()).toEqual(['A1029', 'B2030']);
  });
});
