# Tokyo Train Orchestra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time web app that sonifies Tokyo Metro train arrivals as a 9-instrument generative orchestra, displayed on a full-screen interactive map.

**Architecture:** Client-only Next.js app. Three loosely coupled layers — data (ODPT polling + diffing), audio (Tone.js music engine), visual (Leaflet map + HUD) — communicate through a simple EventBus. Static config JSON files define station/line metadata.

**Tech Stack:** Next.js 14+, React 18, TypeScript, Tone.js, Leaflet + react-leaflet, Open-Meteo API, ODPT API

**Spec:** `docs/superpowers/specs/2026-04-13-tokyo-train-orchestra-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/types/index.ts` | All shared TypeScript types (ArrivalEvent, TrainSnapshot, LineConfig, etc.) |
| `src/config/lines.json` | 9 Metro line definitions: id, name, color, instrument, station list |
| `src/data/EventBus.ts` | Generic typed pub/sub. Subscribe/emit/unsubscribe. |
| `src/engine/scales.ts` | Pentatonic pitch mapping: stationIndex → note string |
| `src/engine/instruments.ts` | 9 Tone.js instrument factory functions + configs |
| `src/engine/MusicEngine.ts` | Receives ArrivalEvents, triggers notes, manages volume scaling + weather FX |
| `src/data/TrainDataService.ts` | Polls ODPT, diffs snapshots, emits ArrivalEvents via EventBus |
| `src/data/WeatherService.ts` | Polls Open-Meteo every 10min, returns current Tokyo weather |
| `src/components/MapView.tsx` | Full-screen Leaflet map with train line paths + animated train dots |
| `src/components/HUD.tsx` | Overlay: Tokyo time, weather, now-playing ticker |
| `src/components/SettingsPanel.tsx` | Slide-out panel: volume, per-line mute, weather FX toggle |
| `src/components/Orchestra.tsx` | Top-level component wiring EventBus → MusicEngine + MapView + HUD |
| `src/app/layout.tsx` | Root layout with fonts and metadata |
| `src/app/page.tsx` | Mounts Orchestra, handles Tone.js user-gesture requirement |

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `src/app/layout.tsx`, `src/app/page.tsx`, `.env.local.example`, `.gitignore`

- [ ] **Step 1: Initialize Next.js project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

Accept defaults. This generates the full Next.js scaffold.

- [ ] **Step 2: Install dependencies**

```bash
npm install tone leaflet react-leaflet @types/leaflet
```

- [ ] **Step 3: Configure next.config.js for static export**

Replace `next.config.js` content:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
};

module.exports = nextConfig;
```

- [ ] **Step 4: Create .env.local.example**

```
NEXT_PUBLIC_ODPT_API_KEY=your_odpt_api_key_here
```

- [ ] **Step 5: Update .gitignore**

Append to existing `.gitignore`:

```
.env.local
.superpowers/
```

- [ ] **Step 6: Clean up default Next.js page**

Replace `src/app/page.tsx` with a minimal placeholder:

```tsx
export default function Home() {
  return <main>Tokyo Train Orchestra</main>;
}
```

Strip default styles from `src/app/globals.css` — keep only the Tailwind directives:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```

Expected: Successful build with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Tone.js and Leaflet deps"
```

---

### Task 2: Types & Static Config

**Files:**
- Create: `src/types/index.ts`, `src/config/lines.json`

- [ ] **Step 1: Define shared TypeScript types**

Create `src/types/index.ts`:

```ts
export interface StationConfig {
  id: string;        // e.g. "shibuya"
  name: string;      // English name
  nameJa: string;    // Japanese name
  lat: number;
  lng: number;
  index: number;     // position along line (0-based)
}

export interface LineConfig {
  id: string;           // e.g. "ginza"
  name: string;         // e.g. "Ginza"
  nameJa: string;       // e.g. "銀座線"
  color: string;        // hex color e.g. "#f77f00"
  instrument: string;   // e.g. "piano"
  odptRailway: string;  // e.g. "odpt.Railway:TokyoMetro.Ginza"
  stations: StationConfig[];
}

export interface ArrivalEvent {
  line: string;         // line id e.g. "ginza"
  station: string;      // station id e.g. "shibuya"
  stationIndex: number; // position along line
  direction: string;    // rail direction id
  trainId: string;      // stable ODPT train id
  timestamp: number;    // Date.now()
}

export interface TrainSnapshot {
  trainId: string;
  line: string;
  station: string;      // current station id (only set when at a station)
  direction: string;
}

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  condition: 'clear' | 'cloudy' | 'rain' | 'snow';
  isNight: boolean;
}

