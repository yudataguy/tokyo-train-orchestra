# EDM Music Mode — Design Spec

**Date:** 2026-04-16
**Branch:** `feat/edm-mode`
**Status:** Draft

## Problem

The app today plays the city's rail arrivals as an ambient orchestra — one instrument per line, one note per arrival, no rhythm, no tempo. This is the "orchestra" mode. It is atmospheric but it never surprises: the texture at 3 AM and the texture at 8 AM differ only in density.

We want a second mode, **EDM mode**, that turns the same arrival stream into electronic dance music whose character shifts through the day. Light activity sounds ambient; rush hour sounds like a full EDM track. The current mode stays as the default; EDM is opt-in via the Settings panel.

## Goals

- Add an EDM mode that is selectable alongside the current ambient mode.
- The base EDM track plays continuously while EDM mode is active; arrivals layer drum / bass / lead / FX hits on top.
- Rush hour vs. dead of night is clearly audible — pure arrival density, no artificial time-of-day logic.
- The mode switch is live (no page reload) and the current mode is never lost.

## Non-goals

- Time-of-day transitions that aren't driven by arrival density (no scripted "sunset drop").
- Exposing mode internals (BPM, key, progression) to the user.
- Per-user custom drum kits or sample uploads.
- Any change to the ambient mode's musical behavior.

## High-level design

### Musical architecture

| | |
|---|---|
| **Base track** | Slow evolving pad playing a 4-chord progression: **C → G → Am → F**, two bars per chord, 8-bar loop (~15.5 s at 124 BPM). Plays whenever EDM mode is active, regardless of arrivals. |
| **Tempo** | **124 BPM**, fixed. |
| **Key** | **C major** (compatible with the existing C-pentatonic used by ambient mode, so arrival notes harmonize with pad chords by construction). |
| **Quantization** | Arrivals fire on the **next 16th note**. Worst-case delay ~125 ms, imperceptible. |
| **Continuity** | The pad loop never stops while EDM mode is on. Base track is the only continuous element; every rhythmic / melodic element is triggered by arrivals. |

### Arrival → sound mapping

Each of the four company groups established in the sidebar (Tokyo Metro / Toei / JR East / Other) maps to one EDM role. Muted lines contribute nothing (existing mute logic applies unchanged).

**Tokyo Metro → per-line drums (9 distinct drum voices):**

| Line | Drum voice |
|---|---|
| Ginza | Kick |
| Marunouchi | Clap |
| Marunouchi Branch | Clap (shared) |
| Hibiya | Closed hi-hat |
| Tozai | Snare |
| Chiyoda | Open hi-hat |
| Yurakucho | Rim shot |
| Hanzomon | Low tom |
| Namboku | Shaker |
| Fukutoshin | Cowbell |

**JR East → shared bass synth.** Sawtooth mono-synth with lowpass + resonance. Each arrival fires one bass note. Pitch via the existing `stationToNote(stationIndex, totalStations, …)` helper, constrained to bass register **C2 – E3**.

**Toei → shared lead synth.** Filtered pluck-saw. One note per arrival. Pitch via `stationToNote`, constrained to mid-high register **C4 – E5**.

**Other → per-line FX one-shots (4 distinct voices):**

| Line | FX |
|---|---|
| Yurikamome | Forward riser / sweep |
| Rinkai | Reverse cymbal swell |
| Tama Monorail | Zap |
| Tsukuba Express | Impact / boom |

### Voice synthesis strategy

All voices are synthesized with Tone.js primitives — no samples, no HTTP fetching, consistent with the existing ambient engine.

- **Drums** — `MembraneSynth` (kick, low tom), `NoiseSynth` (snare, clap, closed hat, open hat, shaker), `MetalSynth` (rim shot, cowbell). **9 distinct drum voices** — Marunouchi Branch shares the Clap voice with Marunouchi main, so 10 Metro line mappings resolve to 9 underlying voices.
- **Bass** — `MonoSynth`, sawtooth oscillator, lowpass filter with moderate resonance, decay ~0.4 s. **1 voice**, shared across all 5 JR lines.
- **Lead** — `PolySynth(Synth)`, sawtooth with slight detune, filtered, pluck envelope (attack ~0.005, decay ~0.3, no sustain). **1 voice**, shared across all 4 Toei lines.
- **FX** — `NoiseSynth` with filter envelopes (riser, reverse cymbal), `MetalSynth` (zap), `MembraneSynth` with very low pitch (impact). **4 distinct voices**.
- **Pad** — `PolySynth(Synth)`, triangle wave, slow attack ~1.5 s, long release ~3 s. Plays 4-note chord voicings. **1 voice**.

