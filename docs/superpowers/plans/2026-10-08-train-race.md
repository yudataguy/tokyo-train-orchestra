# Train Race Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/race` route where a song heard through the microphone drives up to 12 train lines along their real stations, one pitch class per line, and ranks them when the song ends.

**Architecture:** Pure, Jest-tested modules in `src/race/` do the work: chroma fold → onset detector → race engine, plus the draw and the YouTube URL parsing. A thin browser layer (`micAnalyser.ts`, a YouTube IFrame wrapper) feeds them. React step components in `src/components/race/` are sequenced by `RaceApp`'s state machine (`song → lineup → draw → race → results`). The route is a server `page.tsx` (for metadata) that renders a client `RaceEntry`, which loads `RaceApp` with `ssr: false`.

**Tech Stack:** Next.js 16 (static export), React 19, TypeScript, Tailwind v4, Web Audio `AnalyserNode`, YouTube IFrame Player API (script tag, no npm package), Jest + ts-jest (node environment).

**Spec:** `docs/superpowers/specs/2026-10-08-train-race-design.md`

## Global Constraints

- No new npm dependencies. The YouTube API is loaded from `https://www.youtube.com/iframe_api` at runtime, and its types are declared locally.
- No Tone.js on `/race`. The mic uses a plain `AudioContext`.
- Static export stays: `next.config.ts` keeps `output: 'export'`, and `/race` must emit `out/race.html`.
- `ssr: false` is not allowed in Server Components (Next 16, `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`), so the `dynamic()` call lives in the client file `RaceEntry.tsx`.
- Mic constraints are exactly `{ echoCancellation: false, noiseSuppression: false, autoGainControl: false }`.
- The analyser is `fftSize = 8192`, `smoothingTimeConstant = 0`, and is never connected to `ctx.destination`.
- Chroma range is C3 (130.81 Hz) – C7 (2093 Hz). Classes are C=0 … B=11.
- Constants and starting values:
  - `ONSET_K = 1.5`, `ONSET_WINDOW = 30`, `ONSET_REFRACTORY_MS = 120`, `SILENCE_FACTOR = 2`
  - `LEADER_SHARE = 0.18`, `FINISH_AT = 0.85`, `RATE_PRIOR = 6`, `RATE_MIN = 2`, `RATE_TAU = 4`
- Lanes: min 2, max 12. Player names: max 16 chars. Manual race lengths: 2, 3, 4, 5 min.
- `ACCENT_RACE = '#8F76D6'` (Hanzomon purple).
- Every user-visible string goes through `t()` with both `ja` and `en` entries. `ja` is the default language.
- `eslint-plugin-react-hooks` 7.1 compiler rules are on:
  - `refs`: no reading or writing `ref.current` during render
  - `set-state-in-effect`: no synchronous `setState` in an effect body
  - `purity`: no `Math.random()` or `Date.now()` during render
  - Write state updates in event handlers or timer callbacks.
- Pre-existing: `npx jest` over the whole repo prints "Jest did not exit one second after the test run". That comes from an existing suite. Run race tests as `npx jest src/race`.
- Commit messages follow the repo style `feat(race): …` and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Completely silent mic** (every bin is `-Infinity`). Expect zero chroma, no onsets, and no `NaN` in state. Tests: Task 1, Task 2.
2. **Tab hidden mid-race, then shown again.** The first frame back arrives seconds after the last one. Expect the race clock to advance by at most `MAX_DT_SEC`, not the whole gap. Test: Task 3 (`frameDt`).
3. **Very short or zero-length song** (a 15 s Short, or a duration of 0 or less). Expect `createRace` to throw on a duration of 0 or less, and a short race to still clamp progress at 1.0 with no overshoot. Test: Task 3.
4. **The same line twice in the lineup.** Expect `drawNotes` to throw instead of handing one line two notes. Test: Task 4.
5. **Notes at the B/C octave boundary.** Expect 246.94 Hz to map to B (11) and 261.63 Hz to C (0), not to swap. Test: Task 1.

---

### Task 1: Chroma fold

**Files:**
- Create: `src/race/chroma.ts`
- Test: `src/race/__tests__/chroma.test.ts`
- Modify: `package.json` (add a `"test": "jest"` script; the README already documents `npm test`)

**Interfaces:**
- Produces:
  - `PITCH_NAMES: readonly string[]` (12 entries)
  - `CHROMA_MIN_HZ = 130.81`, `CHROMA_MAX_HZ = 2093`
  - `pitchClassOf(freqHz: number): number`
  - `foldChroma(freqDb: Float32Array, sampleRate: number, fftSize: number): number[]`

- [ ] **Step 1: Add the test script**

In `package.json`, add to `"scripts"`, after `"lint": "eslint"`:

```json
    "lint": "eslint",
    "test": "jest"
```

- [ ] **Step 2: Write the failing test**

`src/race/__tests__/chroma.test.ts`:

```ts
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

  it('ignores energy below C3 and above C7', () => {
    const chroma = foldChroma(spectrum([100, 3000]), SR, FFT);
    expect(chroma.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('returns all zeros (not NaN) for a silent spectrum', () => {
    const chroma = foldChroma(spectrum([]), SR, FFT);
    expect(chroma).toEqual(new Array(12).fill(0));
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest src/race/__tests__/chroma.test.ts`
Expected: FAIL with "Cannot find module '../chroma'".

- [ ] **Step 4: Implement**

`src/race/chroma.ts`:

```ts
/** Pitch-class names, index = pitch class (C = 0 … B = 11). Sharps rather
 *  than flats: the lane board has room for exactly one spelling. */
export const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** C3. Below this, one 8192-point FFT bin (~5.9 Hz at 48 kHz) is wider than
 *  half the gap between neighbouring semitones, so bass notes would smear
 *  across two or three classes. */
export const CHROMA_MIN_HZ = 130.81;
/** C7. Above this, energy is mostly cymbals and overtones, not notes. */
export const CHROMA_MAX_HZ = 2093;

/** Nearest equal-tempered pitch class for a frequency, A4 = 440 Hz. */
export function pitchClassOf(freqHz: number): number {
  const semitonesFromC = Math.round(12 * Math.log2(freqHz / 440)) + 9;
  return ((semitonesFromC % 12) + 12) % 12;
}

/** Fold an AnalyserNode dB spectrum into 12 pitch-class energies (linear
 *  magnitude sums). Silent bins arrive as -Infinity and contribute nothing. */
export function foldChroma(freqDb: Float32Array, sampleRate: number, fftSize: number): number[] {
  const chroma = new Array<number>(12).fill(0);
  const binHz = sampleRate / fftSize;
  const lo = Math.ceil(CHROMA_MIN_HZ / binHz);
  const hi = Math.min(freqDb.length - 1, Math.floor(CHROMA_MAX_HZ / binHz));
  for (let i = lo; i <= hi; i++) {
    const db = freqDb[i];
    if (!Number.isFinite(db)) continue;
    chroma[pitchClassOf(i * binHz)] += Math.pow(10, db / 20);
  }
  return chroma;
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx jest src/race/__tests__/chroma.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json src/race/chroma.ts src/race/__tests__/chroma.test.ts
git commit -m "feat(race): fold FFT spectra into 12 pitch-class energies

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Onset detector

**Files:**
- Create: `src/race/onsets.ts`
- Test: `src/race/__tests__/onsets.test.ts`

**Interfaces:**
- Consumes: chroma frames as `number[]` (length 12) from Task 1's `foldChroma`.
- Produces:
  - `ONSET_K`, `ONSET_WINDOW`, `ONSET_REFRACTORY_MS`, `SILENCE_FACTOR`
  - `class OnsetDetector`:
    - `calibrate(chroma: number[]): void`
    - `push(chroma: number[], nowMs: number): boolean[]`
    - `get silenceFloor(): number`

- [ ] **Step 1: Write the failing test**

`src/race/__tests__/onsets.test.ts`:

```ts
import { OnsetDetector, SILENCE_FACTOR } from '../onsets';

const zeros = () => new Array<number>(12).fill(0);
const only = (pc: number, v: number) => { const a = zeros(); a[pc] = v; return a; };
const countFor = (frames: boolean[][], pc: number) => frames.filter((f) => f[pc]).length;
const total = (frames: boolean[][]) => frames.flat().filter(Boolean).length;

