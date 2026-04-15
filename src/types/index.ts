export interface StationConfig {
  id: string;        // e.g. "shibuya"
  name: string;      // English name
  nameJa: string;    // Japanese name
  lat: number;
  lng: number;
  index: number;     // position along line (0-based)
}

export interface LineConfig {
  id: string;           // e.g. "ginza"
  name: string;         // e.g. "Ginza"
  nameJa: string;       // e.g. "銀座線"
  color: string;        // hex color e.g. "#f77f00"
  instrument: string;   // e.g. "piano"
  odptRailway: string;  // e.g. "odpt.Railway:TokyoMetro.Ginza"
  stations: StationConfig[];
}

export interface ArrivalEvent {
  line: string;         // line id e.g. "ginza"
  station: string;      // station id e.g. "shibuya"
  stationIndex: number; // position along line
  direction: string;    // rail direction id
  trainId: string;      // stable ODPT train id
  timestamp: number;    // Date.now()
}

export interface TrainSnapshot {
  trainId: string;
  line: string;
  station: string;
  direction: string;
}

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  condition: 'clear' | 'cloudy' | 'rain' | 'snow';
  isNight: boolean;
}

export type WeatherEffect = 'none' | 'rain' | 'clear-night' | 'snow';

export interface Aircraft {
  icao24: string;    // stable 24-bit ICAO hex id
  callsign: string;
  country: string;
  lat: number;
  lng: number;
  altitude: number;  // metres; null from upstream becomes 0
  heading: number;   // degrees, 0 = north, true track
  velocity: number;  // m/s
  onGround: boolean;
}
