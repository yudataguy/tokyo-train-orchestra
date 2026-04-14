import { EventBus } from '../EventBus';

describe('EventBus', () => {
  it('delivers events to subscribers', () => {
    const bus = new EventBus<{ arrival: { line: string } }>();
    const received: { line: string }[] = [];
    bus.on('arrival', (event) => received.push(event));
    bus.emit('arrival', { line: 'ginza' });
    expect(received).toEqual([{ line: 'ginza' }]);
  });

  it('supports multiple subscribers', () => {
    const bus = new EventBus<{ arrival: { line: string } }>();
    let count = 0;
    bus.on('arrival', () => count++);
    bus.on('arrival', () => count++);
    bus.emit('arrival', { line: 'ginza' });
    expect(count).toBe(2);
  });

  it('unsubscribes correctly', () => {
    const bus = new EventBus<{ arrival: { line: string } }>();
    const received: string[] = [];
    const unsub = bus.on('arrival', (e) => received.push(e.line));
    bus.emit('arrival', { line: 'ginza' });
    unsub();
    bus.emit('arrival', { line: 'marunouchi' });
    expect(received).toEqual(['ginza']);
  });

  it('handles multiple event types', () => {
    const bus = new EventBus<{
      arrival: { line: string };
      weather: { condition: string };
    }>();
    const arrivals: string[] = [];
    const weather: string[] = [];
    bus.on('arrival', (e) => arrivals.push(e.line));
    bus.on('weather', (e) => weather.push(e.condition));
    bus.emit('arrival', { line: 'ginza' });
    bus.emit('weather', { condition: 'rain' });
    expect(arrivals).toEqual(['ginza']);
    expect(weather).toEqual(['rain']);
  });
});
