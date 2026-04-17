# Tokyo Train Orchestra

A real-time sonification of the Tokyo rail network. Trains become music: each
line has a voice, arrivals trigger notes, and the whole city hums along to the
current weather and time of day.

## What it does

- **Live map** of Tokyo trains rendered with Leaflet, pan/zoom clamped to Japan.
- **Two music modes:**
  - *Classic* — each JR / metro line plays through its own instrument.
  - *EDM* — 16-voice Tone.js factory with an I–V–vi–IV pad progression, dwell
    loops that mirror station stopping time, and arrival hits mapped from
    line IDs to voices.
- **Daily vibe engine** — BPM, chord progression, and pad timbre drift with the
  current weather and hour in Tokyo.
- **Settings panel** — music mode, master volume, language (i18n), line toggles
  grouped by operating company.
- **Demo mode** — `?demoHour=N` URL param simulates a given Tokyo hour for
  testing the vibe engine. Disabled in production builds.

## Layout

```
src/
  app/          Next.js app router entry
  components/   MapView, Orchestra, HUD, SettingsPanel
  config/       Static config
  data/         TrainDataService, TimetableDataService, WeatherService, EventBus
  engine/       MusicEngine + instruments (classic) and edm* modules (EDM mode)
  i18n/         Translations
  types/        Shared types
```

Data flows **data services → `EventBus` → `MusicEngine`**. The engine subscribes
to arrival/dwell events and routes them to whichever mode is active.

## Running it

```bash
npm install
npm run dev     # Next.js dev server
npm run build   # production build
npm test        # Jest
npm run lint
```

## Working on this codebase

Next.js 16 has breaking changes from older versions. Before editing routing,
config, or framework APIs, read the relevant guide in
`node_modules/next/dist/docs/` rather than relying on memory.

## Tech

Next.js 16 · React 19 · Tone.js · Leaflet · Tailwind v4 · TypeScript · Jest
