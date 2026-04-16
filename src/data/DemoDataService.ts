import type { ArrivalEvent, LineConfig } from '../types';
import { EventBus } from './EventBus';
import type { AppEvents } from './appEvents';

export class DemoDataService {
  // Track simulated trains: each has a line, current station index, direction
  private trains: Array<{
    id: string;
    lineId: string;
    stationIndex: number;
    direction: 1 | -1; // 1 = forward, -1 = backward
  }> = [];
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private lineConfigs: LineConfig[],
    private eventBus: EventBus<AppEvents>,
  ) {}

  private getTokyoHour(): number {
    // Dev override: ?demoHour=N in the URL simulates that hour regardless of real time.
    // Lets us audition the app at rush hour / dead of night without waiting.
    if (typeof window !== 'undefined') {
      const override = new URLSearchParams(window.location.search).get('demoHour');
      if (override !== null) {
        const n = parseInt(override, 10);
        if (Number.isFinite(n) && n >= 0 && n < 24) return n;
      }
    }
    return parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false }), 10);
  }

  private getInterval(): number {
    const hour = this.getTokyoHour();
    if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 20)) {
      return 1000 + Math.random() * 2000; // rush: 1-3s
    } else if (hour >= 9 && hour < 17) {
      return 3000 + Math.random() * 3000; // day: 3-6s
    } else {
      return 8000 + Math.random() * 7000; // night: 8-15s
    }
  }

  private initTrains(): void {
    // Create 1-2 trains per line
    this.trains = [];
    for (const line of this.lineConfigs) {
      const trainCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < trainCount; i++) {
        this.trains.push({
          id: `demo-${line.id}-${i}`,
          lineId: line.id,
          stationIndex: Math.floor(Math.random() * line.stations.length),
          direction: Math.random() > 0.5 ? 1 : -1,
        });
      }
    }
  }

  private tick = (): void => {
    // Pick a random train and advance it
    const train = this.trains[Math.floor(Math.random() * this.trains.length)];
    const line = this.lineConfigs.find(l => l.id === train.lineId);
    if (!line) return;

    // Move to next station
    train.stationIndex += train.direction;

    // Bounce at ends
    if (train.stationIndex >= line.stations.length) {
      train.stationIndex = line.stations.length - 2;
      train.direction = -1;
    } else if (train.stationIndex < 0) {
      train.stationIndex = 1;
      train.direction = 1;
    }

    const station = line.stations[train.stationIndex];

    this.eventBus.emit('arrival', {
      line: line.id,
      station: station.id,
      stationIndex: train.stationIndex,
      direction: train.direction === 1 ? 'forward' : 'backward',
      trainId: train.id,
      timestamp: Date.now(),
    });

    // Schedule next tick
    this.timeoutId = setTimeout(this.tick, this.getInterval());
  };

  start(): void {
    this.initTrains();
    this.timeoutId = setTimeout(this.tick, 500); // start quickly
  }

  stop(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.trains = [];
  }
}
