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
  // aria-live="off": time changes every second; announcing each tick would
  // flood screen readers. The value is still readable on focus/navigation.
  return <time aria-live="off">{time}</time>;
}

export default function HUD({ lines, recentArrivals, weather, onSettingsClick }: HUDProps) {
  const { language, t, tInstrument } = useLanguage();
  const lineMap = new Map(lines.map((l) => [l.id, l]));
  const displayedArrivals = recentArrivals.slice(-20);

  return (
    <>
      {/* Top-left: Time & Weather */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-[1000] bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2" aria-label={t('tokyo')}>
        <div className="text-2xl sm:text-3xl font-bold text-white"><TokyoTime /></div>
        <div className="text-xs sm:text-sm text-gray-200">
          {t('tokyo')}
          {weather && (
            <>
              {' · '}
              <span>{Math.round(weather.temperature)}&deg;C</span>
              {' '}
              <span role="img" aria-label={weather.condition}>{getWeatherEmoji(weather.condition)}</span>
            </>
          )}
        </div>
      </div>

      {/* Top-right: Settings button */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-[1000] flex gap-2">
        <button type="button" onClick={onSettingsClick} className="w-10 h-10 bg-slate-900/80 backdrop-blur-sm rounded-lg flex items-center justify-center text-gray-200 hover:text-white transition-colors" aria-label={t('settings')} aria-haspopup="dialog">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Data attribution (required by ODPT license) */}
      <div className="absolute bottom-1 right-2 z-[1000] text-[10px] text-gray-300/80 pointer-events-none">
        Data: 公共交通オープンデータセンター / ODPT
      </div>

      {/* Bottom: Now-playing ticker. aria-live="off" by design — arrivals can
          fire many times per minute and per-event announcements would flood
          assistive tech. The ticker remains focusable/readable on demand. */}
      <section
        className="absolute bottom-0 left-0 right-0 z-[1000] bg-gradient-to-t from-slate-900/95 to-transparent px-4 pt-4 pb-2"
        aria-label={t('citySleeps')}
      >
        {displayedArrivals.length === 0 ? (
          <div className="text-gray-300 text-sm">{t('citySleeps')}</div>
        ) : (
          <ul
            className="flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1.5 pb-1 max-h-20 sm:max-h-24 overflow-y-auto list-none m-0 p-0"
            aria-live="off"
          >
            {displayedArrivals.map((event) => {
              const line = lineMap.get(event.line);
              if (!line) return null;
              const station = line.stations.find((s) => s.id === event.station);
              const lineName = language === 'ja' ? line.nameJa : line.name;
              const stationName = language === 'ja' ? (station?.nameJa ?? event.station) : (station?.name ?? event.station);
              return (
                <li key={(event as any)._seq ?? `${event.trainId}-${event.timestamp}`} className="flex items-center gap-2 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: line.color }} aria-hidden="true" />
                  <span className="text-xs font-semibold" style={{ color: line.color }}>{lineName}</span>
                  <span className="text-xs text-gray-300">{tInstrument(line.instrument)} &middot; {stationName}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
