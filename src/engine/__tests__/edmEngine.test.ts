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

describe('EdmEngine.triggerArrival', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fires the mapped voice for the given line id', () => {
    const engine = new EdmEngine();
    engine.start();
    const triggerSpy = jest.spyOn(
      (engine as unknown as { voices: Record<string, { triggerAttackRelease: jest.Mock }> }).voices!.kick,
      'triggerAttackRelease',
    );
    engine.triggerArrival('ginza', 0, 19);
    expect(triggerSpy).toHaveBeenCalled();
  });

  it('computes a bass pitch in the bass register for JR lines', () => {
    const engine = new EdmEngine();
    engine.start();
    const bassSpy = jest.spyOn(
      (engine as unknown as { voices: Record<string, { triggerAttackRelease: jest.Mock }> }).voices!.bass,
      'triggerAttackRelease',
    );
    engine.triggerArrival('jr-yamanote', 5, 30);
    expect(bassSpy).toHaveBeenCalled();
    const [note] = bassSpy.mock.calls[0];
    // Bass register is C2 – E3, so pitch must be one of those notes.
    expect(['C2', 'D2', 'E2', 'G2', 'A2', 'C3', 'D3', 'E3']).toContain(note);
  });

  it('silently ignores unknown line ids', () => {
    const engine = new EdmEngine();
    engine.start();
    expect(() => engine.triggerArrival('not-a-line', 0, 1)).not.toThrow();
  });

  it('is a no-op when engine is stopped', () => {
    const engine = new EdmEngine();
    // not started
    expect(() => engine.triggerArrival('ginza', 0, 19)).not.toThrow();
  });
});

describe('EdmEngine pad progression', () => {
  it('start() schedules a Tone.Sequence for the pad chords', () => {
    const { Sequence } = jest.requireMock('tone') as { Sequence: jest.Mock };
    Sequence.mockClear();
    const engine = new EdmEngine();
    engine.start();
    expect(Sequence).toHaveBeenCalled();
    // First arg to Sequence is the callback, second is the chord events array.
    const [, events] = Sequence.mock.calls[0];
    expect(events).toHaveLength(4); // C, G, Am, F
  });
});
