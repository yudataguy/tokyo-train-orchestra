'use client';

import type { LineConfig } from '../types';
import { useLanguage } from '../i18n/useLanguage';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  lines: LineConfig[];
  mutedLines: Set<string>;
  onToggleMute: (lineId: string) => void;
  volume: number;
  onVolumeChange: (value: number) => void;
  weatherFxEnabled: boolean;
  onWeatherFxToggle: () => void;
}

export default function SettingsPanel({
  isOpen, onClose, lines, mutedLines, onToggleMute, volume, onVolumeChange, weatherFxEnabled, onWeatherFxToggle,
}: SettingsPanelProps) {
  const { language, setLanguage, t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 bottom-0 z-[1100] w-72 bg-slate-900/95 backdrop-blur-lg border-l border-slate-700 p-5 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white font-semibold text-lg">{t('settings')}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl" aria-label={t('closeSettings')}>&times;</button>
      </div>

      <div className="mb-6">
        <label className="text-xs uppercase tracking-wider text-gray-500 block mb-2">{t('language')}</label>
        <div className="flex gap-2">
          <button
            onClick={() => setLanguage('ja')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              language === 'ja' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-gray-400'
            }`}
          >
            日本語
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              language === 'en' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-gray-400'
            }`}
          >
            English
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label className="text-xs uppercase tracking-wider text-gray-500 block mb-2">{t('masterVolume')}</label>
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => onVolumeChange(parseFloat(e.target.value))} className="w-full accent-indigo-400" />
      </div>

      <div className="mb-6 flex justify-between items-center">
        <label className="text-sm text-gray-300">{t('weatherEffects')}</label>
        <button onClick={onWeatherFxToggle} className={`w-10 h-6 rounded-full transition-colors relative ${weatherFxEnabled ? 'bg-indigo-500' : 'bg-slate-600'}`} aria-label="Toggle weather effects">
          <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${weatherFxEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-gray-500 block mb-3">{t('lines')}</label>
        <div className="space-y-2">
          {lines.map((line) => {
            const isMuted = mutedLines.has(line.id);
            const lineName = language === 'ja' ? line.nameJa : line.name;
            return (
              <button key={line.id} onClick={() => onToggleMute(line.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isMuted ? 'opacity-40' : 'opacity-100'} hover:bg-slate-800`}>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: line.color }} />
                <span className="text-sm text-gray-200 flex-1 text-left">{lineName}</span>
                <span className="text-xs text-gray-500">{line.instrument}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