**Total: 16 pre-created voices** (9 drums + 1 bass + 1 lead + 4 FX + 1 pad) at EDM-mode init, so the first arrival of each type does not incur Web Audio node creation latency (~20 ms on first use).

## Code architecture

### New files

**`src/engine/edmVoices.ts`** — factories for the 13 EDM voices. Parallels the existing `instruments.ts` pattern. Exports a single `createEdmVoices()` that returns an object keyed by voice id.

**`src/engine/edmEngine.ts`** — owns the EDM runtime:
- Starts / stops `Tone.Transport` at 124 BPM.
- Schedules the pad chord progression as a looping `Tone.Sequence`.
- Exposes `triggerArrival(lineId: string)` which maps line → voice via a lookup table and schedules the hit on the next 16th.
- Exposes `start()` and `stop()` lifecycle methods that create/dispose voices and transport state cleanly.

**`src/engine/edmMapping.ts`** — the line-id → voice-id mapping table and register clamps for bass/lead. Keys are line **`id`** values from `lines.json` (e.g. `"ginza"`, `"jr-yamanote"`, `"twr-rinkai"`, `"tama-monorail"`), not human-readable display names. Pure data, no Tone.js imports, so it is unit-testable without the Web Audio context.

### Modified files

**`src/engine/MusicEngine.ts`** — gains a `mode: 'ambient' | 'edm'` field and a `setMode(mode)` method. On mode change: stop the outgoing mode's runtime (silence ambient PolySynths, or stop EDM transport + dispose voices), then start the incoming mode. Arrival handler forwards to the active mode's trigger.

**`src/components/SettingsPanel.tsx`** — add a "Music Mode" segmented control above the Language row, matching the visual style of the existing language toggle. Two options: Ambient (default) / EDM.

**`src/i18n/useLanguage.tsx`** — three new keys: `musicMode`, `modeAmbient`, `modeEdm`, for both `ja` and `en`.

**`src/components/Orchestra.tsx`** — the component that instantiates `MusicEngine`. Holds the mode state (`useState<'ambient' | 'edm'>('ambient')`) and passes the setter into SettingsPanel and the value into MusicEngine via `setMode`.

### Data flow

```
User clicks EDM toggle in SettingsPanel
    → setMusicMode('edm') in app state
    → MusicEngine.setMode('edm')
        → stops ambient voices (releaseAll)
        → calls edmEngine.start()
            → creates 13 voices
            → starts Tone.Transport at 124 BPM
            → schedules pad chord sequence
    → future arrivals are routed to edmEngine.triggerArrival(lineId)
```

Reverse flow on toggle back to Ambient.

## Testing

- **`edmMapping.test.ts`** — unit test the line → voice lookup for every line in `lines.json`. Asserts every line has a voice, asserts register clamps produce valid pentatonic indices.
- **`edmEngine.test.ts`** — unit test `triggerArrival` with mocked Tone voices: given a lineId, the correct voice's `triggerAttackRelease` is called. Test `start()` / `stop()` lifecycle.
- **`MusicEngine.test.ts`** — extend existing tests to cover mode switch: flipping from ambient to edm silences ambient voices and starts the transport; flipping back stops the transport.
- **Manual browser test** — start the app, toggle EDM, confirm pad is audible and arrivals fire correct voices. There is no automated audio output test in this codebase.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| First mode switch after page load produces a brief glitch (AudioContext suspend/resume). | The app already handles the Web Audio unlock gesture on first interaction; mode switching happens after that point, so this is not a new risk. |
| 13 pre-created voices at init incur memory cost. | Each Tone synth is a small audio graph; total ~13 nodes × a few oscillators each. Negligible vs. the existing 18 ambient PolySynths that are always live in ambient mode. |
| User expects per-line distinct voices everywhere; JR and Toei share voices. | Pitch differentiation via `stationToNote` means each line still produces a unique note sequence even within a shared synth. Rationale documented in this spec. |
| EDM pad loop drifts against arrival quantization. | Both use `Tone.Transport` as the clock, so they share a timebase. `Tone.Sequence` and 16th-note scheduling are both transport-anchored. |
| Ambient mode breaks during refactor. | MusicEngine gains a router layer; the ambient path is preserved byte-for-byte and selected when `mode === 'ambient'`. Existing ambient tests must pass unchanged. |

## Out of scope for this spec

- Visual feedback in the map when a drum fires (e.g. pulsing station marker). Could be a follow-up once the audio side is proven.
- Arrival-density-driven pad filter sweep (sidechaining the pad to overall activity). Could enhance "vibe change" but adds complexity.
- Per-user BPM / key customization.

## Open questions

None blocking. Implementation choices deferred:
- Exact filter cutoff / resonance values on bass and FX — to be tuned during implementation with ear.
- Drum voice amplitudes — balanced by ear so kick doesn't swamp hats.
