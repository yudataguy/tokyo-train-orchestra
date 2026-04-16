import type { WeatherData } from '../types';

/**
 * The "daily vibe" of the EDM track — three musical parameters computed
 * from weather + time-of-day so the track sounds different every day.
 * Key stays in C (so arrival pitches via `stationToNote` harmonize with
 * every progression); only BPM, progression, and pad timbre vary.
 */
export type MoodLabel = 'happy' | 'melancholy' | 'spacious' | 'chill';
export type TempLabel = 'cold' | 'mild' | 'warm';
export type PadOscillator = 'sine' | 'triangle' | 'sawtooth';

export interface EdmVibe {
  bpm: number;
  chords: readonly (readonly string[])[];
  padOscillator: PadOscillator;
  mood: MoodLabel;
  temp: TempLabel;
}

// Progressions stay in C harmony; different 4-chord cycles give each
// weather condition a distinct emotional arc.
const PROGRESSIONS: Record<MoodLabel, readonly (readonly string[])[]> = {
  // I-V-vi-IV — the "happy pop" default.
  happy: [
    ['C3', 'E3', 'G3', 'C4'],
    ['G2', 'D3', 'G3', 'B3'],
    ['A2', 'E3', 'A3', 'C4'],
    ['F2', 'A2', 'C3', 'F3'],
  ],
  // vi-IV-I-V — wistful, "emotional" progression.
  melancholy: [
    ['A2', 'E3', 'A3', 'C4'],
    ['F2', 'A2', 'C3', 'F3'],
    ['C3', 'E3', 'G3', 'C4'],
    ['G2', 'D3', 'G3', 'B3'],
  ],
  // I-iii-vi-IV — ethereal, with the iii chord adding a floaty minor feel.
  spacious: [
    ['C3', 'E3', 'G3', 'C4'],
    ['E3', 'G3', 'B3', 'E4'],
    ['A2', 'E3', 'A3', 'C4'],
    ['F2', 'A2', 'C3', 'F3'],
  ],
  // ii-V-I-vi — jazz-leaning, reflective.
  chill: [
    ['D3', 'F3', 'A3', 'D4'],
    ['G2', 'D3', 'G3', 'B3'],
    ['C3', 'E3', 'G3', 'C4'],
    ['A2', 'E3', 'A3', 'C4'],
  ],
};

/** Current hour in Tokyo, 0-23. Honors `?demoHour=N` URL override. */
export function getTokyoHour(): number {
  if (typeof window !== 'undefined') {
    const override = new URLSearchParams(window.location.search).get('demoHour');
    if (override !== null) {
      const n = parseInt(override, 10);
      if (Number.isFinite(n) && n >= 0 && n < 24) return n;
    }
  }
  return parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false }),
    10,
  );
}

export function computeVibe(
  weather: WeatherData | null,
  hour: number = getTokyoHour(),
): EdmVibe {
  // BPM from hour-of-day: slowest at night, peak in early afternoon.
  let bpm = 124;
  if (hour < 6) bpm = 104;
  else if (hour < 10) bpm = 116;
  else if (hour < 14) bpm = 128;
  else if (hour < 18) bpm = 124;
  else if (hour < 22) bpm = 116;
  else bpm = 104;

  // Mood (progression) from weather condition.
  const cond = weather?.condition ?? 'clear';
  let mood: MoodLabel;
  switch (cond) {
    case 'rain':   mood = 'melancholy'; break;
    case 'snow':   mood = 'spacious';   break;
    case 'cloudy': mood = 'chill';      break;
    case 'clear':
    default:       mood = 'happy';      break;
  }

  // Temperature → pad oscillator timbre (cold = pure, warm = rich).
  const temp = weather?.temperature ?? 15;
  let tempLabel: TempLabel;
  let padOscillator: PadOscillator;
  if (temp < 10) { tempLabel = 'cold'; padOscillator = 'sine'; }
  else if (temp > 22) { tempLabel = 'warm'; padOscillator = 'sawtooth'; }
  else { tempLabel = 'mild'; padOscillator = 'triangle'; }

  return { bpm, chords: PROGRESSIONS[mood], padOscillator, mood, temp: tempLabel };
}
