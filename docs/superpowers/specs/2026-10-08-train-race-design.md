# Train Race Mode — Design Spec

**Date:** 2026-10-08
**Branch:** `feat/train-race`
**Status:** Draft
**Inspiration:** [Music Train](https://www.asahi-net.or.jp/~hb9t-ktd/music/English/Research/MediaArt/music_train_eng.html) — twelve N-gauge trains on twelve rails, one per pitch class. Each MIDI key press moves that note's train forward, so the trains' final positions are a histogram of the song's notes.

## Problem

The app turns trains into music. This mode does the reverse: music drives the trains, and the result is a party game. A group around one screen picks a song, each player bets on a train line, and the song decides which train wins.

## Goals

- A new route, `/race`, reachable from a third card on the start screen.
- Pick a song from a YouTube link, or play it from any other source.
- Players pick 2–12 lines. Each is assigned a random pitch class (C … B).
- The microphone listens to the song. Each onset of a line's pitch class moves its train forward along the line's real stations.
- The race runs for the whole song. Trains that reach the terminal are ranked by arrival time, and the rest by distance.
- The results show a podium and the song's 12-note histogram.

## Non-goals

- Online or multi-device play. One shared screen only, with no backend.
- Reading YouTube audio directly. It isn't possible: the iframe is cross-origin.
- File upload, tab-audio capture, or ML transcription (basic-pitch).
- Fixed line→note mappings or any strategy beyond picking a line.
- Guaranteed iOS Safari support (see Risks).
- Synth sound in this mode. The song is the only audio, and any sound we made would leak into the mic.

## User flow

`/race` is one page with a small state machine: `song → lineup → draw → race → results`.

1. **Song**
   - Paste a YouTube URL. Accepted forms: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `music.youtube.com/watch?v=`. A valid ID loads an embedded preview, and invalid input shows an inline error.
   - Fallback, **"I'll play it myself"**: choose a race length of 2, 3, 4 or 5 minutes and play the song on any device in earshot.
2. **Lineup**
   - Choose 2–12 lines from the roster, grouped by operator like the start screen.
   - Each chosen lane takes an optional player name (max 16 chars).
3. **Draw** — pressing **抽選 / Draw** shuffles the 12 pitch classes and assigns one to each chosen line, with a short reveal animation. Unassigned pitch classes still count toward the movement budget (below) but have no train.
4. **Race**
   - Pressing **Start** requests the mic and creates or resumes the `AudioContext` inside that click, so it counts as the user gesture. Then a 3-2-1 countdown runs and `playVideo()` is called.
   - The race clock runs only while the player reports `PLAYING`, and the YouTube `ENDED` event ends the race.
   - In "play it myself" mode the clock starts after the countdown. The race ends at the chosen length or on **Stop**, and there is a **Pause** button. Both modes have **Stop**, which ends the race with the current standings.
5. **Results**
   - A podium: finishers by arrival time, then the rest by distance.
   - A 12-bar histogram of onset counts per pitch class.
   - **Rematch** (same song, new draw) and **New song**.

## Race view (lane board)

One horizontal lane per racing line, all the same length (normalized, 0 → 1). Each lane shows, from left to right:

- the assigned note (e.g. `A#`)
- the line color bar and name (Japanese or English, following the current language)
- the optional player name
- the track, with station `i` of `n` placed at `i / (n − 1)`
- the train
- a finish post

Under the train is "now at <station>", the station at `floor(progress · (n − 1))`. A finished train sits at the post with a spinning-wheels idle animation and its finish time.

Above the board: the video, a playback time readout, and a live 12-bin chroma meter. The meter is how players see that the mic is hearing the song.

With reduced motion enabled, trains jump between positions instead of tweening, and the idle animation is off.

## Audio analysis

### Mic input (`src/race/micAnalyser.ts`)

`getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`. All three must be off: with any of them on, the browser treats the music as echo or noise and removes it, or levels it out.

The pipeline is a plain `AudioContext` (no Tone.js on this route) → `MediaStreamSource` → `AnalyserNode` with `fftSize = 8192` and `smoothingTimeConstant = 0`. Each frame, `getFloatFrequencyData` is passed to the chroma fold.

The loop runs on `requestAnimationFrame`, which is capped at about 30 Hz by skipping frames. It stops when the tab is hidden, so the race pauses too. That's acceptable for a shared screen.

### Chroma (`src/race/chroma.ts`)

`foldChroma(freqDb: Float32Array, sampleRate: number, fftSize: number): number[]` returns 12 non-negative energies, indexed C=0 … B=11.

- Only bins between C3 (130.81 Hz) and C7 (2093 Hz) count. Below C3, a bin (≈5.9 Hz at 48 kHz) is wider than half a semitone gap, so neighboring notes blur together.
- Each bin's dB value is converted to linear magnitude, then added to pitch class `round(12 · log2(f / 440) + 9) mod 12`.
- Only spectral peaks (local maxima) count. A note that starts inside the ~170 ms window has a widened main lobe whose shoulders fall in neighbouring semitones' bins. Summing every bin made every attack light up C#, D# and so on next to the real note (found in playtest).

### Onsets (`src/race/onsets.ts`)

`class OnsetDetector { push(chroma: number[], nowMs: number): boolean[] }`

- Per class, the flux is `max(0, energy − previousEnergy)`.
- An onset fires when the flux is greater than `mean + ONSET_K · stddev`, computed over that class's last `ONSET_WINDOW` frames.
- After an onset, the class is in a refractory period: no new onset for `ONSET_REFRACTORY_MS` (120 ms).
- Relative floor: a class's flux must also be at least `ONSET_REL_MIN = 0.1` × the loudest class's energy in that frame, so quiet classes rising in lockstep with a loud attack (leakage, transients) don't fire (found in playtest).
- Loudness gate: if the total chroma energy is below the silence floor, no onsets fire. Room hum must not move trains.
- The floor is calibrated, not hard-coded: during the 3-2-1 countdown, before the video plays, the detector records the room's mean total chroma energy, and the floor becomes `SILENCE_FACTOR` × that value. Mic sensitivity varies too much between devices for a fixed number to work. `OnsetDetector` exposes `calibrate(chroma)` for the countdown frames and `push` for the race.

Starting values, tuned in playtest: `ONSET_K = 1.5`, `ONSET_WINDOW = 30` frames (≈1 s), `ONSET_REFRACTORY_MS = 120`, `SILENCE_FACTOR = 2`. All are exported from the module.

## Race engine (`src/race/raceEngine.ts`)

Pure. No DOM and no audio.

### Movement budget

If every onset were a fixed step, a dense EDM track would finish in seconds and a sparse ballad might never finish. So each onset's step is scaled by the recent onset rate across all 12 classes:

```
step = BUDGET / max(rateEma, RATE_MIN)
```

- `rateEma` is the exponential moving average, over about 4 s, of total onsets per second across all 12 classes. It is seeded with `RATE_PRIOR`.
- `BUDGET` is the total distance handed out per second across all classes. A class whose share of onsets is `s` therefore moves about `s · BUDGET` per second, whatever the song's density.
- `RATE_MIN` caps the step size after a silence.
- Starting values: `RATE_PRIOR = 6`/s, `RATE_MIN = 2`/s, EMA time constant `RATE_TAU = 4` s.

### Calibration

The finish line is at 1.0. `BUDGET` is set so that a typical leader, with `LEADER_SHARE = 0.18` of all onsets, finishes at `FINISH_AT = 0.85` of the song:

```
BUDGET = 1 / (LEADER_SHARE · FINISH_AT · durationSec)
```

### API

- `createRace(lanes: { lineId, pitchClass, stationCount }[], durationSec): RaceState`
- `advance(state, onsets: boolean[], dtSec): RaceState`
  - Returns a new state (immutable).
  - `dtSec = 0` (paused) means no time passes and nothing moves, even if onsets arrive.
  - Progress is clamped at 1.0. The first frame at which a lane reaches 1.0 records its `finishedAtSec`.
  - Per-class onset counts accumulate for all 12 classes, for the histogram.
- `standings(state)`:
  1. finished lanes, by `finishedAtSec` ascending
  2. unfinished lanes, by progress descending
  3. ties broken by onset count, then by draw order

## Supporting modules

- **`src/race/draw.ts`**: `drawNotes(lineIds: string[], rng: () => number): Record<string, number>`. A Fisher–Yates shuffle of 0–11, taking the first `lineIds.length`. Throws if there are fewer than 2 or more than 12 lines.
- **`src/race/youtube.ts`**:
  - `parseYouTubeId(input: string): string | null` (pure)
  - `loadYouTubeApi(): Promise<typeof YT>` loads `https://www.youtube.com/iframe_api` once and resolves on `onYouTubeIframeAPIReady`. The `YT` types are declared locally, with no new dependency.

## Components

- **`src/app/race/page.tsx`**: route entry. Dynamically imports `RaceApp` with `ssr: false`, like `page.tsx` → `Orchestra`, and exports page `metadata` (title and description).
- **`src/components/race/RaceEntry.tsx`**: the client wrapper holding `dynamic(…, { ssr: false })`, required because Server Components can't use `ssr: false`.
- **`src/components/race/RaceApp.tsx`**: wraps everything in `LanguageProvider` and owns the step state machine. `RaceStep.tsx` owns the mic lifecycle and the per-frame loop (`chroma → onsets → advance`), so leaving the step always releases the mic. It keeps the hot race state in a ref and commits it to React state once per analysis frame.
- **`src/components/race/`** step components:
  - `SongStep.tsx`
  - `LineupStep.tsx`
  - `DrawReveal.tsx`
  - `LaneBoard.tsx`
  - `NoteBars.tsx` (live chroma meter and results histogram, one component)
  - `RaceResults.tsx`
  - `YouTubePlayer.tsx`, which wraps `YT.Player` and exposes `onStateChange`, `onError`, `getDuration`, `playVideo` and `pauseVideo`.

All step components use the existing station-timetable design system: the `paper` surface, plates, line color bars, and `tnum` digits.

## Changes to existing files

- **`StartScreen.tsx`**: a third mode plate, **電車レース / Train Race**, rendered as `next/link` `<Link href="/race">` with the same plate styling. The mode grid becomes `sm:grid-cols-3`.
- **`lib/accents.ts`**: `ACCENT_RACE = '#8F76D6'` (Hanzomon purple, an official line color like the other two accents).
- **`i18n/useLanguage.tsx`**: all race strings, in both `ja` and `en`.
- **`app/sitemap.ts`**: add `${SITE_URL}/race`.

## Error handling

| Condition | Behavior |
|---|---|
| Unparseable URL | Inline error. **Next** is disabled. |
| YT error 101 / 150 (embedding disabled) | "This video can't be played here." Offers **Play it myself**, pre-filling the race length from the duration when it is known. |
| YT error 2 / 5 / 100 | "Video not found or unavailable." Focus returns to the URL field. |
| `getDuration()` returns 0 (live stream) | Switch to the manual race-length picker. |
| Mic permission denied | Explains how to re-allow the mic from the address bar, with a **Retry** button. The race cannot start. No simulated fallback. |
| No mic, or insecure context (`navigator.mediaDevices` undefined) | Says a microphone and HTTPS are required. |
| No onsets for 8 s while `PLAYING` | A non-blocking hint: "Can't hear the song — turn up the speakers." |
| Tab hidden | The analysis loop stops and the race clock stops with it. |

## Risks

- **iOS Safari:** turning on the mic switches iOS into a call-style audio mode that can send playback to the earpiece, and the mic then hears very little. The main target is a laptop or desktop driving a TV or speakers. Phones are best-effort.
- **Autoplay after the countdown:** `playVideo()` runs about 3 s after the click. Sticky user activation should allow it. If the player doesn't reach `PLAYING` within 2 s, show a "Tap to play" button on the video.
- **Tuning:** `ONSET_K`, `SILENCE_FACTOR`, `RATE_PRIOR`, `LEADER_SHARE` and `FINISH_AT` are guesses until playtested.

## Testing

**Jest unit tests**, colocated in `src/race/__tests__/`:

- **chroma**
  - A synthetic 440 Hz spectrum is strongest at A (9).
  - A-major (A, C#, E) gives those three as the top three.
  - Energy below C3 or above C7 is ignored.
- **onsets**
  - Calibration sets the floor to `SILENCE_FACTOR` × the countdown mean.
  - A step input fires exactly one onset.
  - A held tone does not refire.
  - Two steps closer together than the refractory period fire once.
  - Input below the silence floor fires nothing.
- **raceEngine**
  - Budget property: a sparse and a dense onset stream with the same class shares give total distances within 10% of each other over the same duration.
  - Finish order is recorded and progress is clamped at 1.0.
  - `dtSec = 0` moves nothing.
  - `standings` orders finishers, non-finishers and ties correctly.
- **draw**: classes are unique, the same seed gives the same result, and fewer than 2 or more than 12 lines throws.
- **parseYouTubeId**: a table of valid and invalid URL shapes.

**Build:** `npm run build` emits `out/race.html`, and `npm run lint` and `npm test` pass.

**Playtest:** three songs (pop, EDM, ballad) through laptop speakers to tune the constants. Record the final values, with a one-line rationale each, as comments next to the constants.
