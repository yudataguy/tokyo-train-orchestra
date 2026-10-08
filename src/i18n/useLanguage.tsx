'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { INSTRUMENTS_JA, INSTRUMENTS_EN } from '../lib/instruments';

export type Language = 'ja' | 'en';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof TRANSLATIONS['ja']) => string;
  tInstrument: (instrument: string) => string;
}

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
    instrumentColumn: '楽器',
    moodLabel: '気分',
    tempLabel: '気温',
    tokyo: '東京',
    language: '言語',
    closeSettings: '設定を閉じる',
    modeRace: '電車レース',
    modeRaceTagline: '曲が電車を走らせる',
    raceNotesLabel: '音階',
    raceEnter: '遊ぶ',
    raceHome: 'トップへ',
    raceBack: '戻る',
    raceNext: '次へ',
    raceStepSong: '曲',
    raceStepLineup: '路線',
    raceStepDraw: '抽選',
    raceStepRace: 'レース',
    raceSongLabel: 'YouTubeのリンク',
    raceSongPlaceholder: 'https://youtu.be/…',
    raceSongInvalid: 'YouTubeのリンクとして読み取れません',
    raceSongLoading: '読み込み中…',
    raceSongNotEmbeddable: 'この動画はここでは再生できません。',
    raceSongUnavailable: '動画が見つからないか、再生できません。',
    raceSongLive: 'ライブ配信または長さ不明の動画です。レースの長さを選んでください。',
    racePlayMyself: '自分で再生する',
    racePlayMyselfHint: '近くの端末で曲を再生してください。マイクが聞き取ります。',
    raceLength: 'レースの長さ',
    raceMinutes: '分',
    raceLineupHint: '2〜12路線を選択',
    racePlayerName: 'プレイヤー名（任意）',
    raceDraw: '抽選',
    raceRedraw: '引き直す',
    raceToStart: 'スタートラインへ',
    raceStart: 'スタート',
    raceMicNeeded: 'マイクで曲を聞き取ります。スピーカーで再生してください。',
    raceMicDenied: 'マイクが許可されていません。アドレスバーのアイコンから許可してください。',
    raceMicUnsupported: 'マイクとHTTPS接続が必要です。',
    raceMicUnavailable: 'マイクが見つかりません。',
    raceRetry: '再試行',
    raceListening: '聞き取り中',
    raceCantHear: '曲が聞こえません — スピーカーの音量を上げてください',
    raceTapToPlay: 'タップして再生',
    racePlayNow: '今、曲を再生してください',
    racePause: '一時停止',
    raceResume: '再開',
    raceStop: '終了',
    raceNowAt: '現在',
    raceArrived: '到着',
    raceResults: '結果',
    raceFingerprint: 'この曲の音階',
    raceRematch: '再戦',
    raceNewSong: '別の曲',
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
    instrumentColumn: 'Instrument',
    moodLabel: 'Mood',
    tempLabel: 'Temperature',
    tokyo: 'Tokyo',
    language: 'Language',
    closeSettings: 'Close settings',
    modeRace: 'Train Race',
    modeRaceTagline: 'the song drives the trains',
    raceNotesLabel: 'Notes',
    raceEnter: 'Play',
    raceHome: 'Home',
    raceBack: 'Back',
    raceNext: 'Next',
    raceStepSong: 'Song',
    raceStepLineup: 'Lines',
    raceStepDraw: 'Draw',
    raceStepRace: 'Race',
    raceSongLabel: 'YouTube link',
    raceSongPlaceholder: 'https://youtu.be/…',
    raceSongInvalid: "That doesn't look like a YouTube link",
    raceSongLoading: 'Loading…',
    raceSongNotEmbeddable: "This video can't be played here.",
    raceSongUnavailable: 'Video not found or unavailable.',
    raceSongLive: 'Live stream or unknown length — choose a race length.',
    racePlayMyself: "I'll play it myself",
    racePlayMyselfHint: 'Play the song on any device nearby — the mic will listen.',
    raceLength: 'Race length',
    raceMinutes: 'min',
    raceLineupHint: 'Choose 2–12 lines',
    racePlayerName: 'Player (optional)',
    raceDraw: 'Draw',
    raceRedraw: 'Redraw',
    raceToStart: 'To the start line',
    raceStart: 'Start',
    raceMicNeeded: 'The mic listens to the song — play it through speakers.',
    raceMicDenied: 'Microphone access is blocked. Allow it from the icon in the address bar.',
    raceMicUnsupported: 'A microphone and an HTTPS connection are required.',
    raceMicUnavailable: 'No microphone found.',
    raceRetry: 'Retry',
    raceListening: 'Listening',
    raceCantHear: "Can't hear the song — turn up the speakers",
    raceTapToPlay: 'Tap to play',
    racePlayNow: 'Play your song now',
    racePause: 'Pause',
    raceResume: 'Resume',
    raceStop: 'Stop',
    raceNowAt: 'now at',
    raceArrived: 'Arrived',
    raceResults: 'Results',
    raceFingerprint: "This song's notes",
    raceRematch: 'Rematch',
    raceNewSong: 'New song',
  },
} as const;

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('ja');
  const t = (key: keyof typeof TRANSLATIONS['ja']) => TRANSLATIONS[language][key];
  const tInstrument = (instrument: string) => {
    const map = language === 'ja' ? INSTRUMENTS_JA : INSTRUMENTS_EN;
    const translated = map[instrument];
    if (translated === undefined) {
      // In dev, surface missing translations loudly so a new instrument
      // added to lines.json can't silently render as its raw English key
      // in the middle of Japanese UI (the original bug this guards).
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] Missing ${language} translation for instrument: "${instrument}"`);
      }
      return instrument;
    }
    return translated;
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
