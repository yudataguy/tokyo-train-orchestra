# Tokyo Train Orchestra — Design Spec

A real-time web app that turns Tokyo's Metro train network into a living orchestra. Each train line is an instrument. When a train arrives at a station, it plays a note. The station's position along the line determines the pitch. The result: a generative, ever-changing musical piece driven by the actual pulse of Tokyo's transit system.

## Decisions

| Decision | Choice |
|----------|--------|
| Platform | Web app (browser). Mobile app as a future phase. |
| Data source | ODPT (Open Data for Public Transportation) API |
| Music mapping | Each line = one instrument. Station index along the line = pitch. |
| Instruments | Curated per line based on the line's character (see table below) |
| Scale | C pentatonic (C-D-E-G-A) across ~2.5 octaves (C3–E5, 13 notes) — always consonant |
| Scope (v1) | Tokyo Metro only: 9 lines, ~180 stations |
| Architecture | Client-only. No backend server. |
| Stack | Next.js, React, Tone.js, Leaflet (react-leaflet) |
| UI layout | Full-screen map with floating HUD overlays (time, weather, now-playing) |
| Weather | Display Tokyo time and weather. Optional audio effects toggle (default off). |

## Architecture

Three loosely coupled layers communicate through a central event bus:

```
Browser
├── TrainDataService    — polls ODPT every 30s, diffs train positions, emits ArrivalEvents
├── EventBus            — simple pub/sub distributing ArrivalEvents to subscribers
├── MusicEngine         — receives ArrivalEvents, triggers Tone.js instrument notes
├── MapView             — receives ArrivalEvents, animates train dots + station highlights
├── HUD                 — displays Tokyo time, weather, now-playing ticker
└── SettingsPanel       — volume, per-line mute toggles, weather FX toggle
```

### Data flow

1. **TrainDataService** polls the ODPT `odpt:Train` endpoint every ~30 seconds.
2. It parses the response into a map of `trainId → { line, currentStation, direction }`.
3. It diffs against the previous snapshot. For each train that changed station, it emits an `ArrivalEvent`:
   ```ts
   {
     line: "ginza",
     station: "shibuya",
     stationIndex: 14,
     direction: "asakusa",
     timestamp: number
   }
   ```
4. **MusicEngine** receives the event, looks up the line's instrument, maps `stationIndex` to a pentatonic pitch, and plays the note via Tone.js.
5. **MapView** receives the same event, animates the train dot to the station, and pulses a highlight.
6. **HUD** updates the now-playing ticker at the bottom of the screen.

## Music Engine

### Instrument assignments

