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
    releaseAll: jest.fn(),
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
  MembraneSynth: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockReturnThis(),
    disconnect: jest.fn().mockReturnThis(),
    triggerAttackRelease: jest.fn(),
    dispose: jest.fn(),
  })),
  NoiseSynth: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockReturnThis(),
    disconnect: jest.fn().mockReturnThis(),
    triggerAttackRelease: jest.fn(),
    dispose: jest.fn(),
  })),
  MetalSynth: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockReturnThis(),
    disconnect: jest.fn().mockReturnThis(),
    triggerAttackRelease: jest.fn(),
    dispose: jest.fn(),
  })),
  MonoSynth: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockReturnThis(),
    disconnect: jest.fn().mockReturnThis(),
    triggerAttackRelease: jest.fn(),
    dispose: jest.fn(),
  })),
  Sequence: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    dispose: jest.fn(),
  })),
  getTransport: jest.fn().mockReturnValue({
    start: jest.fn(),
    stop: jest.fn(),
    cancel: jest.fn(),
    clear: jest.fn(),
    scheduleRepeat: jest.fn(() => 0),
    bpm: { value: 0 },
  }),
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

  describe('mode switching', () => {
    it('defaults to ambient mode', () => {
      const engine = new MusicEngine([mockLine]);
      expect(engine.getMode()).toBe('ambient');
    });

    it('setMode("edm") starts the EDM engine', () => {
      const engine = new MusicEngine([mockLine]);
      engine.setMode('edm');
      expect(engine.getMode()).toBe('edm');
    });

    it('arrivals route to EDM engine when mode is edm', () => {
      const engine = new MusicEngine([mockLine]);
      engine.setMode('edm');
      const arrival: ArrivalEvent = {
        line: 'ginza', station: 'shibuya', stationIndex: 0,
        direction: 'up', trainId: 't1', timestamp: Date.now(),
      };
      expect(() => engine.handleArrival(arrival)).not.toThrow();
    });

    it('setMode back to ambient stops the EDM engine', () => {
      const engine = new MusicEngine([mockLine]);
      engine.setMode('edm');
      engine.setMode('ambient');
      expect(engine.getMode()).toBe('ambient');
    });
  });
});
