'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { ArrivalEvent, LineConfig, WeatherData, WeatherEffect } from '../types';
import { EventBus } from '../data/EventBus';
import type { AppEvents } from '../data/appEvents';
import { TrainDataService } from '../data/TrainDataService';
import { DemoDataService } from '../data/DemoDataService';
import { TimetableDataService } from '../data/TimetableDataService';
import { StationTimetableDataService } from '../data/StationTimetableDataService';
import { WeatherService } from '../data/WeatherService';
// Type-only import for the ref slot — stripped at build time so the Tone
// module dependency isn't pulled in at page load.
import type { MusicEngine as MusicEngineT } from '../engine/MusicEngine';
import HUD from './HUD';
import SettingsPanel from './SettingsPanel';
import linesData from '../config/lines.json';
import { LanguageProvider, useLanguage } from '../i18n/useLanguage';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

function OrchestraInner() {
  const { t } = useLanguage();
  const [started, setStarted] = useState(false);
  const [recentArrivals, setRecentArrivals] = useState<ArrivalEvent[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mutedLines, setMutedLines] = useState<Set<string>>(new Set());
  const [volume, setVolume] = useState(0.2);
  const [weatherFxEnabled, setWeatherFxEnabled] = useState(false);

  const eventBusRef = useRef<EventBus<AppEvents> | null>(null);
  const musicEngineRef = useRef<MusicEngineT | null>(null);
  const trainServiceRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const weatherServiceRef = useRef<WeatherService | null>(null);

  const lines: LineConfig[] = linesData as LineConfig[];

  const handleStart = useCallback(async () => {
    // Lazy-load Tone.js and MusicEngine at click time. Module-level imports
    // would cause Tone to create a (suspended) AudioContext at page load
    // before any user gesture — Chrome logs an autoplay-policy warning for
    // that even though Tone.start() would later resume the context
    // successfully. Dynamic import defers the whole Web Audio graph until
    // we have the gesture in hand.
    const [Tone, { MusicEngine }] = await Promise.all([
      import('tone'),
      import('../engine/MusicEngine'),
    ]);
    await Tone.start();

    const eventBus = new EventBus<AppEvents>();
    const musicEngine = new MusicEngine(lines);
    const apiKey = process.env.NEXT_PUBLIC_ODPT_API_KEY ?? '';

    // Data sources:
    //   - With API key: live Toei (TrainDataService) + scheduled Tokyo Metro (TimetableDataService)
    //     + station-timetable-driven Yurikamome (StationTimetableDataService).
    //   - Without key: random simulation for every line (DemoDataService).
    const timetableLines = lines.filter((l) => l.odptRailway.includes('TokyoMetro') || l.odptRailway.includes('TWR'));
    const yurikamomeLines = lines.filter((l) => l.id === 'yurikamome');
    const trainService = apiKey ? new TrainDataService(apiKey, lines, eventBus) : null;
    const timetableService = apiKey ? new TimetableDataService(timetableLines, eventBus) : null;
    const stationTimetableService = apiKey && yurikamomeLines.length
      ? new StationTimetableDataService(yurikamomeLines, eventBus)
      : null;
    const demoService = apiKey ? null : new DemoDataService(lines, eventBus);

    const weatherService = new WeatherService();

    eventBus.on('arrival', (event) => {
      musicEngine.handleArrival(event);
      setRecentArrivals((prev) => {
        const next = [...prev, event];
        return next.length > 20 ? next.slice(-20) : next;
      });
    });

    trainService?.start();
    void timetableService?.start();
    void stationTimetableService?.start();
    demoService?.start();
    weatherService.start((w) => setWeather(w));

    eventBusRef.current = eventBus;
    musicEngineRef.current = musicEngine;
    trainServiceRef.current = {
      start: () => {},
      stop: () => {
        trainService?.stop();
        timetableService?.stop();
        stationTimetableService?.stop();
        demoService?.stop();
      },
    };
    weatherServiceRef.current = weatherService;

    setStarted(true);
  }, [lines]);

  useEffect(() => {
    return () => {
      trainServiceRef.current?.stop();
      weatherServiceRef.current?.stop();
      musicEngineRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    musicEngineRef.current?.setMasterVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (!musicEngineRef.current || !weather) return;
    if (!weatherFxEnabled) {
      musicEngineRef.current.setWeatherEffect('none');
      return;
    }
    let effect: WeatherEffect = 'none';
    if (weather.condition === 'rain') effect = 'rain';
    else if (weather.condition === 'snow') effect = 'snow';
    else if (weather.condition === 'clear' && weather.isNight) effect = 'clear-night';
    musicEngineRef.current.setWeatherEffect(effect);
  }, [weather, weatherFxEnabled]);

  const handleToggleMute = useCallback((lineId: string) => {
    setMutedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
        musicEngineRef.current?.setLineMuted(lineId, false);
      } else {
        next.add(lineId);
        musicEngineRef.current?.setLineMuted(lineId, true);
      }
      return next;
    });
  }, []);

  const apiKeyPresent = !!process.env.NEXT_PUBLIC_ODPT_API_KEY;

  // Auto-fire handleStart 5 s after the start screen mounts, unless the user
  // clicks first. Note on browser autoplay policy: Tone.start() needs a user
  // gesture in its call stack; a raw setTimeout is not one. If the visitor
  // never clicks/taps/presses a key on the page, Chrome will block audio.
  // Most visitors interact (scroll, tab focus, click link) within 5 s, so
  // the fallback still usually works. A manual click is always a valid
  // gesture and preferred.
  useEffect(() => {
    if (started) return;
    const timer = setTimeout(() => { void handleStart(); }, 5000);
    return () => clearTimeout(timer);
  }, [started, handleStart]);

  if (!started) {
    // SVG ring that drains over 5 s to visualize the countdown.
    const ringRadius = 58;
    const ringCircumference = 2 * Math.PI * ringRadius;

    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center gap-6 px-6">
        {/* Inline keyframes for the countdown ring — Tailwind v4 tree-shakes
            class rules it doesn't see in JSX attributes, and
            stroke-dashoffset animation needs arbitrary values. */}
        <style>{`
          @keyframes tto-countdown {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: ${ringCircumference}; }
          }
          .tto-countdown-ring {
            animation: tto-countdown 5s linear forwards;
          }
        `}</style>

        <h1 className="text-3xl sm:text-4xl font-bold text-white text-center">{t('title')}</h1>
        <p className="text-gray-400 text-center max-w-md text-sm sm:text-base">
          {t('description')}
        </p>
        <p className="text-[#4A80D4] text-sm">
          {apiKeyPresent ? t('hybridMode') : t('demoMode')}
        </p>

        <button
          onClick={handleStart}
          className="relative w-32 h-32 rounded-full bg-[#003DA5] hover:bg-[#0050C8] text-white font-semibold transition-colors flex items-center justify-center text-2xl"
          aria-label={t('beginListening')}
        >
          <span className="relative z-10">{t('beginListening')}</span>
          <svg
            viewBox="0 0 128 128"
            className="absolute inset-0 w-full h-full"
            aria-hidden="true"
          >
            <circle
              cx="64" cy="64" r={ringRadius}
              fill="none"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset="0"
              transform="rotate(-90 64 64)"
              className="tto-countdown-ring"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapView lines={lines} recentArrivals={recentArrivals} />
      <HUD
        lines={lines}
        recentArrivals={recentArrivals}
        weather={weather}
        onSettingsClick={() => setSettingsOpen(true)}
      />
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        lines={lines}
        mutedLines={mutedLines}
        onToggleMute={handleToggleMute}
        volume={volume}
        onVolumeChange={setVolume}
        weatherFxEnabled={weatherFxEnabled}
        onWeatherFxToggle={() => setWeatherFxEnabled((prev) => !prev)}
      />
    </div>
  );
}

export default function Orchestra() {
  return (
    <LanguageProvider>
      <OrchestraInner />
    </LanguageProvider>
  );
}
