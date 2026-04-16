'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { ArrivalEvent, LineConfig, WeatherData } from '../types';
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
import { computeVibe } from '../engine/edmVibe';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

function OrchestraInner() {
  const { t } = useLanguage();
  const [started, setStarted] = useState(false);
  const [recentArrivals, setRecentArrivals] = useState<ArrivalEvent[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mutedLines, setMutedLines] = useState<Set<string>>(new Set());
  const [volume, setVolume] = useState(0.16);
  const [musicMode, setMusicMode] = useState<'ambient' | 'edm'>('edm');

  const arrivalSeqRef = useRef(0);
  const eventBusRef = useRef<EventBus<AppEvents> | null>(null);
  const musicEngineRef = useRef<MusicEngineT | null>(null);
  const trainServiceRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const weatherServiceRef = useRef<WeatherService | null>(null);

  const lines: LineConfig[] = linesData as LineConfig[];

  // Pre-fetch weather on mount so the vibe shown on the start screen
  // reflects real conditions before the user clicks Depart.
  useEffect(() => {
    let cancelled = false;
    new WeatherService().fetch().then((w) => {
      if (!cancelled) setWeather(w);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const vibe = computeVibe(weather);

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
    // Apply the current React-side music mode. MusicEngine defaults to
    // 'ambient' internally; without this call, a first-load EDM default
    // would still play the ambient engine until the user toggled.
    musicEngine.setMode(musicMode, vibe);
    // Demo mode is a dev-only convenience. Production builds never fall
    // back to demo (otherwise a missing deploy-time env key would silently
    // replace real trains with random ones). Dev: demo kicks in when no
    // key is set, OR when ?demo=1 forces it for offline auditioning.
    const isDev = process.env.NODE_ENV === 'development';
    const forceDemo = isDev
      && typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('demo') === '1';
    const apiKey = forceDemo ? '' : (process.env.NEXT_PUBLIC_ODPT_API_KEY ?? '');

    // Data sources (layered by availability):
    //   Toei: live via ODPT odpt:Train (TrainDataService)
    //   Tokyo Metro + TWR + Tama + Marunouchi Branch + Tsukuba: ODPT TrainTimetable
    //   Yurikamome + JR lines: StationTimetable (per-station departures)
    //   No key: random DemoDataService for all lines
    const timetableLines = lines.filter((l) => l.odptRailway.includes('TokyoMetro') || l.odptRailway.includes('TWR'));
    const stationTimetableLines = lines.filter((l) =>
      l.id === 'yurikamome' || l.id.startsWith('jr-'));
    const trainService = apiKey ? new TrainDataService(apiKey, lines, eventBus) : null;
    const timetableService = apiKey ? new TimetableDataService(timetableLines, eventBus) : null;
    const stationTimetableService = stationTimetableLines.length
      ? new StationTimetableDataService(stationTimetableLines, eventBus)
      : null;
    // Demo service only in development. In production, a missing key means
    // no data source — never silently substitute simulated trains.
    const demoService = !apiKey && isDev ? new DemoDataService(lines, eventBus) : null;

    // Surface the active data-source mode in the console so it's easy to
    // tell real-vs-simulated at a glance.
    if (demoService) {
      const hourOverride = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('demoHour')
        : null;
      console.log(
        `%c[tokyo-train-orchestra]%c DEMO mode — simulated trains${hourOverride ? ` (hour=${hourOverride})` : ''}`,
        'color:#F59E0B;font-weight:bold',
        'color:inherit',
      );
    } else if (apiKey) {
      console.log(
        '%c[tokyo-train-orchestra]%c LIVE mode — real ODPT data',
        'color:#10B981;font-weight:bold',
        'color:inherit',
      );
    } else {
      console.warn(
        '%c[tokyo-train-orchestra]%c No data source — NEXT_PUBLIC_ODPT_API_KEY is missing in this build',
        'color:#EF4444;font-weight:bold',
        'color:inherit',
      );
    }

    const weatherService = new WeatherService();

    eventBus.on('arrival', (event) => {
      musicEngine.handleArrival(event);
      // Stamp each event with a monotonically increasing sequence number so
      // the React key is always unique even when two departures produce
      // identical trainId + timestamp combos (same station, same minute,
      // same direction, same millisecond from Date.now()).
      const seq = ++arrivalSeqRef.current;
      const tagged = { ...event, _seq: seq };
      setRecentArrivals((prev) => {
        const next = [...prev, tagged];
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
  }, [lines, musicMode, vibe]);

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
    musicEngineRef.current?.setMode(musicMode, vibe);
    // `vibe` is intentionally read only when musicMode flips — we don't want
    // a weather poll mid-session to tear down and re-create the EDM engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicMode]);

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
  const isDev = process.env.NODE_ENV === 'development';
  const dataSourceLabel: 'hybridMode' | 'demoMode' | 'missingApiKey' =
    apiKeyPresent ? 'hybridMode' : isDev ? 'demoMode' : 'missingApiKey';

  if (!started) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center gap-6 px-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-white text-center">{t('title')}</h1>
        <p className="text-gray-400 text-center max-w-md text-sm sm:text-base">
          {t('description')}
        </p>
        <p className={`text-sm ${dataSourceLabel === 'missingApiKey' ? 'text-amber-400' : 'text-[#4A80D4]'}`}>
          {t(dataSourceLabel)}
        </p>
        <p className="text-gray-500 text-xs uppercase tracking-wider">
          {t('musicMode')}: {musicMode === 'edm' ? t('modeEdm') : t('modeAmbient')}
        </p>
        {musicMode === 'edm' && (
          <p className="text-gray-600 text-xs">
            {vibe.bpm} {t('bpm')} · {t(`mood${vibe.mood.charAt(0).toUpperCase()}${vibe.mood.slice(1)}` as 'moodHappy')} · {t(`temp${vibe.temp.charAt(0).toUpperCase()}${vibe.temp.slice(1)}` as 'tempCold')}
          </p>
        )}

        <button
          onClick={handleStart}
          className="w-24 h-24 rounded-full bg-[#003DA5] hover:bg-[#0050C8] text-white font-semibold transition-colors flex items-center justify-center text-xl"
          aria-label={t('beginListening')}
        >
          {t('beginListening')}
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
        musicMode={musicMode}
        onMusicModeChange={setMusicMode}
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
