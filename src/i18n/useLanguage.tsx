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
  celesta: 'チェレスタ',
  kalimba: 'カリンバ',
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
  celesta: 'Celesta',
  kalimba: 'Kalimba',
};

const TRANSLATIONS = {
  ja: {
    title: '東京電車オーケストラ',
    description: '東京の鉄道網が奏でる、刻々と変化するオーケストラ。メトロ・都営・JRなど、各路線はひとつの楽器。各駅への到着が音になる。',
    beginListening: '発車',
    demoMode: 'デモモード — シミュレートされた電車データ',
    hybridMode: 'ライブモード — 都営は実際の運行データ、メトロ・JRは時刻表ベース',
    missingApiKey: 'データソースが構成されていません',
    settings: '設定',
    masterVolume: '音量',
    lines: '路線',
    companyTokyoMetro: '東京メトロ',
    companyToei: '都営地下鉄',
    companyJREast: 'JR東日本',
    companyOther: 'その他',
    musicMode: '音楽モード',
    modeAmbient: 'オーケストラ',
    modeEdm: 'EDM',
    modeClassicTagline: 'オーケストラ・アンビエント',
    modeEdmTagline: '天気で変わるビート',
    moodHappy: '明るい',
    moodMelancholy: '切ない',
    moodSpacious: '静謐',
    moodChill: '穏やか',
    tempCold: '寒い',
    tempMild: '心地よい',
    tempWarm: '暖かい',
    bpm: 'BPM',
    citySleeps: '街は眠っている...',
    tokyo: '東京',
    language: '言語',
    closeSettings: '設定を閉じる',
  },
  en: {
    title: 'Tokyo Train Orchestra',
    description: "A living orchestra driven by Tokyo's rail network — Metro, Toei, JR, and more. Each line is an instrument. Each station arrival plays a note.",
    beginListening: 'Depart',
    demoMode: 'Demo Mode — simulated train data',
    hybridMode: 'Live Mode — Toei real-time; Metro and JR from timetable',
    missingApiKey: 'No data source configured',
    settings: 'Settings',
    masterVolume: 'Volume',
    lines: 'Lines',
    companyTokyoMetro: 'Tokyo Metro',
    companyToei: 'Toei Subway',
    companyJREast: 'JR East',
    companyOther: 'Other',
    musicMode: 'Music Mode',
    modeAmbient: 'Orchestra',
    modeEdm: 'EDM',
    modeClassicTagline: 'orchestral ambient',
    modeEdmTagline: 'weather-driven beat',
    moodHappy: 'happy',
    moodMelancholy: 'melancholy',
    moodSpacious: 'spacious',
    moodChill: 'chill',
    tempCold: 'cold',
    tempMild: 'mild',
    tempWarm: 'warm',
    bpm: 'BPM',
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
