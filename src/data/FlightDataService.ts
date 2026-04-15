import type { Aircraft } from '../types';
import { EventBus } from './EventBus';
import type { AppEvents } from './appEvents';

/**
 * Local Next.js API route that proxies OpenSky. We can't call OpenSky
 * directly from the browser because their CORS policy is locked to their
 * own origin; the proxy also batches multiple client polls behind a small
 * server-side cache so we stay inside OpenSky's per-IP rate limit.
 */
const PROXY_URL = '/api/flights';

/** OpenSky state vector — a flat array whose field order is defined by the
 *  API spec at https://openskynetwork.github.io/opensky-api/rest.html */
type OpenSkyState = [
  string,         // 0  icao24
  string | null,  // 1  callsign
  string,         // 2  origin_country
  number | null,  // 3  time_position
  number,         // 4  last_contact
  number | null,  // 5  longitude
  number | null,  // 6  latitude
  number | null,  // 7  baro_altitude (m)
  boolean,        // 8  on_ground
  number | null,  // 9  velocity (m/s)
  number | null,  // 10 true_track (deg)
  number | null,  // 11 vertical_rate
  number[] | null,// 12 sensors
  number | null,  // 13 geo_altitude (m)
  string | null,  // 14 squawk
  boolean,        // 15 spi
  number,         // 16 position_source
];

/**
 * Polls OpenSky Network's free public API every ~12 s for all aircraft in a
 * bounding box around greater Tokyo. Each poll emits a single batch event
 * containing the full current aircraft set, not per-aircraft diffs — OpenSky
 * doesn't publish deltas, and for a visual layer the full snapshot is what
 * the map component needs to render anyway.
 */
export class FlightDataService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private consecutiveFailures = 0;
  private readonly maxRetries = 3;

  constructor(private eventBus: EventBus<AppEvents>) {}

  async fetch(): Promise<void> {
    try {
      const res = await globalThis.fetch(PROXY_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { time: number; states: OpenSkyState[] | null };
      const states = data.states ?? [];

      const aircraft: Aircraft[] = [];
      for (const s of states) {
        const lat = s[6];
        const lng = s[5];
        if (lat == null || lng == null) continue; // position unknown
        aircraft.push({
          icao24: s[0],
          callsign: (s[1] ?? '').trim(),
          country: s[2],
          lat,
          lng,
          altitude: s[7] ?? s[13] ?? 0,
          heading: s[10] ?? 0,
          velocity: s[9] ?? 0,
          onGround: s[8],
        });
      }

      this.eventBus.emit('flight-batch', { aircraft, timestamp: Date.now() });
      this.consecutiveFailures = 0;
    } catch (err) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.maxRetries) {
        const message = err instanceof Error ? err.message : 'unknown';
        this.eventBus.emit('error', { message: `Flight data unavailable: ${message}` });
      }
    }
  }

  start(intervalMs = 12_000): void {
    this.fetch();
    this.intervalId = setInterval(() => this.fetch(), intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