export type WeatherEffect = 'none' | 'rain' | 'clear-night' | 'snow';
```

- [ ] **Step 2: Create lines.json with all 9 Metro lines**

Create `src/config/lines.json`. This is a large static data file containing all 9 lines with their stations. The structure:

```json
[
  {
    "id": "ginza",
    "name": "Ginza",
    "nameJa": "銀座線",
    "color": "#f77f00",
    "instrument": "piano",
    "odptRailway": "odpt.Railway:TokyoMetro.Ginza",
    "stations": [
      { "id": "shibuya", "name": "Shibuya", "nameJa": "渋谷", "lat": 35.6590, "lng": 139.7016, "index": 0 },
      { "id": "omote-sando", "name": "Omote-sando", "nameJa": "表参道", "lat": 35.6654, "lng": 139.7122, "index": 1 },
      { "id": "gaiemmae", "name": "Gaiemmae", "nameJa": "外苑前", "lat": 35.6706, "lng": 139.7178, "index": 2 },
      { "id": "aoyama-itchome", "name": "Aoyama-itchome", "nameJa": "青山一丁目", "lat": 35.6727, "lng": 139.7241, "index": 3 },
      { "id": "akasaka-mitsuke", "name": "Akasaka-mitsuke", "nameJa": "赤坂見附", "lat": 35.6770, "lng": 139.7372, "index": 4 },
      { "id": "tameike-sanno", "name": "Tameike-sanno", "nameJa": "溜池山王", "lat": 35.6737, "lng": 139.7413, "index": 5 },
      { "id": "toranomon", "name": "Toranomon", "nameJa": "虎ノ門", "lat": 35.6693, "lng": 139.7497, "index": 6 },
      { "id": "shimbashi", "name": "Shimbashi", "nameJa": "新橋", "lat": 35.6662, "lng": 139.7584, "index": 7 },
      { "id": "ginza", "name": "Ginza", "nameJa": "銀座", "lat": 35.6717, "lng": 139.7637, "index": 8 },
      { "id": "kyobashi", "name": "Kyobashi", "nameJa": "京橋", "lat": 35.6769, "lng": 139.7703, "index": 9 },
      { "id": "nihombashi", "name": "Nihombashi", "nameJa": "日本橋", "lat": 35.6818, "lng": 139.7742, "index": 10 },
      { "id": "mitsukoshimae", "name": "Mitsukoshimae", "nameJa": "三越前", "lat": 35.6868, "lng": 139.7738, "index": 11 },
      { "id": "kanda", "name": "Kanda", "nameJa": "神田", "lat": 35.6919, "lng": 139.7710, "index": 12 },
      { "id": "suehirocho", "name": "Suehirocho", "nameJa": "末広町", "lat": 35.7032, "lng": 139.7716, "index": 13 },
      { "id": "ueno-hirokoji", "name": "Ueno-hirokoji", "nameJa": "上野広小路", "lat": 35.7079, "lng": 139.7726, "index": 14 },
      { "id": "ueno", "name": "Ueno", "nameJa": "上野", "lat": 35.7118, "lng": 139.7737, "index": 15 },
      { "id": "inaricho", "name": "Inaricho", "nameJa": "稲荷町", "lat": 35.7135, "lng": 139.7834, "index": 16 },
      { "id": "tawaramachi", "name": "Tawaramachi", "nameJa": "田原町", "lat": 35.7102, "lng": 139.7907, "index": 17 },
      { "id": "asakusa", "name": "Asakusa", "nameJa": "浅草", "lat": 35.7113, "lng": 139.7977, "index": 18 }
    ]
  }
]
```

Populate all 9 lines in full. The remaining 8 lines follow the same structure. Use ODPT station data for accurate coordinates. The full list:

- **Ginza** (19 stations): Shibuya → Asakusa
- **Marunouchi** (25 stations): Ogikubo → Ikebukuro
- **Hibiya** (22 stations): Naka-meguro → Kita-senju
- **Tozai** (23 stations): Nakano → Nishi-funabashi
- **Chiyoda** (20 stations): Yoyogi-uehara → Kita-ayase
- **Yurakucho** (24 stations): Wakoshi → Shin-kiba
- **Hanzomon** (14 stations): Shibuya → Oshiage
- **Namboku** (19 stations): Meguro → Akabane-iwabuchi
- **Fukutoshin** (16 stations): Wakoshi → Shibuya

Each station needs: id, name, nameJa, lat, lng, index. Research accurate coordinates from ODPT or OpenStreetMap data.

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/config/lines.json
git commit -m "feat: add shared types and Metro line/station config data"
```

---

### Task 3: EventBus

**Files:**
- Create: `src/data/EventBus.ts`, `src/data/__tests__/EventBus.test.ts`

- [ ] **Step 1: Write failing tests for EventBus**

Create `src/data/__tests__/EventBus.test.ts`:

```ts
import { EventBus } from '../EventBus';

describe('EventBus', () => {
  it('delivers events to subscribers', () => {
    const bus = new EventBus<{ arrival: { line: string } }>();
    const received: { line: string }[] = [];

    bus.on('arrival', (event) => received.push(event));
    bus.emit('arrival', { line: 'ginza' });

    expect(received).toEqual([{ line: 'ginza' }]);
  });

  it('supports multiple subscribers', () => {
    const bus = new EventBus<{ arrival: { line: string } }>();
    let count = 0;

    bus.on('arrival', () => count++);
    bus.on('arrival', () => count++);
    bus.emit('arrival', { line: 'ginza' });

    expect(count).toBe(2);
  });

  it('unsubscribes correctly', () => {
    const bus = new EventBus<{ arrival: { line: string } }>();
    const received: string[] = [];

    const unsub = bus.on('arrival', (e) => received.push(e.line));
    bus.emit('arrival', { line: 'ginza' });
    unsub();
    bus.emit('arrival', { line: 'marunouchi' });

    expect(received).toEqual(['ginza']);
  });

  it('handles multiple event types', () => {
    const bus = new EventBus<{
      arrival: { line: string };
      weather: { condition: string };
    }>();
    const arrivals: string[] = [];
    const weather: string[] = [];

    bus.on('arrival', (e) => arrivals.push(e.line));
    bus.on('weather', (e) => weather.push(e.condition));

    bus.emit('arrival', { line: 'ginza' });
    bus.emit('weather', { condition: 'rain' });

    expect(arrivals).toEqual(['ginza']);
    expect(weather).toEqual(['rain']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/data/__tests__/EventBus.test.ts --no-coverage
```

Expected: FAIL — cannot find `../EventBus`.

Note: If Jest is not configured yet, install it first:

```bash
npm install -D jest @types/jest ts-jest
npx ts-jest config:init
```

- [ ] **Step 3: Implement EventBus**

Create `src/data/EventBus.ts`:

```ts
type Listener<T> = (event: T) => void;

export class EventBus<EventMap extends Record<string, unknown>> {
  private listeners = new Map<keyof EventMap, Set<Listener<any>>>();

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.listeners.get(event)?.forEach((listener) => listener(data));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/data/__tests__/EventBus.test.ts --no-coverage
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/EventBus.ts src/data/__tests__/EventBus.test.ts jest.config.* 
git commit -m "feat: add typed EventBus with pub/sub"
```

---

### Task 4: Pentatonic Scale Mapping

**Files:**
- Create: `src/engine/scales.ts`, `src/engine/__tests__/scales.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/engine/__tests__/scales.test.ts`:

```ts
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
    // 14-station line (Hanzomon)
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/engine/__tests__/scales.test.ts --no-coverage
```

Expected: FAIL — cannot find `../scales`.

- [ ] **Step 3: Implement scales.ts**

Create `src/engine/scales.ts`:

