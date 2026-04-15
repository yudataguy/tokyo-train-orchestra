import type { ArrivalEvent, LineConfig } from '../types';
import { EventBus } from './EventBus';
import { loadTimetables } from './timetableCache';

/** One train run, compacted to the fields we actually use at runtime. */
export interface CompactTimetable {
  n: string; // train number
  d: string; // rail direction (trailing segment of URI)
  stops: Array<{ t: string; a: boolean; s: number }>; // time (HH:MM), has-arrival, station index
}

export type Calendar = 'Weekday' | 'SaturdayHoliday';

/** All timetables, keyed by line id → calendar → array of train runs. */
export type TimetableData = Record<string, Record<Calendar, CompactTimetable[]>>;

export function pickCalendar(date: Date): Calendar {
  // Use Tokyo-local day of week. JS Date.getDay() uses the host timezone, so
  // we compute from a Tokyo-zoned string to avoid ambiguity.
  const tokyoWeekday = date.toLocaleString('en-US', {
    timeZone: 'Asia/Tokyo',
    weekday: 'short',
  });
  return tokyoWeekday === 'Sat' || tokyoWeekday === 'Sun' ? 'SaturdayHoliday' : 'Weekday';
}

export function tokyoHHMM(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export interface ArrivalHit {
  trainNumber: string;
  direction: string;
  stationIndex: number;
}

/** Find every stop in the given timetables whose arrival-time matches `hhmm` exactly. */
export function findArrivalsAt(trains: CompactTimetable[], hhmm: string): ArrivalHit[] {
  const hits: ArrivalHit[] = [];
  for (const train of trains) {
    for (const stop of train.stops) {
      if (stop.a && stop.t === hhmm) {
        hits.push({
          trainNumber: train.n,
          direction: train.d,
          stationIndex: stop.s,
        });
      }
    }
  }
  return hits;
}

/**
 * Emits scheduled Tokyo Metro arrivals as they come due. Loads the full daily
 * timetable once, then ticks once a minute (aligned to Tokyo HH:MM rollover)
 * and fires ArrivalEvents for every train scheduled to arrive in that minute.
 */
export class TimetableDataService {
  private data: TimetableData | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastFiredMinute = ''; // guards against double-firing within the same HH:MM

  constructor(
    private metroLines: LineConfig[],
    private eventBus: EventBus<{ arrival: ArrivalEvent; error: { message: string } }>,
    private fetchUrl = '/timetables.json',
    private versionUrl = '/timetables-version.json',
  ) {}

  async start(): Promise<void> {
    try {
      const payload = await loadTimetables<TimetableData>(this.fetchUrl, this.versionUrl);
      this.data = payload.lines;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.eventBus.emit('error', { message: `Timetable load failed: ${msg}` });
      return;
    }

    this.tick(); // fire immediately for the current minute
    // Check every 10s to catch the HH:MM rollover within a second or two
    this.intervalId = setInterval(() => this.tick(), 10_000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick(): void {
    if (!this.data) return;
    const now = new Date();
    const hhmm = tokyoHHMM(now);
    if (hhmm === this.lastFiredMinute) return;
    this.lastFiredMinute = hhmm;

    const calendar = pickCalendar(now);
    const timestamp = now.getTime();

    for (const line of this.metroLines) {
      const trains = this.data[line.id]?.[calendar];
      if (!trains) continue;
      const hits = findArrivalsAt(trains, hhmm);
      for (const hit of hits) {
        const station = line.stations[hit.stationIndex];
        if (!station) continue;
        this.eventBus.emit('arrival', {
          line: line.id,
          station: station.id,
          stationIndex: hit.stationIndex,
          direction: hit.direction,
          trainId: `sched-${line.id}-${hit.trainNumber}-${hhmm}`,
          timestamp,
        });
      }
    }
  }
}
