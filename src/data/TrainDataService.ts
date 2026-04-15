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
    if (train['odpt:toStation']) continue;
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

  private resolveLineId(odptRailway: string): string | null {
    const config = this.lineConfigs.find((l) => l.odptRailway === odptRailway);
    return config?.id ?? null;
  }

  private resolveStationIndex(odptStation: string, lineConfig: LineConfig): number {
    const stationPart = odptStation.split('.').pop()?.toLowerCase() ?? '';
    const station = lineConfig.stations.find(
      (s) =>
        s.id === stationPart ||
        s.name.toLowerCase().replace(/[^a-z]/g, '') ===
          stationPart.toLowerCase().replace(/[^a-z]/g, ''),
    );
    return station?.index ?? -1;
  }

  async poll(): Promise<void> {
    try {
      const urls = [
        `https://api.odpt.org/api/v4/odpt:Train?odpt:operator=odpt.Operator:Toei&acl:consumerKey=${this.apiKey}`,
        `https://api.odpt.org/api/v4/odpt:Train?odpt:operator=odpt.Operator:TokyoMetro&acl:consumerKey=${this.apiKey}`,
      ];
      const responses = await Promise.all(urls.map(u => fetch(u)));
      const allData = (await Promise.all(responses.map(r => r.ok ? r.json() : []))).flat() as OdptTrain[];

      const data: OdptTrain[] = allData;
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
    this.poll();
    this.intervalId = setInterval(() => this.poll(), intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