| Line | Color | Instrument | Rationale |
|------|-------|-----------|-----------|
| Ginza | Orange (#f77f00) | Piano | Oldest line, classic and warm |
| Marunouchi | Red (#e60012) | Violin | Busy central artery, expressive |
| Hibiya | Silver (#b5b5ac) | French Horn | Long line, rich and sustained |
| Tozai | Sky Blue (#009bbf) | Flute | Crosstown, light and airy |
| Chiyoda | Green (#00bb85) | Clarinet | Winding through suburbs, woody |
| Yurakucho | Gold (#c1a470) | Harp | Elegant, passes through Ginza district |
| Hanzomon | Purple (#9b7cb6) | Cello | Deep stations, deep voice |
| Namboku | Teal (#00ac9b) | Marimba | North-south, percussive and warm |
| Fukutoshin | Brown (#bb641d) | Vibraphone | Newest line, shimmering and modern |

### Pitch mapping

The note set is C pentatonic across ~2.5 octaves:

```
NOTES = [C3, D3, E3, G3, A3, C4, D4, E4, G4, A4, C5, D5, E5]  // 13 notes
```

For a line with N stations (0-indexed), station `i` maps to:

```ts
noteIndex = Math.round(i / (N - 1) * (NOTES.length - 1))
note = NOTES[noteIndex]
```

This means a train traveling end-to-end traces an ascending or descending scale. The pentatonic constraint ensures any combination of simultaneous notes from different lines sounds consonant.

### Note behavior

- Soft attack (~100ms), natural decay (~1–2 seconds)
- Polyphonic: multiple trains on the same line can sound simultaneously
- Volume scales with active train count per line: `gain = baseGain * (1 + 0.05 * activeTrains)`, capped at `baseGain * 1.5`. This creates a subtle swell when many trains are active on one line.

### Weather audio effects (optional, default off)

When the user enables the weather FX toggle:

- **Rain** → adds reverb to all instruments (sound bouncing off wet streets)
- **Clear night** → longer sustain, spacious feel
- **Snow** → softer attack, muted tones

Effects are applied globally via Tone.js effect chains. The toggle is instant (crossfade in/out over ~500ms).

## UI Layout

Full-screen immersive map with floating HUD elements:

- **Map** fills the entire viewport. Dark tile style. Train lines rendered as colored paths. Active trains as pulsing dots in the line's color.
- **Top-left overlay:** Tokyo current time (large) + weather conditions (temperature, description).
- **Bottom overlay:** Now-playing ticker — horizontal strip showing recent arrivals. Each entry: line color dot, line name, instrument + note, station name. Entries fade out after a few seconds.
- **Top-right overlay:** Minimal icon buttons for settings and audio toggle.
- **Settings panel:** Slides out on demand. Master volume slider, per-line mute toggles, weather FX toggle.

Visual effects on station arrival: the station dot briefly pulses/glows in the line's color, then fades. This creates a visual "ripple" effect across the map during busy periods.

## Data Layer

### ODPT integration

- **API registration:** Free at developer-tokyochallenge.odpt.org
- **Key endpoint:** `odpt:Train` — returns current train positions per operator
- **Poll interval:** 30 seconds (ODPT data refreshes roughly every 30–60 seconds)
- **API key:** stored as `NEXT_PUBLIC_ODPT_API_KEY`, exposed client-side. Risk: anyone can extract the key from the bundle. Mitigation for v1: ODPT free tier is rate-limited and the data is public — acceptable risk. If abuse occurs, upgrade to a lightweight API route proxy (Approach 2).

**Relevant ODPT response fields** (from `odpt:Train` array items):

```json
{
  "@id": "urn:ucode:_00001C000000000000010000030C3BE4",
  "owl:sameAs": "odpt.Train:TokyoMetro.Ginza.A1234",   // ← stable train ID for diffing
  "odpt:railway": "odpt.Railway:TokyoMetro.Ginza",       // ← line identifier
  "odpt:fromStation": "odpt.Station:TokyoMetro.Ginza.Shibuya",
  "odpt:toStation": "odpt.Station:TokyoMetro.Ginza.Omotesando",
  "odpt:railDirection": "odpt.RailDirection:TokyoMetro.Asakusa",
  "dc:date": "2026-04-13T08:15:30+09:00"
}
```

- Use `owl:sameAs` as the stable `trainId` for snapshot diffing
- A train is "at a station" when `odpt:fromStation` is set and `odpt:toStation` is null (or absent)
- A train is "between stations" when both `fromStation` and `toStation` are set — **skip these; only emit ArrivalEvents for confirmed station stops**

### Error handling

- **API failure (429/500/network error):** Retry with exponential backoff (1s, 2s, 4s, max 30s). After 3 consecutive failures, show a subtle "data unavailable" indicator on the HUD. Keep the last successful snapshot — music continues from stale data until fresh data arrives.
- **Invalid API key:** Show a one-time setup prompt asking the user to enter their ODPT API key.
- **No trains running (late night):** Display "The city sleeps..." on the HUD. Silence is part of the music.

### Static data (bundled as JSON config)

Station lists, coordinates, and line metadata don't change at runtime. These are bundled as JSON files in the app:

- `config/lines.json` — 9 Metro lines: id, name, color, instrument assignment, station order
- `config/stations.json` — per-station: name (EN/JP), latitude, longitude, line index position

### Weather data

- **Source:** Open-Meteo API (free, no API key required)
- **Endpoint:** Current weather for Tokyo coordinates
- **Poll interval:** Every 10 minutes
- **Data used:** temperature, weather code (mapped to rain/clear/snow/cloudy)

## Project Structure

```
tokyo-train-orchestra/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── Orchestra.tsx        # Top-level: wires data → music + map
│   │   ├── MapView.tsx          # Leaflet full-screen map with train dots
│   │   ├── HUD.tsx              # Time, weather, now-playing ticker overlay
│   │   └── SettingsPanel.tsx    # Volume, mute, weather FX toggle
│   ├── engine/
│   │   ├── MusicEngine.ts       # Tone.js instrument management + note triggering
│   │   ├── instruments.ts       # 9 instrument definitions and Tone.js configs
│   │   └── scales.ts            # Pentatonic mapping: stationIndex → pitch
│   ├── data/
│   │   ├── TrainDataService.ts  # ODPT polling, snapshot diffing, arrival events
│   │   ├── WeatherService.ts    # Open-Meteo fetch for Tokyo conditions
│   │   └── EventBus.ts          # Pub/sub for ArrivalEvents
│   ├── config/
│   │   ├── lines.json           # Line metadata
│   │   └── stations.json        # Station metadata with coordinates
│   └── types/
│       └── index.ts             # Shared TypeScript types
├── public/
├── package.json
├── tsconfig.json
└── next.config.js
```

## Key Dependencies

- `next` + `react` — application framework
- `tone` — Web Audio synthesis (instruments, effects, scheduling)
- `leaflet` + `react-leaflet` — interactive map rendering
- No backend. No database.

## Deployment

Static export via `output: 'export'` in `next.config.js`, then `next build`. Host on Vercel, Netlify, or GitHub Pages.

## Future (out of scope for v1)

- Add Toei Subway lines (4 more instruments)
- Add JR Yamanote loop and private railways
- Mobile app (React Native or PWA)
- Shareable "moments" — snapshot a 30-second clip of the current orchestra
- Time-lapse mode — replay a full day's train data at accelerated speed
