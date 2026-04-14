import { mapWeatherCode } from '../WeatherService';

describe('mapWeatherCode', () => {
  it('maps code 0 to clear', () => {
    expect(mapWeatherCode(0)).toBe('clear');
  });
  it('maps codes 1-3 to cloudy', () => {
    expect(mapWeatherCode(1)).toBe('cloudy');
    expect(mapWeatherCode(2)).toBe('cloudy');
    expect(mapWeatherCode(3)).toBe('cloudy');
  });
  it('maps rain codes (51-67) to rain', () => {
    expect(mapWeatherCode(51)).toBe('rain');
    expect(mapWeatherCode(61)).toBe('rain');
    expect(mapWeatherCode(63)).toBe('rain');
  });
  it('maps snow codes (71-77) to snow', () => {
    expect(mapWeatherCode(71)).toBe('snow');
    expect(mapWeatherCode(75)).toBe('snow');
    expect(mapWeatherCode(77)).toBe('snow');
  });
  it('maps thunderstorm codes to rain', () => {
    expect(mapWeatherCode(95)).toBe('rain');
  });
});
