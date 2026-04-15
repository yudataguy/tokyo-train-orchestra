import { MusicEngine } from '../MusicEngine';
import type { ArrivalEvent, LineConfig, WeatherEffect } from '../../types';

// Mock Tone.js — it requires AudioContext which isn't available in tests
jest.mock('tone', () => ({
  PolySynth: jest.fn().mockImplementation(() => ({
    toDestination: jest.fn().mockReturnThis(),
    connect: jest.fn().mockReturnThis(),
    disconnect: jest.fn().mockReturnThis(),
    triggerAttackRelease: jest.fn(),
    volume: { value: 0 },
    dispose: jest.fn(),
  })),
  Synth: jest.fn(),
  FMSynth: jest.fn(),
  AMSynth: jest.fn(),
  Filter: jest.fn().mockImplementation(() => ({
    toDestination: jest.fn().mockReturnThis(),
    connect: jest.fn().mockReturnThis(),
    dispose: jest.fn(),
  })),
  Reverb: jest.fn().mockImplementation(() => ({
    toDestination: jest.fn().mockReturnThis(),
    connect: jest.fn().mockReturnThis(),
    wet: { value: 0 },
    dispose: jest.fn(),
  })),
  start: jest.fn(),
  getDestination: jest.fn().mockReturnValue({ volume: { value: 0 } }),
  gainToDb: jest.fn((v: number) => 20 * Math.log10(v)),
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
      line: 'ginza', station: 'station-5', stationIndex: 5,
      direction: 'asakusa', trainId: 'train-1', timestamp: Date.now(),
    };
    expect(() => engine.handleArrival(event)).not.toThrow();
  });

  it('ignores events for unknown lines', () => {
    const event: ArrivalEvent = {
      line: 'unknown', station: 'station-0', stationIndex: 0,
      direction: 'north', trainId: 'train-1', timestamp: Date.now(),
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
