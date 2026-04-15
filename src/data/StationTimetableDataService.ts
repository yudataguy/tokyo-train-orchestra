import type { ArrivalEvent, LineConfig } from '../types';
import { EventBus } from './EventBus';
import type { AppEvents } from './appEvents';
import {
  hashOffset,
  pickCalendar,
  tokyoHHMM,
  type Calendar,
} from './TimetableDataService';
import { loadTimetables } from './timetableCache';

/**
 * Per-station departure entry. Tokyo Metro TrainTimetable keys by train; this
 * format keys by station — matching what ODPT exposes for lines like Yurikamome
 * where only StationTimetable access is granted.
 */
export interface StationDeparture {
  t: string; // HH:MM
  s: number; // station index
  d: string; // rail direction (trailing URI segment)
}

export type StationTimetable = Record<Calendar, StationDeparture[]>;

export type StationTimetableData = Record<string, StationTimetable>;

export interface StationArrivalHit {
  stationIndex: number;
  direction: string;
}

export function findStationDeparturesAt(
  departures: StationDeparture[],
  hhmm: string,
): StationArrivalHit[] {
  // The fetch script sorts by time so we could binary search, but a linear
  // scan over ~7k entries per line is already well under a millisecond.
  const hits: StationArrivalHit[] = [];
  for (const d of departures) {
    if (d.t === hhmm) hits.push({ stationIndex: d.s, direction: d.d });
  }
  return hits;
}

/**
 * Emits scheduled departures (treated as arrivals for sonification) from
 * per-station timetable data. Shares the minute-rollover + hash-spread
 * pattern with TimetableDataService, but consumes the station-keyed format.
 */
export class StationTimetableDataService {
  private data: StationTimetableData | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastFiredMinute = '';
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    private lines: LineConfig[],
    private eventBus: EventBus<AppEvents>,
    private fetchUrl = '/station-timetables.json',
    private versionUrl = '/station-timetables-version.json',
  ) {}

  async start(): Promise<void> {
    try {
      const payload = await loadTimetables<StationTimetableData>(this.fetchUrl, this.versionUrl);
      this.data = payload.lines;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.eventBus.emit('error', { message: `Station timetable load failed: ${msg}` });
      return;
    }

    this.tick();
    this.intervalId = setInterval(() => this.tick(), 10_000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    for (const t of this.pendingTimers) clearTimeout(t);
    this.pendingTimers.clear();
  }

  private tick(): void {
    if (!this.data) return;
    const now = new Date();
    const hhmm = tokyoHHMM(now);
    if (hhmm === this.lastFiredMinute) return;
    this.lastFiredMinute = hhmm;

    const calendar = pickCalendar(now);
    const secondsIntoMinute = Math.floor(now.getTime() / 1000) % 60;
    const remainingMs = Math.max(1000, (60 - secondsIntoMinute) * 1000);

    for (const line of this.lines) {
      const departures = this.data[line.id]?.[calendar];
      if (!departures) continue;
      const hits = findStationDeparturesAt(departures, hhmm);
      for (const hit of hits) {
        const station = line.stations[hit.stationIndex];
        if (!station) continue;

        // Spread by deterministic per-(station,direction) offset.
        const key = `${line.id}:${hit.stationIndex}:${hit.direction}`;
        const offsetMs = hashOffset(key, remainingMs);

        const timer = setTimeout(() => {
          this.pendingTimers.delete(timer);
          this.eventBus.emit('arrival', {
            line: line.id,
            station: station.id,
            stationIndex: hit.stationIndex,
            direction: hit.direction,
            trainId: `stt-${line.id}-${station.id}-${hhmm}-${hit.direction}`,
            timestamp: Date.now(),
          });
        }, offsetMs);
        this.pendingTimers.add(timer);
      }
    }
  }
}
