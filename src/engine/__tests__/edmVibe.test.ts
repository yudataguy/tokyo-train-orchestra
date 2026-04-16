import { computeVibe } from '../edmVibe';
import type { WeatherData } from '../../types';

const mkWeather = (partial: Partial<WeatherData>): WeatherData => ({
  temperature: 15,
  weatherCode: 0,
  condition: 'clear',
  isNight: false,
  ...partial,
});

describe('computeVibe', () => {
  it('uses the happy progression and a warm sawtooth pad for a clear hot afternoon', () => {
    const vibe = computeVibe(mkWeather({ condition: 'clear', temperature: 28 }), 13);
    expect(vibe.mood).toBe('happy');
    expect(vibe.temp).toBe('warm');
    expect(vibe.padOscillator).toBe('sawtooth');
    expect(vibe.bpm).toBe(128);
    expect(vibe.chords).toHaveLength(4);
  });

  it('uses melancholy + cold sine pad for a rainy winter night', () => {
    const vibe = computeVibe(mkWeather({ condition: 'rain', temperature: 4 }), 2);
    expect(vibe.mood).toBe('melancholy');
    expect(vibe.temp).toBe('cold');
    expect(vibe.padOscillator).toBe('sine');
    expect(vibe.bpm).toBe(104);
  });

  it('falls back to happy/mild/triangle when weather is null', () => {
    const vibe = computeVibe(null, 12);
    expect(vibe.mood).toBe('happy');
    expect(vibe.temp).toBe('mild');
    expect(vibe.padOscillator).toBe('triangle');
  });

  it('maps snow to spacious mood', () => {
    const vibe = computeVibe(mkWeather({ condition: 'snow', temperature: 0 }), 10);
    expect(vibe.mood).toBe('spacious');
  });

  it('maps cloudy to chill mood', () => {
    const vibe = computeVibe(mkWeather({ condition: 'cloudy', temperature: 15 }), 10);
    expect(vibe.mood).toBe('chill');
  });

  it('peaks BPM at 128 between 10 and 14, drops to 104 late night', () => {
    expect(computeVibe(null, 11).bpm).toBe(128);
    expect(computeVibe(null, 23).bpm).toBe(104);
    expect(computeVibe(null, 3).bpm).toBe(104);
    expect(computeVibe(null, 8).bpm).toBe(116);
    expect(computeVibe(null, 20).bpm).toBe(116);
  });
});