```ts
export const PENTATONIC_NOTES = [
  'C3', 'D3', 'E3', 'G3', 'A3',
  'C4', 'D4', 'E4', 'G4', 'A4',
  'C5', 'D5', 'E5',
] as const;

export type PentatonicNote = (typeof PENTATONIC_NOTES)[number];

export function stationToNote(stationIndex: number, totalStations: number): PentatonicNote {
  const noteIndex = Math.round(
    (stationIndex / (totalStations - 1)) * (PENTATONIC_NOTES.length - 1)
  );
  return PENTATONIC_NOTES[noteIndex];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/engine/__tests__/scales.test.ts --no-coverage
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/scales.ts src/engine/__tests__/scales.test.ts
git commit -m "feat: add pentatonic scale mapping (stationIndex → note)"
```

---

### Task 5: Instrument Definitions

**Files:**
- Create: `src/engine/instruments.ts`

- [ ] **Step 1: Create instrument factory**

Create `src/engine/instruments.ts`:

```ts
import * as Tone from 'tone';

export interface InstrumentConfig {
  id: string;
  name: string;
  create: () => Tone.PolySynth | Tone.Sampler;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

const INSTRUMENT_CONFIGS: Record<string, InstrumentConfig> = {
  piano: {
    id: 'piano',
    name: 'Piano',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.2, release: 1.5 },
    }),
    attack: 0.05, decay: 0.3, sustain: 0.2, release: 1.5,
  },
  violin: {
    id: 'violin',
    name: 'Violin',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.4, release: 1.8 },
    }),
    attack: 0.1, decay: 0.2, sustain: 0.4, release: 1.8,
  },
  frenchhorn: {
    id: 'frenchhorn',
    name: 'French Horn',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.15, decay: 0.4, sustain: 0.5, release: 2.0 },
    }),
    attack: 0.15, decay: 0.4, sustain: 0.5, release: 2.0,
  },
  flute: {
    id: 'flute',
    name: 'Flute',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.08, decay: 0.2, sustain: 0.3, release: 1.2 },
    }),
    attack: 0.08, decay: 0.2, sustain: 0.3, release: 1.2,
  },
  clarinet: {
    id: 'clarinet',
    name: 'Clarinet',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square', },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.35, release: 1.4 },
    }),
    attack: 0.1, decay: 0.3, sustain: 0.35, release: 1.4,
  },
  harp: {
    id: 'harp',
    name: 'Harp',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.5, sustain: 0.1, release: 2.0 },
    }),
    attack: 0.02, decay: 0.5, sustain: 0.1, release: 2.0,
  },
  cello: {
    id: 'cello',
    name: 'Cello',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.15, decay: 0.3, sustain: 0.5, release: 2.0 },
    }),
    attack: 0.15, decay: 0.3, sustain: 0.5, release: 2.0,
  },
  marimba: {
    id: 'marimba',
    name: 'Marimba',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.05, release: 1.0 },
    }),
    attack: 0.01, decay: 0.4, sustain: 0.05, release: 1.0,
  },
  vibraphone: {
    id: 'vibraphone',
    name: 'Vibraphone',
    create: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.6, sustain: 0.15, release: 2.5 },
    }),
    attack: 0.02, decay: 0.6, sustain: 0.15, release: 2.5,
  },
};

export function getInstrumentConfig(instrument: string): InstrumentConfig {
  const config = INSTRUMENT_CONFIGS[instrument];
  if (!config) {
    throw new Error(`Unknown instrument: ${instrument}`);
  }
  return config;
}

export function getAllInstrumentIds(): string[] {
  return Object.keys(INSTRUMENT_CONFIGS);
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors. (Tone.js types should resolve.)

- [ ] **Step 3: Commit**

```bash
git add src/engine/instruments.ts
git commit -m "feat: add 9 instrument definitions with Tone.js synth configs"
```

---

### Task 6: Music Engine

**Files:**
- Create: `src/engine/MusicEngine.ts`, `src/engine/__tests__/MusicEngine.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/engine/__tests__/MusicEngine.test.ts`:

```ts
import { MusicEngine } from '../MusicEngine';
import type { ArrivalEvent, LineConfig, WeatherEffect } from '../../types';

// Mock Tone.js — it requires AudioContext which isn't available in tests
jest.mock('tone', () => ({
  PolySynth: jest.fn().mockImplementation(() => ({
    toDestination: jest.fn().mockReturnThis(),
    connect: jest.fn().mockReturnThis(),
    triggerAttackRelease: jest.fn(),
    volume: { value: 0 },
    dispose: jest.fn(),
  })),
  Synth: jest.fn(),
  Reverb: jest.fn().mockImplementation(() => ({
    toDestination: jest.fn().mockReturnThis(),
    wet: { value: 0 },
    dispose: jest.fn(),
  })),
  start: jest.fn(),
}));

const mockLine: LineConfig = {
  id: 'ginza',
  name: 'Ginza',
  nameJa: '銀座線',
  color: '#f77f00',
  instrument: 'piano',
  odptRailway: 'odpt.Railway:TokyoMetro.Ginza',
  stations: Array.from({ length: 19 }, (_, i) => ({
    id: `station-${i}`,
    name: `Station ${i}`,
    nameJa: `駅${i}`,
    lat: 35.6 + i * 0.003,
    lng: 139.7 + i * 0.003,
    index: i,
  })),
};