describe('OnsetDetector', () => {
  it('fires once when a note starts and not again while it is held', () => {
    const d = new OnsetDetector();
    const out: boolean[][] = [];
    let t = 0;
    for (let i = 0; i < 10; i++) out.push(d.push(zeros(), (t += 33)));
    for (let i = 0; i < 10; i++) out.push(d.push(only(9, 1), (t += 33)));
    expect(countFor(out, 9)).toBe(1);
    expect(total(out)).toBe(1);
  });

  it('suppresses a second rise inside the refractory window', () => {
    const d = new OnsetDetector();
    const out: boolean[][] = [];
    let t = 0;
    for (let i = 0; i < 5; i++) out.push(d.push(zeros(), (t += 33)));
    out.push(d.push(only(9, 1), (t += 33)));  // onset
    out.push(d.push(zeros(), (t += 33)));
    out.push(d.push(only(9, 1), (t += 33)));  // 66 ms later: suppressed
    out.push(d.push(zeros(), (t += 33)));
    out.push(d.push(only(9, 1), (t += 100))); // well past 120 ms: fires
    expect(countFor(out, 9)).toBe(2);
  });

  it('calibrates the silence floor from countdown frames', () => {
    const d = new OnsetDetector();
    for (let i = 0; i < 3; i++) d.calibrate(new Array(12).fill(0.5));
    expect(d.silenceFloor).toBe(SILENCE_FACTOR * 6);
  });

  it('ignores rises quieter than the silence floor', () => {
    const d = new OnsetDetector();
    for (let i = 0; i < 3; i++) d.calibrate(new Array(12).fill(0.5)); // floor = 12
    let t = 0;
    d.push(zeros(), (t += 33));
    expect(d.push(only(9, 5), (t += 33))[9]).toBe(false);
    d.push(zeros(), (t += 500));
    expect(d.push(only(9, 20), (t += 33))[9]).toBe(true);
  });

  it('never fires on a silent mic', () => {
    const d = new OnsetDetector();
    let t = 0;
    const out: boolean[][] = [];
    for (let i = 0; i < 60; i++) out.push(d.push(zeros(), (t += 33)));
    expect(total(out)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/race/__tests__/onsets.test.ts`
Expected: FAIL with "Cannot find module '../onsets'".

- [ ] **Step 3: Implement**

`src/race/onsets.ts`:

```ts
/** Threshold = mean + ONSET_K · stddev of a class's recent flux. */
export const ONSET_K = 1.5;
/** Flux history length per class, in frames (~1 s at 30 fps). */
export const ONSET_WINDOW = 30;
/** Minimum gap between two onsets of the same class. One struck note
 *  wobbles for a few frames; this keeps it to one train step. */
export const ONSET_REFRACTORY_MS = 120;
/** The silence floor is this multiple of the room level measured during
 *  the countdown. Calibrated rather than fixed: mic sensitivity varies too
 *  much between devices for a single constant. */
export const SILENCE_FACTOR = 2;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function meanStd(xs: number[]): { mean: number; std: number } {
  if (xs.length === 0) return { mean: 0, std: 0 };
  const mean = sum(xs) / xs.length;
  const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length;
  return { mean, std: Math.sqrt(variance) };
}

/** Per-pitch-class onset detection: a class "fires" when its energy rises
 *  sharply relative to its own recent history — the audio stand-in for the
 *  reference installation's MIDI key press. */
export class OnsetDetector {
  private prev: number[] | null = null;
  private readonly history: number[][] = Array.from({ length: 12 }, () => []);
  private readonly lastOnsetMs: number[] = new Array<number>(12).fill(-Infinity);
  private calibSum = 0;
  private calibFrames = 0;
  private floor = 0;

  /** Feed a room-noise frame (countdown, before the song starts). */
  calibrate(chroma: number[]): void {
    this.calibSum += sum(chroma);
    this.calibFrames += 1;
    this.floor = SILENCE_FACTOR * (this.calibSum / this.calibFrames);
  }

  get silenceFloor(): number {
    return this.floor;
  }

  push(chroma: number[], nowMs: number): boolean[] {
    const out = new Array<boolean>(12).fill(false);
    const prev = this.prev;
    this.prev = chroma;
    if (!prev) return out;

    const loudEnough = sum(chroma) >= this.floor;
    for (let c = 0; c < 12; c++) {
      const flux = Math.max(0, chroma[c] - prev[c]);
      const hist = this.history[c];
      const { mean, std } = meanStd(hist);
      if (
        loudEnough
        && flux > 0
        && flux > mean + ONSET_K * std
        && nowMs - this.lastOnsetMs[c] >= ONSET_REFRACTORY_MS
      ) {
        out[c] = true;
        this.lastOnsetMs[c] = nowMs;
      }
      hist.push(flux);
      if (hist.length > ONSET_WINDOW) hist.shift();
    }
    return out;
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest src/race/__tests__/onsets.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/race/onsets.ts src/race/__tests__/onsets.test.ts
git commit -m "feat(race): per-pitch-class onset detector with calibrated silence floor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Race engine

**Files:**
- Create: `src/race/raceEngine.ts`
- Test: `src/race/__tests__/raceEngine.test.ts`

> **Learning-mode contribution point.** `advanceLane` (5–8 lines) decides how a note moves a train, and so how the race feels. When executing, the implementer may set up everything else in this task, leave `advanceLane` as a stub that throws, and invite the user to write it against the Step 1 tests. The reference body is in Step 3.

**Interfaces:**
- Consumes: `boolean[]` onsets (length 12) from Task 2's `OnsetDetector.push`.
- Produces:
  - Constants: `LEADER_SHARE`, `FINISH_AT`, `RATE_PRIOR`, `RATE_MIN`, `RATE_TAU`, `MAX_DT_SEC`
  - `interface LaneSpec { lineId: string; pitchClass: number; stationCount: number }`
  - `interface Lane extends LaneSpec { progress: number; finishedAtSec: number | null; onsets: number }`
  - `interface RaceState { lanes: Lane[]; durationSec: number; elapsedSec: number; budget: number; rateEma: number; classOnsets: number[] }`
  - `budgetFor(durationSec: number): number`
  - `stepSize(budget: number, rateEma: number): number`
  - `createRace(lanes: LaneSpec[], durationSec: number): RaceState`
  - `advanceLane(lane: Lane, fired: boolean, step: number, elapsedSec: number): Lane`
  - `advance(state: RaceState, onsets: boolean[], dtSec: number): RaceState`
  - `standings(state: RaceState): Lane[]`
  - `currentStationIndex(lane: Lane): number`
  - `frameDt(prevMs: number | null, nowMs: number, playing: boolean): number`
  - `formatClock(sec: number): string`

- [ ] **Step 1: Write the failing test**

`src/race/__tests__/raceEngine.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/race/__tests__/raceEngine.test.ts`
Expected: FAIL with "Cannot find module '../raceEngine'".

- [ ] **Step 3: Implement**

`src/race/raceEngine.ts`:

```ts
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest src/race/__tests__/raceEngine.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/race/raceEngine.ts src/race/__tests__/raceEngine.test.ts
git commit -m "feat(race): race engine with song-length movement budget

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Note draw and YouTube helpers

**Files:**
- Create: `src/race/draw.ts`, `src/race/youtube.ts`
- Test: `src/race/__tests__/draw.test.ts`, `src/race/__tests__/youtube.test.ts`

**Interfaces:**
- Produces:
  - `MIN_LANES = 2`, `MAX_LANES = 12`
  - `drawNotes(lineIds: string[], rng?: () => number): Record<string, number>`
  - `parseYouTubeId(input: string): string | null`
  - `classifyYouTubeError(code: number): 'notEmbeddable' | 'unavailable'`
  - `YT_STATE` (`ENDED 0, PLAYING 1, PAUSED 2, BUFFERING 3, CUED 5`)
  - `interface YTPlayer { playVideo(); pauseVideo(); getDuration(): number; getPlayerState(): number; destroy() }`
  - `interface YTNamespace`
  - `loadYouTubeApi(): Promise<YTNamespace>`

- [ ] **Step 1: Write the failing tests**

`src/race/__tests__/draw.test.ts`:

```ts
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
```

`src/race/__tests__/youtube.test.ts`:

```ts
import { classifyYouTubeError, parseYouTubeId } from '../youtube';

const ID = 'dQw4w9WgXcQ';

describe('parseYouTubeId', () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}&t=42s&list=PL123`],
    [`youtube.com/watch?v=${ID}`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`https://youtu.be/${ID}?si=abc`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://music.youtube.com/watch?v=${ID}&feature=share`],
    [`  https://youtu.be/${ID}  `],
  ])('accepts %s', (input) => {
    expect(parseYouTubeId(input)).toBe(ID);
  });

  it.each([
    [''],
    ['not a url'],
    ['https://vimeo.com/123456'],
    ['https://www.youtube.com/watch?v=short'],
    ['https://www.youtube.com/channel/UCabcdefghijk'],
    [`https://youtube.com.evil.example/watch?v=${ID}`],
  ])('rejects %s', (input) => {
    expect(parseYouTubeId(input)).toBeNull();
  });
});

describe('classifyYouTubeError', () => {
  it('treats 101 and 150 as embedding disabled', () => {
    expect(classifyYouTubeError(101)).toBe('notEmbeddable');
    expect(classifyYouTubeError(150)).toBe('notEmbeddable');
  });
  it('treats everything else as unavailable', () => {
    for (const code of [2, 5, 100, -1]) expect(classifyYouTubeError(code)).toBe('unavailable');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest src/race/__tests__/draw.test.ts src/race/__tests__/youtube.test.ts`
Expected: FAIL with "Cannot find module '../draw'" and "Cannot find module '../youtube'".

- [ ] **Step 3: Implement**

`src/race/draw.ts`:

```ts
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
```

`src/race/youtube.ts`:

```ts
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Video ID from the URL shapes people actually paste, or null. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/shorts\/([^/]+)/)?.[1] ?? null;
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

/** IFrame API error codes: 101/150 mean the owner disabled embedding (common
 *  for label-owned music videos); 2/5/100 mean bad ID / HTML5 error / gone.
 *  -1 is ours: the API script itself failed to load. */
export function classifyYouTubeError(code: number): 'notEmbeddable' | 'unavailable' {
  return code === 101 || code === 150 ? 'notEmbeddable' : 'unavailable';
}

export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

/** The slice of the IFrame Player API we use, declared locally instead of
 *  pulling in @types/youtube. */
export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

export interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/** Inject the IFrame API script once; later calls share the same promise.
 *  A failed load clears the cache so the next attempt retries. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      script.remove();
      reject(new Error('YouTube IFrame API failed to load'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx jest src/race`
Expected: PASS, all race suites (chroma, onsets, raceEngine, draw, youtube).

- [ ] **Step 5: Commit**

```bash
git add src/race/draw.ts src/race/youtube.ts src/race/__tests__/draw.test.ts src/race/__tests__/youtube.test.ts
git commit -m "feat(race): random note draw and YouTube URL/API helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Mic analyser (browser glue)

**Files:**
- Create: `src/race/micAnalyser.ts`

There's no unit test: this file is only Web Audio and `getUserMedia` calls, and Jest runs in a `node` environment. The logic it feeds is tested in Tasks 1–3. It gets exercised in the browser in Task 9.

**Interfaces:**
- Consumes: `foldChroma` (Task 1).
- Produces:
  - `FFT_SIZE = 8192`
  - `type MicErrorKind = 'denied' | 'unsupported' | 'unavailable'`
  - `class MicError extends Error { kind: MicErrorKind }`
  - `interface MicAnalyser { start(onFrame: (chroma: number[], nowMs: number) => void): void; stop(): void; close(): Promise<void> }`
  - `openMic(): Promise<MicAnalyser>`

- [ ] **Step 1: Implement**

`src/race/micAnalyser.ts`:

```ts
import { foldChroma } from './chroma';

export const FFT_SIZE = 8192;
/** ~30 analysis frames per second; rAF runs at 60+, so frames are skipped. */
const FRAME_INTERVAL_MS = 1000 / 30;

export type MicErrorKind = 'denied' | 'unsupported' | 'unavailable';

export class MicError extends Error {
  constructor(public readonly kind: MicErrorKind, message: string) {
    super(message);
    this.name = 'MicError';
  }
}

export interface MicAnalyser {
  /** Start (or restart) emitting chroma frames on animation frames. */
  start(onFrame: (chroma: number[], nowMs: number) => void): void;
  /** Stop emitting; the mic stays open. */
  stop(): void;
  /** Stop, release the mic, and close the audio context. */
  close(): Promise<void>;
}

/** Open the microphone for music analysis. Call from a click handler. */
export async function openMic(): Promise<MicAnalyser> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
    throw new MicError('unsupported', 'getUserMedia/AudioContext unavailable (needs HTTPS and a modern browser)');
  }
  // Created before the first await so it is born inside the click's user
  // activation and starts running instead of suspended.
  const ctx = new AudioContext();
  let stream: MediaStream;
  try {
    // All three processors off: echo cancellation would subtract the music
    // coming out of our own speakers, noise suppression treats sustained
    // tones as noise, and AGC flattens the dynamics onsets depend on.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (err) {
    void ctx.close();
    const name = err instanceof DOMException ? err.name : '';
    const kind: MicErrorKind = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable';
    throw new MicError(kind, String(err));
  }
  if (ctx.state === 'suspended') await ctx.resume();

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0;
  // Deliberately not connected to ctx.destination: playing the mic back
  // would feed the speakers into the mic.
  source.connect(analyser);
  const bins = new Float32Array(analyser.frequencyBinCount);

  let raf = 0;
  let lastEmit = -Infinity;

  return {
    start(onFrame) {
      cancelAnimationFrame(raf);
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        // 2 ms slack so a 60 Hz display doesn't alternate 33/50 ms frames.
        if (now - lastEmit < FRAME_INTERVAL_MS - 2) return;
        lastEmit = now;
        analyser.getFloatFrequencyData(bins);
        onFrame(foldChroma(bins, ctx.sampleRate, FFT_SIZE), now);
      };
      raf = requestAnimationFrame(loop);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    async close() {
      cancelAnimationFrame(raf);
      raf = 0;
      stream.getTracks().forEach((track) => track.stop());
      source.disconnect();
      if (ctx.state !== 'closed') await ctx.close();
    },
  };
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/race`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add src/race/micAnalyser.ts
git commit -m "feat(race): microphone analyser emitting chroma frames

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Route shell, start-screen card, strings, styles

**Files:**
- Modify: `src/i18n/useLanguage.tsx` (add race keys to both `ja` and `en`)
- Modify: `src/lib/accents.ts` (add `ACCENT_RACE`)
- Modify: `src/app/globals.css` (race train, fill, idle and reveal styles)
- Modify: `src/components/StartScreen.tsx` (third mode plate linking to `/race`)
- Modify: `src/app/sitemap.ts` (add `/race`)
- Create: `src/components/race/types.ts`, `src/components/race/RaceApp.tsx`, `src/components/race/RaceEntry.tsx`, `src/app/race/page.tsx`

**Interfaces:**
- Produces:
  - `type Step = 'song' | 'lineup' | 'draw' | 'race' | 'results'`
  - `interface Entry { lineId: string; player: string }`
  - `interface SongChoice { videoId: string | null; durationSec: number; endsOnTime: boolean }`
    - `videoId: null` means "I'll play it myself".
    - `endsOnTime` is true for manual mode and live streams. Otherwise the race ends on YouTube `ENDED`.
  - `RaceApp` state: `step`, `song`, `entries`, `assignment`, `result`, plus setters. Tasks 7–10 insert their step blocks at the `{/* steps */}` anchor.
  - CSS classes: `race-train`, `race-fill`, `race-idle`, `race-reveal`, `race-primary`.

- [ ] **Step 1: Add the strings**

In `src/i18n/useLanguage.tsx`, add these entries at the end of the `ja` object, after `closeSettings: '設定を閉じる',`:

```ts
    modeRace: '電車レース',
    modeRaceTagline: '曲が電車を走らせる',
    raceNotesLabel: '音階',
    raceEnter: '遊ぶ',
    raceHome: 'トップへ',
    raceBack: '戻る',
    raceNext: '次へ',
    raceStepSong: '曲',
    raceStepLineup: '路線',
    raceStepDraw: '抽選',
    raceStepRace: 'レース',
    raceSongLabel: 'YouTubeのリンク',
    raceSongPlaceholder: 'https://youtu.be/…',
    raceSongInvalid: 'YouTubeのリンクとして読み取れません',
    raceSongLoading: '読み込み中…',
    raceSongNotEmbeddable: 'この動画はここでは再生できません。',
    raceSongUnavailable: '動画が見つからないか、再生できません。',
    raceSongLive: 'ライブ配信または長さ不明の動画です。レースの長さを選んでください。',
    racePlayMyself: '自分で再生する',
    racePlayMyselfHint: '近くの端末で曲を再生してください。マイクが聞き取ります。',
    raceLength: 'レースの長さ',
    raceMinutes: '分',
    raceLineupHint: '2〜12路線を選択',
    racePlayerName: 'プレイヤー名（任意）',
    raceDraw: '抽選',
    raceRedraw: '引き直す',
    raceToStart: 'スタートラインへ',
    raceStart: 'スタート',
    raceMicNeeded: 'マイクで曲を聞き取ります。スピーカーで再生してください。',
    raceMicDenied: 'マイクが許可されていません。アドレスバーのアイコンから許可してください。',
    raceMicUnsupported: 'マイクとHTTPS接続が必要です。',
    raceMicUnavailable: 'マイクが見つかりません。',
    raceRetry: '再試行',
    raceListening: '聞き取り中',
    raceCantHear: '曲が聞こえません — スピーカーの音量を上げてください',
    raceTapToPlay: 'タップして再生',
    racePlayNow: '今、曲を再生してください',
    racePause: '一時停止',
    raceResume: '再開',
    raceStop: '終了',
    raceNowAt: '現在',
    raceArrived: '到着',
    raceResults: '結果',
    raceFingerprint: 'この曲の音階',
    raceRematch: '再戦',
    raceNewSong: '別の曲',
```

And at the end of the `en` object, after `closeSettings: 'Close settings',`:

```ts
    modeRace: 'Train Race',
    modeRaceTagline: 'the song drives the trains',
    raceNotesLabel: 'Notes',
    raceEnter: 'Play',
    raceHome: 'Home',
    raceBack: 'Back',
    raceNext: 'Next',
    raceStepSong: 'Song',
    raceStepLineup: 'Lines',
    raceStepDraw: 'Draw',
    raceStepRace: 'Race',
    raceSongLabel: 'YouTube link',
    raceSongPlaceholder: 'https://youtu.be/…',
    raceSongInvalid: "That doesn't look like a YouTube link",
    raceSongLoading: 'Loading…',
    raceSongNotEmbeddable: "This video can't be played here.",
    raceSongUnavailable: 'Video not found or unavailable.',
    raceSongLive: 'Live stream or unknown length — choose a race length.',
    racePlayMyself: "I'll play it myself",
    racePlayMyselfHint: 'Play the song on any device nearby — the mic will listen.',
    raceLength: 'Race length',
    raceMinutes: 'min',
    raceLineupHint: 'Choose 2–12 lines',
    racePlayerName: 'Player (optional)',
    raceDraw: 'Draw',
    raceRedraw: 'Redraw',
    raceToStart: 'To the start line',
    raceStart: 'Start',
    raceMicNeeded: 'The mic listens to the song — play it through speakers.',
    raceMicDenied: 'Microphone access is blocked. Allow it from the icon in the address bar.',
    raceMicUnsupported: 'A microphone and an HTTPS connection are required.',
    raceMicUnavailable: 'No microphone found.',
    raceRetry: 'Retry',
    raceListening: 'Listening',
    raceCantHear: "Can't hear the song — turn up the speakers",
    raceTapToPlay: 'Tap to play',
    racePlayNow: 'Play your song now',
    racePause: 'Pause',
    raceResume: 'Resume',
    raceStop: 'Stop',
    raceNowAt: 'now at',
    raceArrived: 'Arrived',
    raceResults: 'Results',
    raceFingerprint: "This song's notes",
    raceRematch: 'Rematch',
    raceNewSong: 'New song',
```

- [ ] **Step 2: Add the accent and styles**

Append to `src/lib/accents.ts`:

```ts
/** Train Race: Hanzomon purple, distinct from both existing mode accents. */
export const ACCENT_RACE = '#8F76D6';
```

In `src/app/globals.css`, insert this block right after the `.band-seg { … }` rule and before the `@media (prefers-reduced-motion: reduce)` block. The global reduced-motion rule then neutralizes every transition and animation below.

```css
/* Train Race. The train is a line-colored car with a window strip; it glides
   between onset hops (short linear transition) so 30 fps state updates read
   as motion, not flicker. A finished train idles in place: "spinning its
   wheels" at the terminal, as in the reference installation. */
.race-train {
  position: absolute;
  top: 50%;
  width: 22px;
  height: 12px;
  border-radius: 3px;
  transform: translate(-50%, -50%);
  box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.18);
  transition: left 0.2s linear;
}
.race-train::after {
  content: '';
  position: absolute;
  inset: 3px 4px auto 4px;
  height: 3px;
  border-radius: 1px;
  background: rgb(255 255 255 / 0.85);
}
.race-fill {
  transition: width 0.2s linear;
}
@keyframes race-idle {
  0%, 100% { transform: translate(-50%, -50%); }
  50%      { transform: translate(calc(-50% - 2px), -50%); }
}
.race-idle {
  animation: race-idle 0.18s linear infinite;
}
@keyframes race-reveal {
  from { opacity: 0; transform: translateY(-6px) scale(0.8); }
  to   { opacity: 1; transform: none; }
}
.race-reveal {
  animation: race-reveal 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
}
/* Primary action on race steps: solid ink, the only filled control on the
   page, so "what do I press next" is never ambiguous. */
.race-primary {
  cursor: pointer;
  border-radius: 2px;
  background: var(--ink);
  color: var(--paper);
  padding: 0.5rem 1.25rem;
  font-size: 14px;
  font-weight: 500;
}
.race-primary:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
```

- [ ] **Step 3: Add the start-screen card**

In `src/components/StartScreen.tsx`:

Add the imports:

```ts
import Link from 'next/link';
import { ACCENT_AMBIENT, ACCENT_EDM, ACCENT_RACE } from '../lib/accents';
```

These replace the existing `import { ACCENT_AMBIENT, ACCENT_EDM } from '../lib/accents';` line.

Change `className="grid gap-3 sm:grid-cols-2"` on the mode `role="group"` div to `className="grid gap-3 sm:grid-cols-3"`.

Insert this after the EDM `</button>`, inside the same group div:

```tsx
            <Link
              href="/race"
              style={{ '--accent': ACCENT_RACE } as React.CSSProperties}
              className="plate group grid grid-cols-[3px_1fr_auto] items-stretch gap-x-4 rounded-[2px] border text-left"
              aria-label={`${t('raceEnter')} — ${t('modeRace')}`}
            >
              <span className="bg-[var(--accent)]" aria-hidden="true" />
              <span className="py-3">
                <span className="block text-[15px] font-bold">{t('modeRace')}</span>
                <span className="mt-0.5 block text-[12px] text-[var(--ink-2)]">{t('modeRaceTagline')}</span>
                <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 text-[12px] text-[var(--ink-2)]">
                  <dt>{t('raceNotesLabel')}</dt>
                  <dd className="tnum">12</dd>
                </dl>
              </span>
              <span className="self-center pr-4 text-[13px] font-medium text-[var(--accent-ink)]" aria-hidden="true">
                {t('raceEnter')}
              </span>
            </Link>
```

- [ ] **Step 4: Add `/race` to the sitemap**

In `src/app/sitemap.ts`, replace the doc comment and returned array with:

```ts
/** One entry per route. The sitemap is how the subdomain gets discovered
 *  independently of japantv.app, which has no link to it yet. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/race`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
```

- [ ] **Step 5: Create the route files**

`src/components/race/types.ts`:

```ts
export type Step = 'song' | 'lineup' | 'draw' | 'race' | 'results';

/** One racing lane as the players set it up. */
export interface Entry {
  lineId: string;
  player: string; // optional display name, '' when blank
}

/** The song the race is run against.
 *  videoId null = "I'll play it myself" (any source, mic only).
 *  endsOnTime = the race stops at durationSec rather than on YouTube ENDED:
 *  true for manual mode and for live streams with no real duration. */
export interface SongChoice {
  videoId: string | null;
  durationSec: number;
  endsOnTime: boolean;
}
```

`src/components/race/RaceApp.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LineConfig } from '../../types';
import linesData from '../../config/lines.json';
import { LanguageProvider, useLanguage } from '../../i18n/useLanguage';
import type { RaceState } from '../../race/raceEngine';
import type { Entry, SongChoice, Step } from './types';

const LINES = linesData as LineConfig[];
const LINES_BY_ID = new Map(LINES.map((l) => [l.id, l]));

const STEP_LABELS = [
  ['song', 'raceStepSong'],
  ['lineup', 'raceStepLineup'],
  ['draw', 'raceStepDraw'],
  ['race', 'raceStepRace'],
] as const;

function RaceInner() {
  const { language, setLanguage, t } = useLanguage();
  const [step, setStep] = useState<Step>('song');
  const [song, setSong] = useState<SongChoice | null>(null);
  const [entries, setEntriesRaw] = useState<Entry[]>([]);
  const [assignment, setAssignment] = useState<Record<string, number> | null>(null);
  const [result, setResult] = useState<RaceState | null>(null);

  // A changed lineup invalidates any previous draw.
  const setEntries = (next: Entry[]) => {
    setEntriesRaw(next);
    setAssignment(null);
  };

  const activeStep: Step = step === 'results' ? 'race' : step;

  return (
    <main className="h-screen w-screen overflow-y-auto bg-[var(--paper)] text-[var(--ink)]">
      <div className="flex h-[5px] w-full" aria-hidden="true">
        {LINES.map((line, i) => (
          <div key={line.id} className="band-seg flex-1" style={{ background: line.color, animationDelay: `${i * 18}ms` }} />
        ))}
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 pb-10 sm:px-8">
        <header className="flex items-end justify-between gap-4 pt-5 pb-4">
          <div className="min-w-0">
            <Link href="/" className="text-[12px] text-[var(--ink-2)] hover:text-[var(--ink)]">
              ← {t('raceHome')}
            </Link>
            <h1 className="text-[25px] leading-tight font-bold tracking-tight sm:text-[31px]">{t('modeRace')}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <ol className="hidden gap-3 text-[12px] text-[var(--ink-2)] sm:flex">
              {STEP_LABELS.map(([key, label], i) => (
                <li
                  key={key}
                  aria-current={activeStep === key ? 'step' : undefined}
                  className={activeStep === key ? 'font-bold text-[var(--ink)]' : undefined}
                >
                  <span className="tnum">{i + 1}</span> {t(label)}
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="chip px-2 py-1 text-[12px]"
              onClick={() => setLanguage(language === 'ja' ? 'en' : 'ja')}
            >
              {language === 'ja' ? 'EN' : '日本語'}
            </button>
          </div>
        </header>

        {/* steps */}
      </div>
    </main>
  );
}

export default function RaceApp() {
  return (
    <LanguageProvider>
      <RaceInner />
    </LanguageProvider>
  );
}
```

Until Tasks 7–10 render the step blocks, `song`, `setSong`, `entries`, `setEntries`, `assignment`, `setAssignment`, `result`, `setResult` and `LINES_BY_ID` are unused, and lint will warn about them. That's expected and goes away as each task wires its step.

`src/components/race/RaceEntry.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';

// Client-only: the race touches window, AudioContext and the YouTube API on
// mount. `ssr: false` is not allowed in a Server Component in Next 16, which
// is why this tiny client wrapper exists between page.tsx and RaceApp.
const RaceApp = dynamic(() => import('./RaceApp'), { ssr: false });

export default function RaceEntry() {
  return <RaceApp />;
}
```

`src/app/race/page.tsx`:

```tsx
import type { Metadata } from 'next';
import RaceEntry from '../../components/race/RaceEntry';
import { SITE_NAME_EN } from '../../lib/site';

const TITLE = '電車レース / Train Race';
const DESCRIPTION =
  '曲を選び、路線を選ぶ。曲の音階が電車を走らせ、どの電車が終点に一番乗りするかを競うパーティーゲーム。'
  + ' Pick a song and a train line; the notes in the song drive the trains.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/race' },
  // Page-level openGraph replaces the layout's wholesale (no deep merge), so
  // the shared fields are restated here.
  openGraph: {
    type: 'website',
    url: '/race',
    siteName: SITE_NAME_EN,
    title: TITLE,
    description: DESCRIPTION,
    locale: 'ja_JP',
    alternateLocale: ['en_US'],
  },
};

export default function RacePage() {
  return <RaceEntry />;
}
```

- [ ] **Step 6: Verify the build emits the route**

Run: `npx tsc --noEmit && npm run build && ls out/race.html`
Expected: the build succeeds, the route list includes `○ /race`, and `out/race.html` exists.

- [ ] **Step 7: Check it in the browser**

Run `npm run dev`. Open `http://localhost:3000/`:
- A third purple **電車レース** card shows next to Orchestra and EDM.
- Clicking it navigates to `/race`, which shows the line-color band, the title, the step list (曲 bold), and the EN/日本語 toggle, which switches the labels.
- **← トップへ** returns to `/`.

- [ ] **Step 8: Commit**

```bash
git add src/i18n/useLanguage.tsx src/lib/accents.ts src/app/globals.css src/components/StartScreen.tsx src/app/sitemap.ts src/components/race/types.ts src/components/race/RaceApp.tsx src/components/race/RaceEntry.tsx src/app/race/page.tsx
git commit -m "feat(race): /race route shell and start-screen entry card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Song step (YouTube player and manual fallback)

**Files:**
- Create: `src/components/race/YouTubePlayer.tsx`, `src/components/race/SongStep.tsx`
- Modify: `src/components/race/RaceApp.tsx` (render the song step)

**Interfaces:**
- Consumes: `parseYouTubeId`, `classifyYouTubeError`, `loadYouTubeApi`, `YTPlayer` (Task 4), and `SongChoice` (Task 6).
- Produces:
  - `<YouTubePlayer videoId onReady? onStateChange? onError? className? />`
    - Creates a `YT.Player` and destroys it on unmount.
    - `onError(-1)` means the API script failed to load.
    - Handlers may change between renders without recreating the player.
  - `<SongStep initial: SongChoice | null, onNext: (song: SongChoice) => void />`

- [ ] **Step 1: Create the player wrapper**

`src/components/race/YouTubePlayer.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { loadYouTubeApi, type YTPlayer } from '../../race/youtube';

interface YouTubePlayerProps {
  videoId: string;
  onReady?: (player: YTPlayer) => void;
  onStateChange?: (state: number) => void;
  onError?: (code: number) => void;
  className?: string;
}

export default function YouTubePlayer({ videoId, onReady, onStateChange, onError, className }: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handlersRef = useRef({ onReady, onStateChange, onError });
  useEffect(() => {
    handlersRef.current = { onReady, onStateChange, onError };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // YT.Player *replaces* the element it is given with an iframe. Handing it
    // a React-rendered node would corrupt React's tree, so it gets a plain
    // child div that React never knows about.
    const mount = document.createElement('div');
    host.appendChild(mount);
    let player: YTPlayer | null = null;
    let cancelled = false;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(mount, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { playsinline: 1, rel: 0 },
          events: {
            onReady: (e) => handlersRef.current.onReady?.(e.target),
            onStateChange: (e) => handlersRef.current.onStateChange?.(e.data),
            onError: (e) => handlersRef.current.onError?.(e.data),
          },
        });
      })
      .catch(() => {
        if (!cancelled) handlersRef.current.onError?.(-1);
      });

    return () => {
      cancelled = true;
      player?.destroy();
      host.replaceChildren();
    };
  }, [videoId]);

  return <div ref={hostRef} className={className} />;
}
```

- [ ] **Step 2: Create the song step**

`src/components/race/SongStep.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import { useLanguage } from '../../i18n/useLanguage';
import { classifyYouTubeError, parseYouTubeId } from '../../race/youtube';
import YouTubePlayer from './YouTubePlayer';
import type { SongChoice } from './types';

const LENGTH_OPTIONS = [2, 3, 4, 5];

/** What the preview player told us about a specific video ID. Keyed by ID so
 *  editing the URL invalidates it without an effect. */
type Probe = { id: string; status: 'ready' | 'live' | 'notEmbeddable' | 'unavailable'; durationSec: number };

interface SongStepProps {
  initial: SongChoice | null;
  onNext: (song: SongChoice) => void;
}

export default function SongStep({ initial, onNext }: SongStepProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [manual, setManual] = useState(initial !== null && initial.videoId === null);
  const [input, setInput] = useState(initial?.videoId ? `https://youtu.be/${initial.videoId}` : '');
  const [minutes, setMinutes] = useState(initial?.endsOnTime ? Math.round(initial.durationSec / 60) : 3);
  const [probe, setProbe] = useState<Probe | null>(null);

  const videoId = manual ? null : parseYouTubeId(input);
  const invalid = !manual && input.trim() !== '' && videoId === null;
  const status = videoId === null ? 'idle' : probe?.id === videoId ? probe.status : 'loading';
  const needsLength = manual || status === 'live';
  const canNext = manual || status === 'ready' || status === 'live';

  const handleNext = () => {
    if (manual) onNext({ videoId: null, durationSec: minutes * 60, endsOnTime: true });
    else if (videoId && probe && status === 'ready') onNext({ videoId, durationSec: probe.durationSec, endsOnTime: false });
    else if (videoId && status === 'live') onNext({ videoId, durationSec: minutes * 60, endsOnTime: true });
  };

  return (
    <section className="max-w-2xl">
      {!manual && (
        <>
          <label htmlFor="race-url" className="block pb-1.5 text-[12px] text-[var(--ink-2)]">{t('raceSongLabel')}</label>
          <input
            id="race-url"
            ref={inputRef}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('raceSongPlaceholder')}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'race-url-error' : undefined}
            className="w-full rounded-[2px] border border-[var(--rule)] bg-transparent px-3 py-2 text-[14px] focus:border-[var(--ink)]"
          />
          {invalid && <p id="race-url-error" className="pt-1.5 text-[12.5px] text-[#A8420B]">{t('raceSongInvalid')}</p>}

          {videoId && (
            <div className="mt-4">
              <YouTubePlayer
                key={videoId}
                videoId={videoId}
                className="aspect-video w-full overflow-hidden rounded-[2px] bg-black/5"
                onReady={(player) => {
                  const d = player.getDuration();
                  setProbe({ id: videoId, status: d > 0 ? 'ready' : 'live', durationSec: d });
                }}
                onError={(code) => {
                  setProbe({ id: videoId, status: classifyYouTubeError(code), durationSec: 0 });
                  if (classifyYouTubeError(code) === 'unavailable') inputRef.current?.focus();
                }}
              />
              <p role="status" className="pt-2 text-[12.5px] text-[var(--ink-2)]">
                {status === 'loading' && t('raceSongLoading')}
                {status === 'live' && t('raceSongLive')}
                {status === 'unavailable' && <span className="text-[#A8420B]">{t('raceSongUnavailable')}</span>}
                {status === 'notEmbeddable' && (
                  <span className="text-[#A8420B]">
                    {t('raceSongNotEmbeddable')}{' '}
                    <button type="button" className="underline" onClick={() => setManual(true)}>
                      {t('racePlayMyself')}
                    </button>
                  </span>
                )}
              </p>
            </div>
          )}
        </>
      )}

      {manual && <p className="text-[14px] text-[var(--ink-2)]">{t('racePlayMyselfHint')}</p>}

      {needsLength && (
        <div className="mt-4">
          <h2 id="race-length-label" className="pb-1.5 text-[12px] text-[var(--ink-2)]">{t('raceLength')}</h2>
          <div role="group" aria-labelledby="race-length-label" className="flex gap-2">
            {LENGTH_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m}
                onClick={() => setMinutes(m)}
                className="chip tnum px-3 py-1.5 text-[13px]"
                style={{ '--accent': 'var(--ink)' } as React.CSSProperties}
              >
                {m} {t('raceMinutes')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button type="button" className="race-primary" disabled={!canNext} onClick={handleNext}>
          {t('raceNext')}
        </button>
        <button
          type="button"
          aria-pressed={manual}
          onClick={() => setManual((m) => !m)}
          className="chip px-3 py-1.5 text-[13px]"
          style={{ '--accent': 'var(--ink)' } as React.CSSProperties}
        >
          {t('racePlayMyself')}
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Wire the song step into RaceApp**

In `src/components/race/RaceApp.tsx`, add the import:

```ts
import SongStep from './SongStep';
```

Insert this immediately above `{/* steps */}`:

```tsx
        {step === 'song' && (
          <SongStep
            initial={song}
            onNext={(next) => {
              setSong(next);
              setStep('lineup');
            }}
          />
        )}
```

- [ ] **Step 4: Typecheck, lint and check in the browser**

Run: `npx tsc --noEmit && npx eslint src/components/race src/race`
Expected: no errors. Unused-variable warnings in `RaceApp.tsx` (`entries`, `assignment`, `result`, `LINES_BY_ID` …) are expected until Task 10.

In `npm run dev` at `/race`:
- Pasting `https://youtu.be/dQw4w9WgXcQ` shows the embedded video, and **次へ** becomes enabled.
- Pasting `hello` shows the invalid-link message.
- **自分で再生する** swaps in the hint and the 2/3/4/5 分 chips.
- **次へ** advances. The step list bolds 路線 and the body is empty, because that step isn't built yet.

- [ ] **Step 5: Commit**

```bash
git add src/components/race/YouTubePlayer.tsx src/components/race/SongStep.tsx src/components/race/RaceApp.tsx
git commit -m "feat(race): song step with YouTube preview and play-it-myself fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Lineup and draw steps

**Files:**
- Create: `src/components/race/LineupStep.tsx`, `src/components/race/DrawStep.tsx`
- Modify: `src/components/race/RaceApp.tsx`

**Interfaces:**
- Consumes:
  - `groupByCompany`, `COMPANY_LABEL_KEY` (`src/lib/company.ts`)
  - `drawNotes`, `MIN_LANES`, `MAX_LANES` (Task 4)
  - `PITCH_NAMES` (Task 1)
  - `Entry` (Task 6)
- Produces:
  - `<LineupStep lines entries onChange onBack onNext />`
  - `<DrawStep linesById entries assignment onDraw onBack onNext />`

- [ ] **Step 1: Create the lineup step**

`src/components/race/LineupStep.tsx`:

```tsx
'use client';

import type { LineConfig } from '../../types';
import { useLanguage } from '../../i18n/useLanguage';
import { COMPANY_LABEL_KEY, groupByCompany } from '../../lib/company';
import { MAX_LANES, MIN_LANES } from '../../race/draw';
import type { Entry } from './types';

const MAX_PLAYER_NAME = 16;

interface LineupStepProps {
  lines: LineConfig[];
  entries: Entry[];
  onChange: (entries: Entry[]) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function LineupStep({ lines, entries, onChange, onBack, onNext }: LineupStepProps) {
  const { language, t } = useLanguage();
  const selected = new Set(entries.map((e) => e.lineId));
  const full = entries.length >= MAX_LANES;
  const byId = new Map(lines.map((l) => [l.id, l]));

  const toggle = (lineId: string) => {
    if (selected.has(lineId)) onChange(entries.filter((e) => e.lineId !== lineId));
    else if (!full) onChange([...entries, { lineId, player: '' }]);
  };

  const rename = (lineId: string, player: string) =>
    onChange(entries.map((e) => (e.lineId === lineId ? { ...e, player } : e)));

  return (
    <section>
      <p className="pb-3 text-[13px] text-[var(--ink-2)]">
        {t('raceLineupHint')} · <span className="tnum">{entries.length}/{MAX_LANES}</span>
      </p>

      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {groupByCompany(lines).map(({ company, lines: group }) => (
          <div key={company}>
            <h2 className="border-b border-[var(--rule)] pb-1 text-[12px] font-medium">{t(COMPANY_LABEL_KEY[company])}</h2>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {group.map((line) => (
                <button
                  key={line.id}
                  type="button"
                  aria-pressed={selected.has(line.id)}
                  disabled={full && !selected.has(line.id)}
                  onClick={() => toggle(line.id)}
                  className="chip py-1 pr-2.5 pl-3 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ '--accent': line.color } as React.CSSProperties}
                >
                  {language === 'ja' ? line.nameJa : line.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {entries.length > 0 && (
        <ul className="mt-6 border-t border-[var(--rule)]">
          {entries.map((entry) => {
            const line = byId.get(entry.lineId)!;
            const name = language === 'ja' ? line.nameJa : line.name;
            return (
              <li key={entry.lineId} className="grid grid-cols-[3px_minmax(0,10rem)_1fr] items-stretch gap-x-3 border-b border-[var(--rule)]">
                <span style={{ background: line.color }} aria-hidden="true" />
                <span className="self-center truncate py-1.5 text-[13.5px]">{name}</span>
                <input
                  type="text"
                  value={entry.player}
                  maxLength={MAX_PLAYER_NAME}
                  onChange={(e) => rename(entry.lineId, e.target.value)}
                  placeholder={t('racePlayerName')}
                  aria-label={`${name} — ${t('racePlayerName')}`}
                  className="my-1 rounded-[2px] border border-transparent bg-transparent px-2 py-1 text-[13px] hover:border-[var(--rule)] focus:border-[var(--ink)]"
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button type="button" className="race-primary" disabled={entries.length < MIN_LANES} onClick={onNext}>
          {t('raceNext')}
        </button>
        <button type="button" className="chip px-3 py-1.5 text-[13px]" onClick={onBack}>{t('raceBack')}</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create the draw step**

`src/components/race/DrawStep.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { LineConfig } from '../../types';
import { useLanguage } from '../../i18n/useLanguage';
import { drawNotes } from '../../race/draw';
import { PITCH_NAMES } from '../../race/chroma';
import type { Entry } from './types';

interface DrawStepProps {
  linesById: Map<string, LineConfig>;
  entries: Entry[];
  assignment: Record<string, number> | null;
  onDraw: (assignment: Record<string, number>) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function DrawStep({ linesById, entries, assignment, onDraw, onBack, onNext }: DrawStepProps) {
  const { language, t } = useLanguage();
  // Bumped per draw so the reveal animation replays on Redraw.
  const [drawSeq, setDrawSeq] = useState(0);

  const handleDraw = () => {
    onDraw(drawNotes(entries.map((e) => e.lineId)));
    setDrawSeq((n) => n + 1);
  };

  return (
    <section className="max-w-2xl">
      <ul className="border-t border-[var(--rule)]">
        {entries.map((entry, i) => {
          const line = linesById.get(entry.lineId)!;
          const pc = assignment?.[entry.lineId];
          return (
            <li key={entry.lineId} className="grid grid-cols-[3rem_3px_1fr] items-stretch gap-x-3 border-b border-[var(--rule)]">
              <span
                key={`${entry.lineId}-${drawSeq}`}
                className={`tnum self-center py-2 text-center text-[22px] font-bold ${pc !== undefined ? 'race-reveal' : 'text-[var(--rule)]'}`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {pc !== undefined ? PITCH_NAMES[pc] : '?'}
              </span>
              <span style={{ background: line.color }} aria-hidden="true" />
              <span className="self-center py-2 text-[14px]">
                {language === 'ja' ? line.nameJa : line.name}
                {entry.player && <span className="text-[var(--ink-2)]"> · {entry.player}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex items-center gap-3">
        {assignment ? (
          <>
            <button type="button" className="race-primary" onClick={onNext}>{t('raceToStart')}</button>
            <button type="button" className="chip px-3 py-1.5 text-[13px]" onClick={handleDraw}>{t('raceRedraw')}</button>
          </>
        ) : (
          <button type="button" className="race-primary" onClick={handleDraw}>{t('raceDraw')}</button>
        )}
        <button type="button" className="chip px-3 py-1.5 text-[13px]" onClick={onBack}>{t('raceBack')}</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Wire both steps into RaceApp**

In `src/components/race/RaceApp.tsx`, add the imports:

```ts
import LineupStep from './LineupStep';
import DrawStep from './DrawStep';
```

Insert this immediately above `{/* steps */}`:

```tsx
        {step === 'lineup' && (
          <LineupStep
            lines={LINES}
            entries={entries}
            onChange={setEntries}
            onBack={() => setStep('song')}
            onNext={() => setStep('draw')}
          />
        )}
        {step === 'draw' && (
          <DrawStep
            linesById={LINES_BY_ID}
            entries={entries}
            assignment={assignment}
            onDraw={setAssignment}
            onBack={() => setStep('lineup')}
            onNext={() => setStep('race')}
          />
        )}
```

- [ ] **Step 4: Typecheck, lint and check in the browser**

Run: `npx tsc --noEmit && npx eslint src/components/race src/race`
Expected: no errors. Only the `result`/`setResult` unused warnings remain.

In `npm run dev`, go through song → 路線:
- Selecting a 13th line is impossible: the other chips go disabled at 12.
- **次へ** is disabled below 2 lines.
- Player names save and are capped at 16 characters.
- 抽選 shows the notes with a staggered reveal. 引き直す re-deals and replays the reveal.
- 戻る to 路線, change a line, then 次へ: the notes are cleared back to `?`.

- [ ] **Step 5: Commit**

```bash
git add src/components/race/LineupStep.tsx src/components/race/DrawStep.tsx src/components/race/RaceApp.tsx
git commit -m "feat(race): lineup picker and note draw with reveal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Race step (lane board, live analysis loop)

**Files:**
- Create: `src/components/race/NoteBars.tsx`, `src/components/race/LaneBoard.tsx`, `src/components/race/RaceStep.tsx`
- Modify: `src/components/race/RaceApp.tsx`

**Interfaces:**
- Consumes:
  - `OnsetDetector` (Task 2)
  - `createRace`, `advance`, `frameDt`, `currentStationIndex`, `formatClock`, `RaceState` (Task 3)
  - `openMic`, `MicError`, `MicAnalyser`, `MicErrorKind` (Task 5)
  - `YT_STATE`, `YTPlayer` (Task 4)
  - `YouTubePlayer` (Task 7)
- Produces:
  - `<NoteBars values: number[] colors: (string | null)[] height: number />`
  - `noteColors(lanes, linesById): (string | null)[]`
  - `<LaneBoard linesById entries state />`
  - `<RaceStep linesById song entries assignment onBack onFinish(state: RaceState) />`

- [ ] **Step 1: Create the note bars (live chroma meter and results histogram)**

`src/components/race/NoteBars.tsx`:

```tsx
import type { LineConfig } from '../../types';
import type { Lane } from '../../race/raceEngine';
import { PITCH_NAMES } from '../../race/chroma';

/** Per pitch class: the racing line's color, or null for a note with no train. */
export function noteColors(lanes: Lane[], linesById: Map<string, LineConfig>): (string | null)[] {
  const colors: (string | null)[] = new Array(12).fill(null);
  for (const lane of lanes) colors[lane.pitchClass] = linesById.get(lane.lineId)?.color ?? null;
  return colors;
}

interface NoteBarsProps {
  values: number[];
  colors: (string | null)[];
  height: number; // px, tallest bar
}

/** Twelve bars, C to B, scaled to the largest value. Used live as the
 *  "is the mic hearing anything" meter and at the end as the song's
 *  note fingerprint (the reference installation's rail histogram). */
export default function NoteBars({ values, colors, height }: NoteBarsProps) {
  const max = Math.max(...values, 1e-9);
  return (
    <div className="flex items-end gap-[3px]" style={{ height: height + 16 }} aria-hidden="true">
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-0.5">
          <div className="w-full" style={{ height: Math.max(2, (v / max) * height), background: colors[i] ?? 'var(--rule)' }} />
          <span className="tnum text-[9.5px] leading-none text-[var(--ink-2)]">{PITCH_NAMES[i]}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create the lane board**

`src/components/race/LaneBoard.tsx`:

```tsx
import type { LineConfig } from '../../types';
import { useLanguage } from '../../i18n/useLanguage';
import { PITCH_NAMES } from '../../race/chroma';
import { currentStationIndex, formatClock, type RaceState } from '../../race/raceEngine';
import type { Entry } from './types';

interface LaneBoardProps {
  linesById: Map<string, LineConfig>;
  entries: Entry[];
  state: RaceState;
}

export default function LaneBoard({ linesById, entries, state }: LaneBoardProps) {
  const { language, t } = useLanguage();
  const players = new Map(entries.map((e) => [e.lineId, e.player]));

  return (
    <ol className="border-t border-[var(--rule)]">
      {state.lanes.map((lane) => {
        const line = linesById.get(lane.lineId)!;
        const n = lane.stationCount;
        const station = line.stations[currentStationIndex(lane)];
        const player = players.get(lane.lineId);
        const finished = lane.finishedAtSec !== null;
        return (
          <li
            key={lane.lineId}
            className="grid grid-cols-[2.25rem_3px_minmax(0,8.5rem)_1fr] items-center gap-x-3 border-b border-[var(--rule)] py-2 sm:grid-cols-[2.5rem_3px_minmax(0,11rem)_1fr]"
          >
            <span className="tnum text-center text-[15px] font-bold">{PITCH_NAMES[lane.pitchClass]}</span>
            <span className="self-stretch" style={{ background: line.color }} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-medium">
                {language === 'ja' ? line.nameJa : line.name}
                {player && <span className="font-normal text-[var(--ink-2)]"> · {player}</span>}
              </span>
              <span className="block truncate text-[11.5px] text-[var(--ink-2)]">
                {finished
                  ? `${t('raceArrived')} ${formatClock(lane.finishedAtSec!)}`
                  : `${t('raceNowAt')} ${language === 'ja' ? station.nameJa : station.name}`}
              </span>
            </span>
            <div className="relative mr-3 h-7" aria-hidden="true">
              <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-[var(--rule)]" />
              <div
                className="race-fill absolute top-1/2 left-0 h-[3px] -translate-y-1/2"
                style={{ width: `${lane.progress * 100}%`, background: line.color }}
              />
              {line.stations.map((s, i) => (
                <span
                  key={s.id}
                  className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border bg-[var(--paper)]"
                  style={{ left: `${n > 1 ? (i / (n - 1)) * 100 : 0}%`, borderColor: line.color }}
                />
              ))}
              <span className="absolute top-0 right-0 h-full w-[3px] translate-x-1/2 bg-[var(--ink)]" />
              <span
                className={`race-train${finished ? ' race-idle' : ''}`}
                style={{ left: `${lane.progress * 100}%`, background: line.color }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 3: Create the race step**

`src/components/race/RaceStep.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { LineConfig } from '../../types';
import { useLanguage } from '../../i18n/useLanguage';
import { OnsetDetector } from '../../race/onsets';
import { advance, createRace, formatClock, frameDt, type RaceState } from '../../race/raceEngine';
import { MicError, openMic, type MicAnalyser, type MicErrorKind } from '../../race/micAnalyser';
import { YT_STATE, type YTPlayer } from '../../race/youtube';
import YouTubePlayer from './YouTubePlayer';
import LaneBoard from './LaneBoard';
import NoteBars, { noteColors } from './NoteBars';
import type { Entry, SongChoice } from './types';

const COUNTDOWN_SEC = 3;
/** Seconds of race clock with no onsets before suggesting louder speakers. */
const CANT_HEAR_SEC = 8;
/** If YouTube isn't PLAYING this long after playVideo(), autoplay was blocked. */
const AUTOPLAY_GRACE_MS = 2000;

const MIC_ERROR_KEY = {
  denied: 'raceMicDenied',
  unsupported: 'raceMicUnsupported',
  unavailable: 'raceMicUnavailable',
} as const;

type Phase = 'ready' | 'countdown' | 'running';

interface RaceStepProps {
  linesById: Map<string, LineConfig>;
  song: SongChoice;
  entries: Entry[];
  assignment: Record<string, number>;
  onBack: () => void;
  onFinish: (state: RaceState) => void;
}

export default function RaceStep({ linesById, song, entries, assignment, onBack, onFinish }: RaceStepProps) {
  const { t } = useLanguage();
  const [race, setRace] = useState<RaceState>(() =>
    createRace(
      entries.map((e) => ({
        lineId: e.lineId,
        pitchClass: assignment[e.lineId],
        stationCount: linesById.get(e.lineId)!.stations.length,
      })),
      song.durationSec,
    ),
  );
  const [phase, setPhase] = useState<Phase>('ready');
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [mic, setMic] = useState<MicAnalyser | null>(null);
  const [starting, setStarting] = useState(false);
  const [micError, setMicError] = useState<MicErrorKind | null>(null);
  const [chroma, setChroma] = useState<number[]>(() => new Array(12).fill(0));
  const [cantHear, setCantHear] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [paused, setPaused] = useState(false);

  // Hot-path state lives in refs: the analysis callback runs ~30×/s outside
  // React and must see the latest values without re-subscribing.
  const raceRef = useRef(race);
  const phaseRef = useRef<Phase>('ready');
  const pausedRef = useRef(false);
  const detectorRef = useRef<OnsetDetector | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const lastOnsetAtRef = useRef(0);
  const finishedRef = useRef(false);
  const mountedRef = useRef(true);
  const onFinishRef = useRef(onFinish);
  const onFrameRef = useRef<(chroma: number[], nowMs: number) => void>(() => {});

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinishRef.current(raceRef.current);
  };

  const isPlaying = () =>
    song.videoId ? playerRef.current?.getPlayerState() === YT_STATE.PLAYING : !pausedRef.current;

  const onFrame = (frame: number[], nowMs: number) => {
    setChroma(frame);
    const detector = detectorRef.current;
    if (!detector) return;
    if (phaseRef.current === 'countdown') {
      detector.calibrate(frame);
      return;
    }
    if (phaseRef.current !== 'running' || finishedRef.current) return;
    const dt = frameDt(lastFrameRef.current, nowMs, isPlaying());
    lastFrameRef.current = nowMs;
    const onsets = detector.push(frame, nowMs);
    if (dt === 0) return;
    const next = advance(raceRef.current, onsets, dt);
    if (onsets.some(Boolean)) lastOnsetAtRef.current = next.elapsedSec;
    raceRef.current = next;
    setRace(next);
    setCantHear(next.elapsedSec - lastOnsetAtRef.current > CANT_HEAR_SEC);
    if (song.endsOnTime && next.elapsedSec >= song.durationSec) finish();
  };

  useEffect(() => {
    onFinishRef.current = onFinish;
    onFrameRef.current = onFrame;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // The mic's lifetime is this component's: opened on Start, closed on
  // unmount (results, back, or leaving the page).
  useEffect(() => {
    if (!mic) return;
    mic.start((frame, nowMs) => onFrameRef.current(frame, nowMs));
    return () => {
      void mic.close();
    };
  }, [mic]);

  // Countdown: also the room-noise calibration window, since it is the only
  // moment we know the mic hears the room and not the song.
  useEffect(() => {
    if (phase !== 'countdown') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < COUNTDOWN_SEC; i++) {
      timers.push(setTimeout(() => setCountdown(COUNTDOWN_SEC - i), i * 1000));
    }
    timers.push(setTimeout(() => {
      phaseRef.current = 'running';
      lastFrameRef.current = null;
      setPhase('running');
      if (song.videoId) playerRef.current?.playVideo();
    }, COUNTDOWN_SEC * 1000));
    return () => timers.forEach(clearTimeout);
  }, [phase, song.videoId]);

  useEffect(() => {
    if (phase !== 'running' || !song.videoId) return;
    const id = setTimeout(() => {
      if (playerRef.current?.getPlayerState() !== YT_STATE.PLAYING) setNeedsTap(true);
    }, AUTOPLAY_GRACE_MS);
    return () => clearTimeout(id);
  }, [phase, song.videoId]);

  const handleStart = async () => {
    setMicError(null);
    setStarting(true);
    try {
      const opened = await openMic();
      if (!mountedRef.current) {
        void opened.close();
        return;
      }
      detectorRef.current = new OnsetDetector();
      phaseRef.current = 'countdown';
      setCountdown(COUNTDOWN_SEC);
      setPhase('countdown');
      setMic(opened);
    } catch (err) {
      setMicError(err instanceof MicError ? err.kind : 'unavailable');
    } finally {
      setStarting(false);
    }
  };

  const handleStop = () => {
    playerRef.current?.pauseVideo();
    finish();
  };

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  const colors = noteColors(race.lanes, linesById);

  return (
    <section>
      <div className="grid gap-4 pb-4 sm:grid-cols-[minmax(0,22rem)_1fr]">
        {song.videoId ? (
          <div className="relative">
            <YouTubePlayer
              videoId={song.videoId}
              className="aspect-video w-full overflow-hidden rounded-[2px] bg-black/5"
              onReady={(player) => {
                playerRef.current = player;
              }}
              onStateChange={(state) => {
                if (state === YT_STATE.PLAYING) setNeedsTap(false);
                if (state === YT_STATE.ENDED && phaseRef.current === 'running') finish();
              }}
            />
            {needsTap && (
              <button
                type="button"
                className="race-primary absolute inset-0 m-auto h-fit w-fit"
                onClick={() => playerRef.current?.playVideo()}
              >
                {t('raceTapToPlay')}
              </button>
            )}
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-[2px] border border-[var(--rule)] p-4 text-center text-[14px] text-[var(--ink-2)]">
            {phase === 'running' ? t('racePlayNow') : t('racePlayMyselfHint')}
          </div>
        )}

        <div className="flex min-w-0 flex-col justify-between gap-3">
          {phase === 'ready' && (
            <div>
              <p className="pb-3 text-[13px] text-[var(--ink-2)]">{t('raceMicNeeded')}</p>
              {micError && (
                <p role="alert" className="pb-3 text-[13px] text-[#A8420B]">{t(MIC_ERROR_KEY[micError])}</p>
              )}
              <div className="flex gap-3">
                <button type="button" className="race-primary" disabled={starting} onClick={handleStart}>
                  {micError ? t('raceRetry') : t('raceStart')}
                </button>
                <button type="button" className="chip px-3 py-1.5 text-[13px]" onClick={onBack}>{t('raceBack')}</button>
              </div>
            </div>
          )}

          {phase === 'countdown' && (
            <div className="tnum text-[64px] leading-none font-bold" aria-live="assertive">{countdown}</div>
          )}

          {phase === 'running' && (
            <div>
              <div className="tnum text-[26px] leading-none font-medium">
                {formatClock(race.elapsedSec)}
                <span className="text-[16px] text-[var(--ink-2)]"> / {formatClock(song.durationSec)}</span>
              </div>
              {cantHear && <p role="status" className="pt-2 text-[13px] text-[#A8420B]">{t('raceCantHear')}</p>}
              <div className="flex gap-3 pt-3">
                {!song.videoId && (
                  <button type="button" className="chip px-3 py-1.5 text-[13px]" onClick={togglePause}>
                    {paused ? t('raceResume') : t('racePause')}
                  </button>
                )}
                <button type="button" className="chip px-3 py-1.5 text-[13px]" onClick={handleStop}>{t('raceStop')}</button>
              </div>
            </div>
          )}

          {phase !== 'ready' && (
            <div>
              <p className="pb-1 text-[11px] text-[var(--ink-2)]">{t('raceListening')}</p>
              <NoteBars values={chroma} colors={colors} height={28} />
            </div>
          )}
        </div>
      </div>

      <LaneBoard linesById={linesById} entries={entries} state={race} />
    </section>
  );
}
```

- [ ] **Step 4: Wire the race step into RaceApp**

In `src/components/race/RaceApp.tsx`, add the import:

```ts
import RaceStep from './RaceStep';
```

Insert this immediately above `{/* steps */}`:

```tsx
        {step === 'race' && song && assignment && (
          <RaceStep
            linesById={LINES_BY_ID}
            song={song}
            entries={entries}
            assignment={assignment}
            onBack={() => setStep('draw')}
            onFinish={(final) => {
              setResult(final);
              setStep('results');
            }}
          />
        )}
```

- [ ] **Step 5: Typecheck, lint and run the full suite**

Run: `npx tsc --noEmit && npx eslint src && npx jest src/race`
Expected: no type errors, no lint errors, and all race tests pass. Only `result` may show as unused until Task 10.

If `react-hooks/refs` flags `useRef(race)` or the `onFrame` closure, check that no `ref.current` is read in the JSX or the render body. All reads must be inside `onFrame`, `finish`, `isPlaying`, handlers or effects. Fix the code; don't disable the rule.

- [ ] **Step 6: Playtest in the browser**

Run `npm run dev`. Go through song (YouTube) → 2–3 lines → draw → **スタート**:
- Chrome asks for the mic. Allowing it starts a 3-2-1 countdown, the video starts, and the chroma meter moves.
- Trains hop forward on their notes, and the "now at" station updates.
- Pausing the video freezes the clock and the trains. Playing it again resumes.
- **終了** ends the race. The body goes empty until Task 10 adds the results step.

Then repeat these checks:
- Manual mode: the countdown runs, then 一時停止/再開 work, and the race ends on its own at the chosen length. Use 2 min and let it run.
- Deny the mic in the site settings and press スタート: the blocked-mic message and a 再試行 button appear.
- Mute the speakers mid-race: after about 8 s the "can't hear" hint appears.

- [ ] **Step 7: Commit**

```bash
git add src/components/race/NoteBars.tsx src/components/race/LaneBoard.tsx src/components/race/RaceStep.tsx src/components/race/RaceApp.tsx
git commit -m "feat(race): live lane board driven by mic onsets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Results, rematch, docs

**Files:**
- Create: `src/components/race/RaceResults.tsx`
- Modify: `src/components/race/RaceApp.tsx` (results step, remove the `{/* steps */}` anchor)
- Modify: `README.md` (describe the mode)
- Modify: `docs/superpowers/specs/2026-10-08-train-race-design.md` (record the implementation differences listed in Step 4)

**Interfaces:**
- Consumes: `standings`, `formatClock`, `RaceState` (Task 3), `NoteBars`, `noteColors` (Task 9), `PITCH_NAMES` (Task 1).
- Produces: `<RaceResults linesById entries state onRematch onNewSong />`

- [ ] **Step 1: Create the results view**

`src/components/race/RaceResults.tsx`:

```tsx
'use client';

import type { LineConfig } from '../../types';
import { useLanguage } from '../../i18n/useLanguage';
import { PITCH_NAMES } from '../../race/chroma';
import { formatClock, standings, type RaceState } from '../../race/raceEngine';
import NoteBars, { noteColors } from './NoteBars';
import type { Entry } from './types';

interface RaceResultsProps {
  linesById: Map<string, LineConfig>;
  entries: Entry[];
  state: RaceState;
  onRematch: () => void;
  onNewSong: () => void;
}

export default function RaceResults({ linesById, entries, state, onRematch, onNewSong }: RaceResultsProps) {
  const { language, t } = useLanguage();
  const players = new Map(entries.map((e) => [e.lineId, e.player]));

  return (
    <section className="max-w-2xl">
      <h2 className="pb-2 text-[12px] text-[var(--ink-2)]">{t('raceResults')}</h2>
      <ol className="border-t border-[var(--rule)]">
        {standings(state).map((lane, i) => {
          const line = linesById.get(lane.lineId)!;
          const player = players.get(lane.lineId);
          return (
            <li
              key={lane.lineId}
              className="grid grid-cols-[2rem_2.5rem_3px_1fr_auto] items-center gap-x-3 border-b border-[var(--rule)] py-2"
            >
              <span className={`tnum font-bold ${i === 0 ? 'text-[28px]' : 'text-[18px] text-[var(--ink-2)]'}`}>{i + 1}</span>
              <span className="tnum text-[15px] font-bold">{PITCH_NAMES[lane.pitchClass]}</span>
              <span className="self-stretch" style={{ background: line.color }} aria-hidden="true" />
              <span className={i === 0 ? 'text-[17px] font-bold' : 'text-[14px]'}>
                {language === 'ja' ? line.nameJa : line.name}
                {player && <span className="font-normal text-[var(--ink-2)]"> · {player}</span>}
              </span>
              <span className="tnum text-[13px] text-[var(--ink-2)]">
                {lane.finishedAtSec !== null
                  ? `${t('raceArrived')} ${formatClock(lane.finishedAtSec)}`
                  : `${Math.round(lane.progress * 100)}%`}
              </span>
            </li>
          );
        })}
      </ol>

      <h3 className="pt-6 pb-2 text-[12px] text-[var(--ink-2)]">{t('raceFingerprint')}</h3>
      <NoteBars values={state.classOnsets} colors={noteColors(state.lanes, linesById)} height={80} />

      <div className="mt-6 flex items-center gap-3">
        <button type="button" className="race-primary" onClick={onRematch}>{t('raceRematch')}</button>
        <button type="button" className="chip px-3 py-1.5 text-[13px]" onClick={onNewSong}>{t('raceNewSong')}</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire the results into RaceApp**

In `src/components/race/RaceApp.tsx`, add the import:

```ts
import RaceResults from './RaceResults';
```

Replace the `{/* steps */}` line with:

```tsx
        {step === 'results' && result && (
          <RaceResults
            linesById={LINES_BY_ID}
            entries={entries}
            state={result}
            onRematch={() => {
              setAssignment(null);
              setStep('draw');
            }}
            onNewSong={() => setStep('song')}
          />
        )}
```

- [ ] **Step 3: Update the README**

In `README.md`, in the "What it does" list after the "**Two music modes:**" bullet and its sub-bullets, add:

```markdown
- **Train Race** (`/race`) — a party game inspired by
  [Music Train](https://www.asahi-net.or.jp/~hb9t-ktd/music/English/Research/MediaArt/music_train_eng.html).
  Pick a song (YouTube, or play it from any device), pick 2–12 lines, and
  draw a random note (C…B) for each. The microphone listens; every onset of a
  line's note moves its train toward the terminal. Finishers rank by arrival
  time, the rest by distance, and the results show the song's 12-note
  fingerprint.
```

In the "Layout" block, add the line `  race/        Train Race analysis: chroma, onsets, race engine, mic, YouTube` after the `engine/` line.

- [ ] **Step 4: Record the implementation differences in the spec**

In `docs/superpowers/specs/2026-10-08-train-race-design.md`, in the "Components" section:
- Replace the `ChromaMeter.tsx` bullet with `NoteBars.tsx` (live chroma meter and results histogram, one component).
- Change the `RaceApp.tsx` bullet to: "wraps everything in `LanguageProvider` and owns the step state machine. `RaceStep.tsx` owns the mic lifecycle and the per-frame loop (`chroma → onsets → advance`), so leaving the step always releases the mic."
- Add `RaceEntry.tsx`: the client wrapper holding `dynamic(…, { ssr: false })`, required because Server Components can't use `ssr: false`.

In "User flow" step 4, change "there is a **Pause** button" to "there is a **Pause** button; both modes have **Stop**, which ends the race with the current standings".

- [ ] **Step 5: Full verification**

Run: `npx tsc --noEmit && npm run lint && npx jest src/race && npm run build && ls out/race.html`
Expected: no type errors, no lint warnings or errors, all race suites pass, the build succeeds, and `out/race.html` exists.

- [ ] **Step 6: Playtest and tune**

With `npm run dev` on a laptop, run full races through the speakers with three songs: one pop, one EDM, one ballad, each with 6+ lines. For each, note:
- (a) the leader's arrival time as a fraction of the song
- (b) how many trains finished
- (c) whether trains in silent intros moved

Then tune:
- If leaders routinely finish before about 70% or never finish, adjust `LEADER_SHARE` in `src/race/raceEngine.ts`. Raise it to slow everyone down.
- If trains move during quiet room noise, raise `SILENCE_FACTOR`.
- If trains barely move on clearly audible notes, lower `ONSET_K`.

Record each final value with a one-line playtest rationale in the constant's doc comment. Re-run `npx jest src/race`: the budget-invariance test doesn't depend on these values, but the onset tests reference `SILENCE_FACTOR` symbolically, so they should still pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/race/RaceResults.tsx src/components/race/RaceApp.tsx README.md docs/superpowers/specs/2026-10-08-train-race-design.md src/race/raceEngine.ts src/race/onsets.ts
git commit -m "feat(race): results podium, note fingerprint, rematch; docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
