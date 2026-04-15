'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'ja' | 'en';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof TRANSLATIONS['ja']) => string;
  tInstrument: (instrument: string) => string;
}

const INSTRUMENTS_JA: Record<string, string> = {
  piano: 'ピアノ',
  violin: 'バイオリン',
  frenchhorn: 'フレンチホルン',
  flute: 'フルート',
  clarinet: 'クラリネット',
  harp: 'ハープ',
  cello: 'チェロ',
  marimba: 'マリンバ',
  vibraphone: 'ビブラフォン',
  guitar: 'ギター',
  trumpet: 'トランペット',
  oboe: 'オーボエ',
  bass: 'ベース',
  glockenspiel: 'グロッケン',
  xylophone: 'シロフォン',
  saxophone: 'サックス',
  celesta: 'チェレスタ',
};

const INSTRUMENTS_EN: Record<string, string> = {
  piano: 'Piano',
  violin: 'Violin',
  frenchhorn: 'French Horn',
  flute: 'Flute',
  clarinet: 'Clarinet',
  harp: 'Harp',
  cello: 'Cello',
  marimba: 'Marimba',
  vibraphone: 'Vibraphone',
  guitar: 'Guitar',
  trumpet: 'Trumpet',
  oboe: 'Oboe',
  bass: 'Bass',
  glockenspiel: 'Glockenspiel',
  xylophone: 'Xylophone',
  saxophone: 'Saxophone',
  celesta: 'Celesta',
};

const TRANSLATIONS = {
  ja: {
    title: '東京電車オーケストラ',
    description: '東京メトロが奏でる生きたオーケストラ。各路線は一つの楽器。各駅の到着で音が鳴る。',
    beginListening: '再生を始める',
    demoMode: 'デモモード — シミュレートされた電車データ',
    hybridMode: 'ライブモード — 都営は実走、メトロは時刻表ベース',
    settings: '設定',
    masterVolume: '音量',
    weatherEffects: '天気エフェクト',
    lines: '路線',
    citySleeps: '街は眠っている...',
    tokyo: '東京',
    language: '言語',
    closeSettings: '設定を閉じる',
  },
  en: {
    title: 'Tokyo Train Orchestra',
    description: "A living orchestra driven by Tokyo's Metro system. Each line is an instrument. Each station arrival plays a note.",
    beginListening: 'Begin Listening',
    demoMode: 'Demo Mode — simulated train data',
    hybridMode: 'Live Mode — Toei real-time, Metro from timetable',
    settings: 'Settings',
    masterVolume: 'Volume',
    weatherEffects: 'Weather Effects',
    lines: 'Lines',
    citySleeps: 'The city sleeps...',
    tokyo: 'Tokyo',
    language: 'Language',
    closeSettings: 'Close settings',
  },
} as const;

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('ja');
  const t = (key: keyof typeof TRANSLATIONS['ja']) => TRANSLATIONS[language][key];
  const tInstrument = (instrument: string) => {
    const map = language === 'ja' ? INSTRUMENTS_JA : INSTRUMENTS_EN;
    return map[instrument] ?? instrument;
  };
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tInstrument }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