describe('MusicEngine', () => {
  let engine: MusicEngine;

  beforeEach(() => {
    engine = new MusicEngine([mockLine]);
  });

  afterEach(() => {
    engine.dispose();
  });

  it('initializes with line configs', () => {
    expect(engine).toBeDefined();
  });

  it('handles arrival events without throwing', () => {
    const event: ArrivalEvent = {
      line: 'ginza',
      station: 'station-5',
      stationIndex: 5,
      direction: 'asakusa',
      trainId: 'train-1',
      timestamp: Date.now(),
    };
    expect(() => engine.handleArrival(event)).not.toThrow();
  });

  it('ignores events for unknown lines', () => {
    const event: ArrivalEvent = {
      line: 'unknown',
      station: 'station-0',
      stationIndex: 0,
      direction: 'north',
      trainId: 'train-1',
      timestamp: Date.now(),
    };
    expect(() => engine.handleArrival(event)).not.toThrow();
  });

  it('sets master volume', () => {
    expect(() => engine.setMasterVolume(0.5)).not.toThrow();
  });

  it('mutes and unmutes lines', () => {
    expect(() => engine.setLineMuted('ginza', true)).not.toThrow();
    expect(() => engine.setLineMuted('ginza', false)).not.toThrow();
  });

  it('sets weather effect', () => {
    expect(() => engine.setWeatherEffect('rain')).not.toThrow();
    expect(() => engine.setWeatherEffect('none')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/engine/__tests__/MusicEngine.test.ts --no-coverage
```

Expected: FAIL — cannot find `../MusicEngine`.

- [ ] **Step 3: Implement MusicEngine**

Create `src/engine/MusicEngine.ts`:

```ts
import * as Tone from 'tone';
import type { ArrivalEvent, LineConfig, WeatherEffect } from '../types';
import { stationToNote } from './scales';
import { getInstrumentConfig } from './instruments';

interface LineState {
  config: LineConfig;
  synth: Tone.PolySynth;
  activeTrains: Set<string>;
  muted: boolean;
  baseGain: number;
}

export class MusicEngine {
  private lines = new Map<string, LineState>();
  private reverb: Tone.Reverb | null = null;
  private currentEffect: WeatherEffect = 'none';
  private masterVolume = 0.7;

  constructor(lineConfigs: LineConfig[]) {
    for (const config of lineConfigs) {
      const instrumentConfig = getInstrumentConfig(config.instrument);
      const synth = instrumentConfig.create() as Tone.PolySynth;
      synth.toDestination();

      this.lines.set(config.id, {
        config,
        synth,
        activeTrains: new Set(),
        muted: false,
        baseGain: -12, // dB
      });
    }
  }

  handleArrival(event: ArrivalEvent): void {
    const lineState = this.lines.get(event.line);
    if (!lineState || lineState.muted) return;

    lineState.activeTrains.add(event.trainId);

    // Clean up stale trains (older than 5 minutes = likely no longer active)
    // This prevents the activeTrains set from growing unboundedly
    setTimeout(() => lineState.activeTrains.delete(event.trainId), 5 * 60 * 1000);

    const totalStations = lineState.config.stations.length;
    const note = stationToNote(event.stationIndex, totalStations);

    // Volume scaling: gain = baseGain + slight boost per active train, capped
    const trainCount = lineState.activeTrains.size;
    const boost = Math.min(trainCount * 0.5, 6); // cap at +6dB
    lineState.synth.volume.value = lineState.baseGain + boost;

    const duration = '4n'; // quarter note
    lineState.synth.triggerAttackRelease(note, duration);
  }

  setMasterVolume(value: number): void {
    this.masterVolume = Math.max(0, Math.min(1, value));
    Tone.getDestination().volume.value = Tone.gainToDb(this.masterVolume);
  }

  setLineMuted(lineId: string, muted: boolean): void {
    const lineState = this.lines.get(lineId);
    if (lineState) {
      lineState.muted = muted;
    }
  }

  setWeatherEffect(effect: WeatherEffect): void {
    if (effect === this.currentEffect) return;

    // Remove existing effect
    if (this.reverb) {
      this.lines.forEach((state) => {
        state.synth.disconnect();
        state.synth.toDestination();
      });
      this.reverb.dispose();
      this.reverb = null;
    }

    // Apply new effect
    if (effect === 'rain') {
      this.reverb = new Tone.Reverb({ decay: 4, wet: 0.4 }).toDestination();
      this.lines.forEach((state) => {
        state.synth.disconnect();
        state.synth.connect(this.reverb!);
      });
    } else if (effect === 'clear-night') {
      this.reverb = new Tone.Reverb({ decay: 8, wet: 0.2 }).toDestination();
      this.lines.forEach((state) => {
        state.synth.disconnect();
        state.synth.connect(this.reverb!);
      });
    } else if (effect === 'snow') {
      // Snow: softer attack handled by reducing volume slightly + subtle reverb
      this.reverb = new Tone.Reverb({ decay: 3, wet: 0.3 }).toDestination();
      this.lines.forEach((state) => {
        state.synth.disconnect();
        state.synth.connect(this.reverb!);
        state.synth.volume.value = state.baseGain - 3; // softer
      });
    }

    this.currentEffect = effect;
  }

  dispose(): void {
    this.lines.forEach((state) => state.synth.dispose());
    this.reverb?.dispose();
    this.lines.clear();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/engine/__tests__/MusicEngine.test.ts --no-coverage
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/MusicEngine.ts src/engine/__tests__/MusicEngine.test.ts
git commit -m "feat: add MusicEngine with per-line instruments and weather FX"
```

---

### Task 7: Train Data Service

**Files:**
- Create: `src/data/TrainDataService.ts`, `src/data/__tests__/TrainDataService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/data/__tests__/TrainDataService.test.ts`:

```ts
import { TrainDataService, parseOdptTrains, diffSnapshots } from '../TrainDataService';
import type { TrainSnapshot } from '../../types';

describe('parseOdptTrains', () => {
  it('parses a train at a station', () => {
    const odptData = [
      {
        'owl:sameAs': 'odpt.Train:TokyoMetro.Ginza.A1234',
        'odpt:railway': 'odpt.Railway:TokyoMetro.Ginza',
        'odpt:fromStation': 'odpt.Station:TokyoMetro.Ginza.Shibuya',
        'odpt:toStation': null,
        'odpt:railDirection': 'odpt.RailDirection:TokyoMetro.Asakusa',
      },
    ];

    const result = parseOdptTrains(odptData);
    expect(result.size).toBe(1);

    const train = result.get('odpt.Train:TokyoMetro.Ginza.A1234');
    expect(train).toEqual({
      trainId: 'odpt.Train:TokyoMetro.Ginza.A1234',
      line: 'odpt.Railway:TokyoMetro.Ginza',
      station: 'odpt.Station:TokyoMetro.Ginza.Shibuya',
      direction: 'odpt.RailDirection:TokyoMetro.Asakusa',
    });
  });

  it('skips trains between stations', () => {
    const odptData = [
      {
        'owl:sameAs': 'odpt.Train:TokyoMetro.Ginza.A1234',
        'odpt:railway': 'odpt.Railway:TokyoMetro.Ginza',
        'odpt:fromStation': 'odpt.Station:TokyoMetro.Ginza.Shibuya',
        'odpt:toStation': 'odpt.Station:TokyoMetro.Ginza.OmoteSando',
        'odpt:railDirection': 'odpt.RailDirection:TokyoMetro.Asakusa',
      },
    ];

    const result = parseOdptTrains(odptData);
    expect(result.size).toBe(0);
  });
});

describe('diffSnapshots', () => {
  it('detects new station arrivals', () => {
    const prev = new Map<string, TrainSnapshot>([
      ['train-1', { trainId: 'train-1', line: 'ginza', station: 'shibuya', direction: 'asakusa' }],
    ]);
    const curr = new Map<string, TrainSnapshot>([
      ['train-1', { trainId: 'train-1', line: 'ginza', station: 'omote-sando', direction: 'asakusa' }],
    ]);

    const arrivals = diffSnapshots(prev, curr);
    expect(arrivals).toHaveLength(1);
    expect(arrivals[0].station).toBe('omote-sando');
  });

  it('ignores trains that did not move', () => {
    const snapshot = new Map<string, TrainSnapshot>([
      ['train-1', { trainId: 'train-1', line: 'ginza', station: 'shibuya', direction: 'asakusa' }],
    ]);

    const arrivals = diffSnapshots(snapshot, new Map(snapshot));
    expect(arrivals).toHaveLength(0);
  });

  it('detects brand new trains', () => {
    const prev = new Map<string, TrainSnapshot>();
    const curr = new Map<string, TrainSnapshot>([
      ['train-1', { trainId: 'train-1', line: 'ginza', station: 'shibuya', direction: 'asakusa' }],
    ]);

    const arrivals = diffSnapshots(prev, curr);
    expect(arrivals).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/data/__tests__/TrainDataService.test.ts --no-coverage
```

Expected: FAIL — cannot find `../TrainDataService`.

- [ ] **Step 3: Implement TrainDataService**

Create `src/data/TrainDataService.ts`:

```ts
import type { ArrivalEvent, TrainSnapshot, LineConfig } from '../types';
import { EventBus } from './EventBus';

interface OdptTrain {
  'owl:sameAs': string;
  'odpt:railway': string;
  'odpt:fromStation': string | null;
  'odpt:toStation': string | null;
  'odpt:railDirection': string;
}

export function parseOdptTrains(data: OdptTrain[]): Map<string, TrainSnapshot> {
  const snapshots = new Map<string, TrainSnapshot>();

  for (const train of data) {
    // Skip trains between stations
    if (train['odpt:toStation']) continue;
    // Skip trains with no station info
    if (!train['odpt:fromStation']) continue;

    const trainId = train['owl:sameAs'];
    snapshots.set(trainId, {
      trainId,
      line: train['odpt:railway'],
      station: train['odpt:fromStation'],
      direction: train['odpt:railDirection'],
    });
  }

  return snapshots;
}

export function diffSnapshots(
  prev: Map<string, TrainSnapshot>,
  curr: Map<string, TrainSnapshot>,
): Array<{ trainId: string; line: string; station: string; direction: string }> {
  const arrivals: Array<{ trainId: string; line: string; station: string; direction: string }> = [];

  for (const [trainId, snapshot] of curr) {
    const prevSnapshot = prev.get(trainId);
    if (!prevSnapshot || prevSnapshot.station !== snapshot.station) {
      arrivals.push({
        trainId: snapshot.trainId,
        line: snapshot.line,
        station: snapshot.station,
        direction: snapshot.direction,
      });
    }
  }

  return arrivals;
}

export class TrainDataService {
  private previousSnapshot = new Map<string, TrainSnapshot>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private consecutiveFailures = 0;
  private readonly maxRetries = 3;

  constructor(
    private apiKey: string,
    private lineConfigs: LineConfig[],
    private eventBus: EventBus<{ arrival: ArrivalEvent; error: { message: string } }>,
  ) {}

  // Map ODPT URIs to our internal line/station ids
  private resolveLineId(odptRailway: string): string | null {
    const config = this.lineConfigs.find((l) => l.odptRailway === odptRailway);
    return config?.id ?? null;
  }

  private resolveStationIndex(odptStation: string, lineConfig: LineConfig): number {
    // ODPT station URI format: odpt.Station:TokyoMetro.Ginza.Shibuya
    // Extract the station name part and match against config
    const stationPart = odptStation.split('.').pop()?.toLowerCase() ?? '';
    const station = lineConfig.stations.find(
      (s) => s.id === stationPart || s.name.toLowerCase().replace(/[^a-z]/g, '') === stationPart.toLowerCase().replace(/[^a-z]/g, ''),
    );
    return station?.index ?? -1;
  }

  async poll(): Promise<void> {
    try {
      const url = `https://api.odpt.org/api/v4/odpt:Train?odpt:operator=odpt.Operator:TokyoMetro&acl:consumerKey=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`ODPT API error: ${response.status}`);
      }

      const data: OdptTrain[] = await response.json();
      const currentSnapshot = parseOdptTrains(data);
      const rawArrivals = diffSnapshots(this.previousSnapshot, currentSnapshot);

      for (const arrival of rawArrivals) {
        const lineId = this.resolveLineId(arrival.line);
        if (!lineId) continue;

        const lineConfig = this.lineConfigs.find((l) => l.id === lineId)!;
        const stationIndex = this.resolveStationIndex(arrival.station, lineConfig);
        if (stationIndex < 0) continue;

        const stationId = lineConfig.stations[stationIndex]?.id ?? arrival.station;

        this.eventBus.emit('arrival', {
          line: lineId,
          station: stationId,
          stationIndex,
          direction: arrival.direction,
          trainId: arrival.trainId,
          timestamp: Date.now(),
        });
      }

      this.previousSnapshot = currentSnapshot;
      this.consecutiveFailures = 0;
    } catch (error) {
      this.consecutiveFailures++;
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (this.consecutiveFailures >= this.maxRetries) {
        this.eventBus.emit('error', { message: `Data unavailable: ${message}` });
      }
    }
  }

  start(intervalMs = 30_000): void {
    this.poll(); // immediate first poll
    this.intervalId = setInterval(() => this.poll(), intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/data/__tests__/TrainDataService.test.ts --no-coverage
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/TrainDataService.ts src/data/__tests__/TrainDataService.test.ts
git commit -m "feat: add TrainDataService with ODPT polling and snapshot diffing"
```

---

### Task 8: Weather Service

**Files:**
- Create: `src/data/WeatherService.ts`, `src/data/__tests__/WeatherService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/data/__tests__/WeatherService.test.ts`:

```ts
import { mapWeatherCode, WeatherService } from '../WeatherService';

describe('mapWeatherCode', () => {
  it('maps code 0 to clear', () => {
    expect(mapWeatherCode(0)).toBe('clear');
  });

  it('maps codes 1-3 to cloudy', () => {
    expect(mapWeatherCode(1)).toBe('cloudy');
    expect(mapWeatherCode(2)).toBe('cloudy');
    expect(mapWeatherCode(3)).toBe('cloudy');
  });

  it('maps rain codes (51-67) to rain', () => {
    expect(mapWeatherCode(51)).toBe('rain');
    expect(mapWeatherCode(61)).toBe('rain');
    expect(mapWeatherCode(63)).toBe('rain');
  });

  it('maps snow codes (71-77) to snow', () => {
    expect(mapWeatherCode(71)).toBe('snow');
    expect(mapWeatherCode(75)).toBe('snow');
    expect(mapWeatherCode(77)).toBe('snow');
  });

  it('maps thunderstorm codes to rain', () => {
    expect(mapWeatherCode(95)).toBe('rain');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/data/__tests__/WeatherService.test.ts --no-coverage
```

Expected: FAIL.

- [ ] **Step 3: Implement WeatherService**

Create `src/data/WeatherService.ts`:

```ts
import type { WeatherData } from '../types';

export function mapWeatherCode(code: number): WeatherData['condition'] {
  if (code === 0) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 49) return 'cloudy'; // fog codes
  if (code <= 69) return 'rain';   // drizzle + rain
  if (code <= 79) return 'snow';   // snow
  if (code <= 84) return 'rain';   // rain showers
  if (code <= 86) return 'snow';   // snow showers
  return 'rain'; // thunderstorm
}

export class WeatherService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastWeather: WeatherData | null = null;

  async fetch(): Promise<WeatherData> {
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=35.6762&longitude=139.6503&current=temperature_2m,weather_code,is_day';

    const response = await globalThis.fetch(url);
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
    const current = data.current;

    const weather: WeatherData = {
      temperature: current.temperature_2m,
      weatherCode: current.weather_code,
      condition: mapWeatherCode(current.weather_code),
      isNight: current.is_day === 0,
    };

    this.lastWeather = weather;
    return weather;
  }

  start(onUpdate: (weather: WeatherData) => void, intervalMs = 600_000): void {
    // Immediate first fetch
    this.fetch().then(onUpdate).catch(() => {});

    this.intervalId = setInterval(() => {
      this.fetch().then(onUpdate).catch(() => {});
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getLastWeather(): WeatherData | null {
    return this.lastWeather;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/data/__tests__/WeatherService.test.ts --no-coverage
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/WeatherService.ts src/data/__tests__/WeatherService.test.ts
git commit -m "feat: add WeatherService with Open-Meteo and weather code mapping"
```

---

### Task 9: MapView Component

**Files:**
- Create: `src/components/MapView.tsx`

This task builds the full-screen Leaflet map with train line paths and animated train dots.

- [ ] **Step 1: Create MapView component**

Create `src/components/MapView.tsx`:

```tsx
'use client';

import { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import type { LineConfig, ArrivalEvent } from '../types';
import 'leaflet/dist/leaflet.css';

interface ActiveTrain {
  event: ArrivalEvent;
  fadeStart: number;
}

interface MapViewProps {
  lines: LineConfig[];
  recentArrivals: ArrivalEvent[];
}

// Animated dot that fades after arrival
function TrainDot({ lat, lng, color, opacity }: { lat: number; lng: number; color: string; opacity: number }) {
  return (
    <>
      {/* Glow ring */}
      <CircleMarker
        center={[lat, lng]}
        radius={12}
        pathOptions={{ color, fillColor: color, fillOpacity: opacity * 0.2, weight: 0, stroke: false }}
      />
      {/* Core dot */}
      <CircleMarker
        center={[lat, lng]}
        radius={5}
        pathOptions={{ color, fillColor: color, fillOpacity: opacity * 0.9, weight: 0, stroke: false }}
      />
    </>
  );
}

export default function MapView({ lines, recentArrivals }: MapViewProps) {
  // Tokyo center coordinates
  const center: [number, number] = [35.6812, 139.7671];

  // Build a lookup from line+station to coordinates
  const stationLookup = useMemo(() => {
    const lookup = new Map<string, { lat: number; lng: number; color: string }>();
    for (const line of lines) {
      for (const station of line.stations) {
        lookup.set(`${line.id}:${station.id}`, { lat: station.lat, lng: station.lng, color: line.color });
      }
    }
    return lookup;
  }, [lines]);

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: '100vh', width: '100vw' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
      />

      {/* Draw each metro line as a colored polyline */}
      {lines.map((line) => (
        <Polyline
          key={line.id}
          positions={line.stations.map((s) => [s.lat, s.lng] as [number, number])}
          pathOptions={{ color: line.color, weight: 3, opacity: 0.5 }}
        />
      ))}

      {/* Render station dots for all stations (subtle) */}
      {lines.flatMap((line) =>
        line.stations.map((station) => (
          <CircleMarker
            key={`${line.id}-${station.id}`}
            center={[station.lat, station.lng]}
            radius={2}
            pathOptions={{ color: line.color, fillColor: line.color, fillOpacity: 0.3, weight: 0, stroke: false }}
          />
        )),
      )}

      {/* Render active train dots from recent arrivals */}
      {recentArrivals.map((event) => {
        const coords = stationLookup.get(`${event.line}:${event.station}`);
        if (!coords) return null;

        const age = (Date.now() - event.timestamp) / 1000;
        const opacity = Math.max(0, 1 - age / 5); // fade over 5 seconds

        return (
          <TrainDot
            key={`${event.trainId}-${event.timestamp}`}
            lat={coords.lat}
            lng={coords.lng}
            color={coords.color}
            opacity={opacity}
          />
        );
      })}
    </MapContainer>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "feat: add MapView with Leaflet dark map, line paths, and train dots"
```

---

### Task 10: HUD Component

**Files:**
- Create: `src/components/HUD.tsx`

- [ ] **Step 1: Create HUD overlay component**

Create `src/components/HUD.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import type { ArrivalEvent, LineConfig, WeatherData } from '../types';

interface HUDProps {
  lines: LineConfig[];
  recentArrivals: ArrivalEvent[];
  weather: WeatherData | null;
  onSettingsClick: () => void;
}

function getWeatherEmoji(condition: string): string {
  switch (condition) {
    case 'clear': return '\u2600\uFE0F';
    case 'cloudy': return '\u2601\uFE0F';
    case 'rain': return '\uD83C\uDF27\uFE0F';
    case 'snow': return '\u2744\uFE0F';
    default: return '';
  }
}

function TokyoTime() {
  const [time, setTime] = useState('');

  useEffect(() => {
    function update() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Tokyo',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
      );
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return <span>{time}</span>;
}

export default function HUD({ lines, recentArrivals, weather, onSettingsClick }: HUDProps) {
  const lineMap = new Map(lines.map((l) => [l.id, l]));

  // Show only the last 6 arrivals
  const displayedArrivals = recentArrivals.slice(-6);

  return (
    <>
      {/* Top-left: Time & Weather */}
      <div className="absolute top-4 left-4 z-[1000]">
        <div className="text-3xl font-bold text-white drop-shadow-lg">
          <TokyoTime />
        </div>
        <div className="text-sm text-gray-300 drop-shadow-md">
          Tokyo
          {weather && (
            <>
              {' '}&middot; {Math.round(weather.temperature)}&deg;C {getWeatherEmoji(weather.condition)}
            </>
          )}
        </div>
      </div>

      {/* Top-right: Settings button */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-2">
        <button
          onClick={onSettingsClick}
          className="w-10 h-10 bg-slate-800/80 backdrop-blur rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          aria-label="Settings"
        >
          &#9881;
        </button>
      </div>

      {/* Bottom: Now-playing ticker */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-gradient-to-t from-slate-900/95 to-transparent px-4 pt-8 pb-3">
        {displayedArrivals.length === 0 ? (
          <div className="text-gray-500 text-sm">The city sleeps...</div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-1">
            {displayedArrivals.map((event) => {
              const line = lineMap.get(event.line);
              if (!line) return null;
              const station = line.stations.find((s) => s.id === event.station);

              return (
                <div
                  key={`${event.trainId}-${event.timestamp}`}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: line.color }}
                  />
                  <span className="text-xs font-semibold" style={{ color: line.color }}>
                    {line.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {line.instrument} &middot; {station?.name ?? event.station}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/HUD.tsx
git commit -m "feat: add HUD overlay with Tokyo time, weather, and now-playing ticker"
```

---

### Task 11: Settings Panel

**Files:**
- Create: `src/components/SettingsPanel.tsx`

- [ ] **Step 1: Create SettingsPanel component**

Create `src/components/SettingsPanel.tsx`:

```tsx
'use client';

import type { LineConfig } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  lines: LineConfig[];
  mutedLines: Set<string>;
  onToggleMute: (lineId: string) => void;
  volume: number;
  onVolumeChange: (value: number) => void;
  weatherFxEnabled: boolean;
  onWeatherFxToggle: () => void;
}

export default function SettingsPanel({
  isOpen,
  onClose,
  lines,
  mutedLines,
  onToggleMute,
  volume,
  onVolumeChange,
  weatherFxEnabled,
  onWeatherFxToggle,
}: SettingsPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 bottom-0 z-[1100] w-72 bg-slate-900/95 backdrop-blur-lg border-l border-slate-700 p-5 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white font-semibold text-lg">Settings</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xl"
          aria-label="Close settings"
        >
          &times;
        </button>
      </div>

      {/* Master Volume */}
      <div className="mb-6">
        <label className="text-xs uppercase tracking-wider text-gray-500 block mb-2">
          Master Volume
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-full accent-indigo-400"
        />
      </div>

      {/* Weather FX Toggle */}
      <div className="mb-6 flex justify-between items-center">
        <label className="text-sm text-gray-300">Weather Effects</label>
        <button
          onClick={onWeatherFxToggle}
          className={`w-10 h-6 rounded-full transition-colors relative ${
            weatherFxEnabled ? 'bg-indigo-500' : 'bg-slate-600'
          }`}
          aria-label="Toggle weather effects"
        >
          <div
            className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
              weatherFxEnabled ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Per-line mute toggles */}
      <div>
        <label className="text-xs uppercase tracking-wider text-gray-500 block mb-3">
          Lines
        </label>
        <div className="space-y-2">
          {lines.map((line) => {
            const isMuted = mutedLines.has(line.id);
            return (
              <button
                key={line.id}
                onClick={() => onToggleMute(line.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isMuted ? 'opacity-40' : 'opacity-100'
                } hover:bg-slate-800`}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: line.color }}
                />
                <span className="text-sm text-gray-200 flex-1 text-left">{line.name}</span>
                <span className="text-xs text-gray-500">{line.instrument}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsPanel.tsx
git commit -m "feat: add SettingsPanel with volume, weather FX, and per-line mute"
```

---

### Task 12: Orchestra Component (Top-Level Wiring)

**Files:**
- Create: `src/components/Orchestra.tsx`
- Modify: `src/app/page.tsx`

This is the integration task — wires all layers together.

- [ ] **Step 1: Create Orchestra component**

Create `src/components/Orchestra.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import * as Tone from 'tone';
import type { ArrivalEvent, LineConfig, WeatherData, WeatherEffect } from '../types';
import { EventBus } from '../data/EventBus';
import { TrainDataService } from '../data/TrainDataService';
import { WeatherService } from '../data/WeatherService';
import { MusicEngine } from '../engine/MusicEngine';
import HUD from './HUD';
import SettingsPanel from './SettingsPanel';
import linesData from '../config/lines.json';

// Dynamically import MapView to avoid SSR issues with Leaflet
const MapView = dynamic(() => import('./MapView'), { ssr: false });

type AppEvents = {
  arrival: ArrivalEvent;
  error: { message: string };
};

export default function Orchestra() {
  const [started, setStarted] = useState(false);
  const [recentArrivals, setRecentArrivals] = useState<ArrivalEvent[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mutedLines, setMutedLines] = useState<Set<string>>(new Set());
  const [volume, setVolume] = useState(0.7);
  const [weatherFxEnabled, setWeatherFxEnabled] = useState(false);

  const eventBusRef = useRef<EventBus<AppEvents> | null>(null);
  const musicEngineRef = useRef<MusicEngine | null>(null);
  const trainServiceRef = useRef<TrainDataService | null>(null);
  const weatherServiceRef = useRef<WeatherService | null>(null);

  const lines: LineConfig[] = linesData as LineConfig[];

  const handleStart = useCallback(async () => {
    await Tone.start();

    const eventBus = new EventBus<AppEvents>();
    const musicEngine = new MusicEngine(lines);
    const apiKey = process.env.NEXT_PUBLIC_ODPT_API_KEY ?? '';
    const trainService = new TrainDataService(apiKey, lines, eventBus);
    const weatherService = new WeatherService();

    // Subscribe music engine to arrival events
    eventBus.on('arrival', (event) => {
      musicEngine.handleArrival(event);

      setRecentArrivals((prev) => {
        const next = [...prev, event];
        // Keep last 20 arrivals in state
        return next.length > 20 ? next.slice(-20) : next;
      });
    });

    // Start services
    trainService.start();
    weatherService.start((w) => setWeather(w));

    eventBusRef.current = eventBus;
    musicEngineRef.current = musicEngine;
    trainServiceRef.current = trainService;
    weatherServiceRef.current = weatherService;

    setStarted(true);
  }, [lines]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      trainServiceRef.current?.stop();
      weatherServiceRef.current?.stop();
      musicEngineRef.current?.dispose();
    };
  }, []);

  // Sync volume changes
  useEffect(() => {
    musicEngineRef.current?.setMasterVolume(volume);
  }, [volume]);

  // Sync weather FX
  useEffect(() => {
    if (!musicEngineRef.current || !weather) return;

    if (!weatherFxEnabled) {
      musicEngineRef.current.setWeatherEffect('none');
      return;
    }

    let effect: WeatherEffect = 'none';
    if (weather.condition === 'rain') effect = 'rain';
    else if (weather.condition === 'snow') effect = 'snow';
    else if (weather.condition === 'clear' && weather.isNight) effect = 'clear-night';

    musicEngineRef.current.setWeatherEffect(effect);
  }, [weather, weatherFxEnabled]);

  const handleToggleMute = useCallback((lineId: string) => {
    setMutedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
        musicEngineRef.current?.setLineMuted(lineId, false);
      } else {
        next.add(lineId);
        musicEngineRef.current?.setLineMuted(lineId, true);
      }
      return next;
    });
  }, []);

  // Start screen — required for Web Audio user gesture
  if (!started) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-bold text-white">Tokyo Train Orchestra</h1>
        <p className="text-gray-400 text-center max-w-md">
          A living orchestra driven by Tokyo&apos;s Metro system. Each line is an instrument.
          Each station arrival plays a note.
        </p>
        <button
          onClick={handleStart}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-lg"
        >
          Begin Listening
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapView lines={lines} recentArrivals={recentArrivals} />
      <HUD
        lines={lines}
        recentArrivals={recentArrivals}
        weather={weather}
        onSettingsClick={() => setSettingsOpen(true)}
      />
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        lines={lines}
        mutedLines={mutedLines}
        onToggleMute={handleToggleMute}
        volume={volume}
        onVolumeChange={setVolume}
        weatherFxEnabled={weatherFxEnabled}
        onWeatherFxToggle={() => setWeatherFxEnabled((prev) => !prev)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update page.tsx to mount Orchestra**

Replace `src/app/page.tsx`:

```tsx
import dynamic from 'next/dynamic';

const Orchestra = dynamic(() => import('../components/Orchestra'), { ssr: false });

export default function Home() {
  return <Orchestra />;
}
```

- [ ] **Step 3: Update layout.tsx**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tokyo Train Orchestra',
  description: 'A living orchestra driven by Tokyo Metro train arrivals',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 overflow-hidden">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 5: Verify dev server runs**

```bash
npm run dev
```

Open http://localhost:3000 in a browser. Expected:
- See "Tokyo Train Orchestra" start screen with "Begin Listening" button
- Click the button — map loads with dark tiles centered on Tokyo
- Train line paths visible as colored lines on the map
- HUD shows Tokyo time in top-left
- (Audio and data will work once a valid ODPT API key is configured in `.env.local`)

- [ ] **Step 6: Commit**

```bash
git add src/components/Orchestra.tsx src/app/page.tsx src/app/layout.tsx
git commit -m "feat: wire Orchestra component connecting data, audio, and visual layers"
```

---

### Task 13: Manual Integration Test

No new files. This task verifies the full end-to-end flow works.

- [ ] **Step 1: Create .env.local with ODPT API key**

```bash
echo "NEXT_PUBLIC_ODPT_API_KEY=your_actual_key_here" > .env.local
```

(The implementer must register at developer-tokyochallenge.odpt.org and get a real key.)

- [ ] **Step 2: Run the dev server and test**

```bash
npm run dev
```

Manual verification checklist:
1. Start screen appears with title and "Begin Listening" button
2. Clicking "Begin Listening" initializes audio context and shows the map
3. Dark map centered on Tokyo with colored Metro line paths
4. Tokyo time displays correctly in top-left (JST timezone)
5. Weather data appears after a few seconds
6. Train dots appear as ODPT data arrives (within 30s of first poll)
7. Notes play when train arrivals are detected
8. Each line plays its distinct instrument sound
9. Settings panel opens/closes from gear icon
10. Per-line mute toggles work (muted line stops producing sound)
11. Master volume slider works
12. Weather FX toggle changes audio character (if weather is rain/snow)
13. "The city sleeps..." message appears if no trains are running (late night JST)

- [ ] **Step 3: Fix any issues found during testing**

Address bugs discovered during manual testing. Common issues to watch for:
- Leaflet CSS not loading (may need to import in globals.css)
- Tone.js AudioContext not starting (user gesture requirement)
- ODPT station name matching failures (review station ID parsing)

- [ ] **Step 4: Run all tests**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 5: Run production build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes from end-to-end testing"
```

(Skip this step if no fixes were needed.)
