import {
  advance, budgetFor, createRace, currentStationIndex, formatClock, frameDt,
  MAX_DT_SEC, standings, type Lane, type RaceState,
} from '../raceEngine';

const FPS = 30;
const DT = 1 / FPS;
const none = () => new Array<boolean>(12).fill(false);
const fire = (...pcs: number[]) => { const a = none(); for (const p of pcs) a[p] = true; return a; };
/** The onset sequence used by both budget streams: class 0 gets exactly 20%. */
const classOfOnset = (k: number) => (k % 5 === 0 ? 0 : 1 + (k % 3));

describe('createRace', () => {
  it('rejects a non-positive duration', () => {
    expect(() => createRace([], 0)).toThrow(RangeError);
    expect(() => createRace([], -5)).toThrow(RangeError);
  });

  it('starts every lane at zero', () => {
    const s = createRace([{ lineId: 'ginza', pitchClass: 3, stationCount: 19 }], 200);
    expect(s.lanes[0]).toMatchObject({ progress: 0, finishedAtSec: null, onsets: 0 });
    expect(s.classOnsets).toEqual(new Array(12).fill(0));
  });
});

describe('advance', () => {
  it('moves the same distance for sparse and dense songs with equal note shares', () => {
    const duration = 300;
    const runFor = 180;
    const lanes = [{ lineId: 'a', pitchClass: 0, stationCount: 10 }];
    let dense = createRace(lanes, duration);
    let sparse = createRace(lanes, duration);
    let kDense = 0;
    let kSparse = 0;
    for (let i = 0; i < runFor * FPS; i++) {
      dense = advance(dense, fire(classOfOnset(kDense++)), DT);              // 30 onsets/s
      sparse = advance(sparse, i % 10 === 0 ? fire(classOfOnset(kSparse++)) : none(), DT); // 3 onsets/s
    }
    const expected = 0.2 * budgetFor(duration) * runFor;
    expect(dense.lanes[0].progress).toBeGreaterThan(expected * 0.9);
    expect(dense.lanes[0].progress).toBeLessThan(expected * 1.1);
    expect(sparse.lanes[0].progress).toBeGreaterThan(expected * 0.9);
    expect(sparse.lanes[0].progress).toBeLessThan(expected * 1.1);
  });

  it('records finish order, clamps at 1.0, and keeps the first finish time', () => {
    let s = createRace([
      { lineId: 'a', pitchClass: 0, stationCount: 10 },
      { lineId: 'b', pitchClass: 1, stationCount: 10 },
    ], 10);
    for (let i = 0; i < 1000 && s.lanes[0].finishedAtSec === null; i++) s = advance(s, fire(0), DT);
    const aFinished = s.lanes[0].finishedAtSec;
    expect(aFinished).not.toBeNull();
    expect(s.lanes[0].progress).toBe(1);
    expect(s.lanes[1].finishedAtSec).toBeNull();
    for (let i = 0; i < 1000 && s.lanes[1].finishedAtSec === null; i++) s = advance(s, fire(0, 1), DT);
    expect(s.lanes[0].progress).toBe(1);
    expect(s.lanes[0].finishedAtSec).toBe(aFinished);
    expect(standings(s).map((l) => l.lineId)).toEqual(['a', 'b']);
  });

  it('a very short song still clamps progress at 1.0', () => {
    let s = createRace([{ lineId: 'a', pitchClass: 0, stationCount: 5 }], 15);
    for (let i = 0; i < 15 * FPS; i++) s = advance(s, fire(0), DT);
    expect(s.lanes[0].progress).toBe(1);
    expect(Number.isFinite(s.rateEma)).toBe(true);
  });

  it('does nothing while paused (dt = 0)', () => {
    const s = createRace([{ lineId: 'a', pitchClass: 0, stationCount: 10 }], 100);
    expect(advance(s, fire(0), 0)).toBe(s);
  });

  it('counts onsets for all 12 classes, with or without a train', () => {
    let s = createRace([{ lineId: 'a', pitchClass: 0, stationCount: 10 }], 100);
    s = advance(s, fire(0, 7), DT);
    s = advance(s, fire(7), DT);
    expect(s.classOnsets[0]).toBe(1);
    expect(s.classOnsets[7]).toBe(2);
  });
});

describe('standings', () => {
  it('ranks finishers by time, then the rest by distance, then onsets, then draw order', () => {
    const base = createRace([], 100);
    const lane = (lineId: string, progress: number, finishedAtSec: number | null, onsets: number): Lane =>
      ({ lineId, pitchClass: 0, stationCount: 10, progress, finishedAtSec, onsets });
    const s: RaceState = {
      ...base,
      lanes: [
        lane('a', 1, 5, 10),
        lane('b', 1, 3, 10),
        lane('c', 0.5, null, 4),
        lane('d', 0.7, null, 4),
        lane('e', 0.5, null, 9),
        lane('f', 0.5, null, 4),
      ],
    };
    expect(standings(s).map((l) => l.lineId)).toEqual(['b', 'a', 'd', 'e', 'c', 'f']);
  });
});

describe('currentStationIndex', () => {
  const at = (progress: number, stationCount: number): Lane =>
    ({ lineId: 'x', pitchClass: 0, stationCount, progress, finishedAtSec: null, onsets: 0 });
  it('maps progress onto station indices', () => {
    expect(currentStationIndex(at(0, 10))).toBe(0);
    expect(currentStationIndex(at(0.5, 3))).toBe(1);
    expect(currentStationIndex(at(1, 10))).toBe(9);
  });
  it('handles a one-station lane without dividing by zero', () => {
    expect(currentStationIndex(at(0.7, 1))).toBe(0);
  });
});

describe('frameDt', () => {
  it('is zero while paused or before the first frame', () => {
    expect(frameDt(1000, 1033, false)).toBe(0);
    expect(frameDt(null, 1033, true)).toBe(0);
  });
  it('measures normal frame gaps in seconds', () => {
    expect(frameDt(1000, 1033, true)).toBeCloseTo(0.033);
  });
  it('caps the gap after a hidden tab comes back', () => {
    expect(frameDt(1000, 61000, true)).toBe(MAX_DT_SEC);
  });
});

describe('formatClock', () => {
  it('formats m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65.9)).toBe('1:05');
    expect(formatClock(212)).toBe('3:32');
  });
});
