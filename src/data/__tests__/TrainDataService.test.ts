import { parseOdptTrains, diffSnapshots } from '../TrainDataService';
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
