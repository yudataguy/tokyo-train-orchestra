'use client';

import { useState, useEffect } from 'react';
import type { ArrivalEvent, LineConfig, WeatherData } from '../types';
import { useLanguage } from '../i18n/useLanguage';

interface HUDProps {
  lines: LineConfig[];
  recentArrivals: ArrivalEvent[];
  weather: WeatherData | null;
  onSettingsClick: () => void;
}

function getWeatherEmoji(condition: string): string {
  switch (condition) {
    case 'clear': return '\u2600\uFE0F';
    case 'cloudy': return '\u2601\uFE0F';
    case 'rain': return '\uD83C\uDF27\uFE0F';
    case 'snow': return '\u2744\uFE0F';
    default: return '';
  }
}

function TokyoTime() {
  const [time, setTime] = useState('');
  useEffect(() => {
    function update() {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: true,
      }));
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{time}</span>;
}

export default function HUD({ lines, recentArrivals, weather, onSettingsClick }: HUDProps) {
  const { language, t, tInstrument } = useLanguage();
  const lineMap = new Map(lines.map((l) => [l.id, l]));
  const displayedArrivals = recentArrivals.slice(-20);

  return (
    <>
      {/* Top-left: Time & Weather */}
      <div className="absolute top-4 left-4 z-[1000] bg-slate-900/70 backdrop-blur-sm rounded-lg px-3 py-2">
        <div className="text-3xl font-bold text-white"><TokyoTime /></div>
        <div className="text-sm text-gray-300">
          {t('tokyo')}{weather && (<> &middot; {Math.round(weather.temperature)}&deg;C {getWeatherEmoji(weather.condition)}</>)}
        </div>
      </div>

      {/* Top-right: Settings button */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-2">
        <button onClick={onSettingsClick} className="w-10 h-10 bg-slate-900/70 backdrop-blur-sm rounded-lg flex items-center justify-center text-gray-300 hover:text-white transition-colors" aria-label={t('settings')}>&#9881;</button>
      </div>

      {/* Bottom: Now-playing ticker */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-gradient-to-t from-slate-900/95 to-transparent px-4 pt-8 pb-3">
        {displayedArrivals.length === 0 ? (
          <div className="text-gray-500 text-sm">{t('citySleeps')}</div>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pb-1 max-h-32 overflow-y-auto">
            {displayedArrivals.map((event) => {
              const line = lineMap.get(event.line);
              if (!line) return null;
              const station = line.stations.find((s) => s.id === event.station);
              const lineName = language === 'ja' ? line.nameJa : line.name;
              const stationName = language === 'ja' ? (station?.nameJa ?? event.station) : (station?.name ?? event.station);
              return (
                <div key={`${event.trainId}-${event.timestamp}`} className="flex items-center gap-2 whitespace-nowrap">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: line.color }} />
                  <span className="text-xs font-semibold" style={{ color: line.color }}>{lineName}</span>
                  <span className="text-xs text-gray-500">{tInstrument(line.instrument)} &middot; {stationName}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
