'use client';

import { useMemo, useState } from 'react';
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
  musicMode: 'ambient' | 'edm';
  onMusicModeChange: (mode: 'ambient' | 'edm') => void;
}

type Company = 'tokyoMetro' | 'toei' | 'jrEast' | 'other';

const COMPANY_ORDER: Company[] = ['tokyoMetro', 'toei', 'jrEast', 'other'];

const COMPANY_LABEL_KEY: Record<Company, 'companyTokyoMetro' | 'companyToei' | 'companyJREast' | 'companyOther'> = {
  tokyoMetro: 'companyTokyoMetro',
  toei: 'companyToei',
  jrEast: 'companyJREast',
  other: 'companyOther',
};

function companyOf(line: LineConfig): Company {
  const r = line.odptRailway;
  if (r.startsWith('odpt.Railway:TokyoMetro.')) return 'tokyoMetro';
  if (r.startsWith('odpt.Railway:Toei.')) return 'toei';
  if (r.startsWith('odpt.Railway:JR-East.')) return 'jrEast';
  return 'other';
}

export default function SettingsPanel({
  isOpen, onClose, lines, mutedLines, onToggleMute, volume, onVolumeChange, musicMode, onMusicModeChange,
}: SettingsPanelProps) {
  const { language, setLanguage, t, tInstrument } = useLanguage();
  const [expanded, setExpanded] = useState<Set<Company>>(new Set());

  const groups = useMemo(() => {
    const g: Record<Company, LineConfig[]> = { tokyoMetro: [], toei: [], jrEast: [], other: [] };
    for (const line of lines) g[companyOf(line)].push(line);
    return g;
  }, [lines]);

  if (!isOpen) return null;

  const toggleGroup = (c: Company) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  return (
    <div className="absolute top-0 right-0 bottom-0 z-[1100] w-full sm:w-80 bg-slate-900/95 backdrop-blur-lg border-l border-slate-700 p-5 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white font-semibold text-lg">{t('settings')}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl" aria-label={t('closeSettings')}>&times;</button>
      </div>

      <div className="mb-6">
        <label className="text-xs uppercase tracking-wider text-gray-500 block mb-2">{t('musicMode')}</label>
        <div className="flex gap-2">
          <button
            onClick={() => onMusicModeChange('ambient')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              musicMode === 'ambient' ? 'bg-[#003DA5] text-white' : 'bg-slate-800 text-gray-400'
            }`}
          >
            {t('modeAmbient')}
          </button>
          <button
            onClick={() => onMusicModeChange('edm')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              musicMode === 'edm' ? 'bg-[#003DA5] text-white' : 'bg-slate-800 text-gray-400'
            }`}
          >
            {t('modeEdm')}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label className="text-xs uppercase tracking-wider text-gray-500 block mb-2">{t('language')}</label>
        <div className="flex gap-2">
          <button
            onClick={() => setLanguage('ja')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              language === 'ja' ? 'bg-[#003DA5] text-white' : 'bg-slate-800 text-gray-400'
            }`}
          >
            日本語
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              language === 'en' ? 'bg-[#003DA5] text-white' : 'bg-slate-800 text-gray-400'
            }`}
          >
            English
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label className="text-xs uppercase tracking-wider text-gray-500 block mb-2">{t('masterVolume')}</label>
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => onVolumeChange(parseFloat(e.target.value))} className="w-full accent-[#003DA5]" />
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-gray-500 block mb-3">{t('lines')}</label>
        <div className="space-y-2">
          {COMPANY_ORDER.map((company) => {
            const groupLines = groups[company];
            if (groupLines.length === 0) return null;
            const isExpanded = expanded.has(company);
            const mutedCount = groupLines.filter((l) => mutedLines.has(l.id)).length;
            const audibleCount = groupLines.length - mutedCount;
            return (
              <div key={company}>
                <button
                  onClick={() => toggleGroup(company)}
                  aria-expanded={isExpanded}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-colors"
                >
                  <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                  <span className="text-sm font-medium text-gray-100 flex-1 text-left">{t(COMPANY_LABEL_KEY[company])}</span>
                  <span className="text-xs text-gray-500">{audibleCount}/{groupLines.length}</span>
                </button>
                {isExpanded && (
                  <div className="mt-1 ml-2 space-y-1">
                    {groupLines.map((line) => {
                      const isMuted = mutedLines.has(line.id);
                      const lineName = language === 'ja' ? line.nameJa : line.name;
                      return (
                        <button key={line.id} onClick={() => onToggleMute(line.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isMuted ? 'opacity-40' : 'opacity-100'} hover:bg-slate-800`}>
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: line.color }} />
                          <span className="text-sm text-gray-200 flex-1 text-left">{lineName}</span>
                          <span className="text-xs text-gray-500">{tInstrument(line.instrument)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
