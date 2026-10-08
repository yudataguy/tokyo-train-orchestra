/** Share of all onsets a typical leading note has. Calibrates the finish line. */
export const LEADER_SHARE = 0.18;
/** Fraction of the song at which that typical leader reaches the terminal. */
export const FINISH_AT = 0.85;
/** Assumed total onset rate (all classes, per second) before any audio. */
export const RATE_PRIOR = 6;
/** Floor on the onset-rate estimate, so the first note after a silence
 *  doesn't teleport its train. */
export const RATE_MIN = 2;
/** Time constant of the onset-rate moving average, in seconds. */
export const RATE_TAU = 4;
/** Longest clock step one frame may take (a hidden tab resumes with a gap). */
export const MAX_DT_SEC = 0.25;

export interface LaneSpec {
  lineId: string;
  pitchClass: number;
  stationCount: number;
}

export interface Lane extends LaneSpec {
  progress: number;              // 0 … 1, 1 = terminal
  finishedAtSec: number | null;  // race clock when progress first hit 1
  onsets: number;                // this lane's onsets, for tie-breaks
}

export interface RaceState {
  lanes: Lane[];
  durationSec: number;
  elapsedSec: number;
  budget: number;                // distance handed out per second, all classes
  rateEma: number;               // smoothed total onsets per second
  classOnsets: number[];         // all 12 classes, for the results histogram
}

/** Per-second distance budget such that a note holding LEADER_SHARE of the
 *  onsets reaches 1.0 at FINISH_AT of the song. */
export function budgetFor(durationSec: number): number {
  return 1 / (LEADER_SHARE * FINISH_AT * durationSec);
}

/** Distance one onset is worth right now. Dividing the budget by the onset
 *  rate makes total distance depend on song length, not on how busy it is. */
export function stepSize(budget: number, rateEma: number): number {
  return budget / Math.max(rateEma, RATE_MIN);
}

export function createRace(lanes: LaneSpec[], durationSec: number): RaceState {
  if (!(durationSec > 0)) throw new RangeError(`durationSec must be > 0, got ${durationSec}`);
  return {
    lanes: lanes.map((l) => ({ ...l, progress: 0, finishedAtSec: null, onsets: 0 })),
    durationSec,
    elapsedSec: 0,
    budget: budgetFor(durationSec),
    rateEma: RATE_PRIOR,
    classOnsets: new Array<number>(12).fill(0),
  };
}

/** One lane, one frame. A finished train keeps counting onsets (tie-breaks)
 *  but waits at the terminal, wheels spinning. */
export function advanceLane(lane: Lane, fired: boolean, step: number, elapsedSec: number): Lane {
  if (!fired) return lane;
  const onsets = lane.onsets + 1;
  if (lane.finishedAtSec !== null) return { ...lane, onsets };
  const progress = Math.min(1, lane.progress + step);
  return { ...lane, onsets, progress, finishedAtSec: progress >= 1 ? elapsedSec : null };
}

export function advance(state: RaceState, onsets: boolean[], dtSec: number): RaceState {
  if (dtSec <= 0) return state;
  const elapsedSec = state.elapsedSec + dtSec;
  const count = onsets.reduce((n, f) => n + (f ? 1 : 0), 0);
  const alpha = 1 - Math.exp(-dtSec / RATE_TAU);
  const rateEma = state.rateEma + alpha * (count / dtSec - state.rateEma);
  const step = stepSize(state.budget, rateEma);
  return {
    ...state,
    elapsedSec,
    rateEma,
    classOnsets: state.classOnsets.map((n, c) => n + (onsets[c] ? 1 : 0)),
    lanes: state.lanes.map((lane) => advanceLane(lane, onsets[lane.pitchClass], step, elapsedSec)),
  };
}

/** Finishers by arrival time, then the rest by distance; ties go to the lane
 *  with more onsets, then to draw order. */
export function standings(state: RaceState): Lane[] {
  const order = new Map(state.lanes.map((l, i) => [l.lineId, i]));
  const tie = (a: Lane, b: Lane) => b.onsets - a.onsets || order.get(a.lineId)! - order.get(b.lineId)!;
  return [...state.lanes].sort((a, b) => {
    if (a.finishedAtSec !== null && b.finishedAtSec !== null) return a.finishedAtSec - b.finishedAtSec || tie(a, b);
    if (a.finishedAtSec !== null) return -1;
    if (b.finishedAtSec !== null) return 1;
    return b.progress - a.progress || tie(a, b);
  });
}

/** Index of the last station the train has reached. */
export function currentStationIndex(lane: Lane): number {
  const last = lane.stationCount - 1;
  if (last <= 0) return 0;
  return Math.min(last, Math.floor(lane.progress * last + 1e-9));
}

/** Seconds of race clock for one analysis frame. */
export function frameDt(prevMs: number | null, nowMs: number, playing: boolean): number {
  if (!playing || prevMs === null) return 0;
  return Math.min(MAX_DT_SEC, Math.max(0, (nowMs - prevMs) / 1000));
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
