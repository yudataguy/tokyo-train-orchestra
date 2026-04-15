import {
  findStationDeparturesAt,
  type StationDeparture,
} from '../StationTimetableDataService';

describe('findStationDeparturesAt', () => {
  const departures: StationDeparture[] = [
    { t: '05:19', s: 0, d: 'Inbound' },
    { t: '05:26', s: 0, d: 'Inbound' },
    { t: '05:26', s: 3, d: 'Outbound' }, // simultaneous arrivals at different stations
    { t: '05:35', s: 7, d: 'Inbound' },
  ];

  it('returns all departures matching the target minute', () => {
    const hits = findStationDeparturesAt(departures, '05:26');
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.stationIndex).sort()).toEqual([0, 3]);
  });

  it('returns empty for a non-matching minute', () => {
    expect(findStationDeparturesAt(departures, '12:00')).toEqual([]);
  });

  it('preserves the direction on each hit', () => {
    const hits = findStationDeparturesAt(departures, '05:19');
    expect(hits).toEqual([{ stationIndex: 0, direction: 'Inbound' }]);
  });
});
