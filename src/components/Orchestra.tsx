'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import * as Tone from 'tone';
import type { ArrivalEvent, LineConfig, WeatherData, WeatherEffect } from '../types';
import { EventBus } from '../data/EventBus';
import { TrainDataService } from '../data/TrainDataService';
import { DemoDataService } from '../data/DemoDataService';
import { WeatherService } from '../data/WeatherService';
import { MusicEngine } from '../engine/MusicEngine';
import HUD from './HUD';
import SettingsPanel from './SettingsPanel';
import linesData from '../config/lines.json';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

type AppEvents = {
  arrival: ArrivalEvent;
  error: { message: string };
};

export default function Orchestra() {
  const [started, setStarted] = useState(false);
  const [recentArrivals, setRecentArrivals] = useState<ArrivalEvent[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mutedLines, setMutedLines] = useState<Set<string>>(new Set());
  const [volume, setVolume] = useState(0.7);
  const [weatherFxEnabled, setWeatherFxEnabled] = useState(false);

  const eventBusRef = useRef<EventBus<AppEvents> | null>(null);
  const musicEngineRef = useRef<MusicEngine | null>(null);
  const trainServiceRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const weatherServiceRef = useRef<WeatherService | null>(null);

  const lines: LineConfig[] = linesData as LineConfig[];

  const handleStart = useCallback(async () => {
    await Tone.start();

    const eventBus = new EventBus<AppEvents>();
    const musicEngine = new MusicEngine(lines);
    const apiKey = process.env.NEXT_PUBLIC_ODPT_API_KEY ?? '';
    const trainService = apiKey
      ? new TrainDataService(apiKey, lines, eventBus)
      : new DemoDataService(lines, eventBus);
    const weatherService = new WeatherService();

    eventBus.on('arrival', (event) => {
      musicEngine.handleArrival(event);
      setRecentArrivals((prev) => {
        const next = [...prev, event];
        return next.length > 20 ? next.slice(-20) : next;
      });
    });

    trainService.start();
    weatherService.start((w) => setWeather(w));

    eventBusRef.current = eventBus;
    musicEngineRef.current = musicEngine;
    trainServiceRef.current = trainService;
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

  const isDemoMode = !process.env.NEXT_PUBLIC_ODPT_API_KEY;

  if (!started) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-bold text-white">Tokyo Train Orchestra</h1>
        <p className="text-gray-400 text-center max-w-md">
          A living orchestra driven by Tokyo&apos;s Metro system. Each line is an instrument.
          Each station arrival plays a note.
        </p>
        {isDemoMode && (
          <p className="text-indigo-400 text-sm">Demo Mode — simulated train data</p>
        )}
        <button
          onClick={handleStart}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-lg"
        >
          Begin Listening
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
