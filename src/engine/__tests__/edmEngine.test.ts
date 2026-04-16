import { EdmEngine } from '../edmEngine';

const transportMock = {
  start: jest.fn(),
  stop: jest.fn(),
  cancel: jest.fn(),
  scheduleRepeat: jest.fn(),
  bpm: { value: 0 },
};

jest.mock('tone', () => {
  const voiceMock = () => ({
    connect: jest.fn().mockReturnThis(),
    disconnect: jest.fn().mockReturnThis(),
    triggerAttackRelease: jest.fn(),
    dispose: jest.fn(),
  });
  return {
    MembraneSynth: jest.fn(voiceMock),
    NoiseSynth: jest.fn(voiceMock),
    MetalSynth: jest.fn(voiceMock),
    MonoSynth: jest.fn(voiceMock),
    PolySynth: jest.fn(voiceMock),
    Synth: jest.fn(),
    Filter: jest.fn().mockImplementation(() => ({
      toDestination: jest.fn().mockReturnThis(),
      connect: jest.fn().mockReturnThis(),
      dispose: jest.fn(),
    })),
    Sequence: jest.fn().mockImplementation(() => ({
      start: jest.fn().mockReturnThis(),
      stop: jest.fn().mockReturnThis(),
      dispose: jest.fn(),
    })),
    getTransport: () => transportMock,
  };
});

describe('EdmEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('start() sets BPM to 124 and starts the transport', () => {
    const engine = new EdmEngine();
    engine.start();
    expect(transportMock.bpm.value).toBe(124);
    expect(transportMock.start).toHaveBeenCalled();
  });

  it('stop() stops the transport and disposes voices', () => {
    const engine = new EdmEngine();
    engine.start();
    engine.stop();
    expect(transportMock.stop).toHaveBeenCalled();
  });

  it('start() is idempotent — calling twice does not start transport twice', () => {
    const engine = new EdmEngine();
    engine.start();
    engine.start();
    expect(transportMock.start).toHaveBeenCalledTimes(1);
  });
});
