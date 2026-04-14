import type { WeatherData } from '../types';

export function mapWeatherCode(code: number): WeatherData['condition'] {
  if (code === 0) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 49) return 'cloudy';
  if (code <= 69) return 'rain';
  if (code <= 79) return 'snow';
  if (code <= 84) return 'rain';
  if (code <= 86) return 'snow';
  return 'rain';
}

export class WeatherService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastWeather: WeatherData | null = null;

  async fetch(): Promise<WeatherData> {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=35.6762&longitude=139.6503&current=temperature_2m,weather_code,is_day';
    const response = await globalThis.fetch(url);
    if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
    const data = await response.json();
    const current = data.current;
    const weather: WeatherData = {
      temperature: current.temperature_2m,
      weatherCode: current.weather_code,
      condition: mapWeatherCode(current.weather_code),
      isNight: current.is_day === 0,
    };
    this.lastWeather = weather;
    return weather;
  }

  start(onUpdate: (weather: WeatherData) => void, intervalMs = 600_000): void {
    this.fetch().then(onUpdate).catch(() => {});
    this.intervalId = setInterval(() => {
      this.fetch().then(onUpdate).catch(() => {});
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
  }

  getLastWeather(): WeatherData | null { return this.lastWeather; }
}
