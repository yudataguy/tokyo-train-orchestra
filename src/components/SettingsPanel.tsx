'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
  const titleId = useId();
  const volumeId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Focus management: when the dialog opens, remember who was focused and
  // move focus into the panel; on close, return focus to the opener. Also
  // wire up Escape-to-close and a basic focus trap so Tab stays inside.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

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
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="absolute top-0 right-0 bottom-0 z-[1100] w-full sm:w-80 bg-slate-900/95 backdrop-blur-lg border-l border-slate-700 p-5 overflow-y-auto"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 id={titleId} className="text-white font-semibold text-lg">{t('settings')}</h2>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="text-gray-300 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded"
          aria-label={t('closeSettings')}
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>

      <fieldset className="mb-6 border-0 p-0 m-0">
        <legend className="text-xs uppercase tracking-wider text-gray-300 block mb-2">{t('musicMode')}</legend>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onMusicModeChange('ambient')}
            aria-pressed={musicMode === 'ambient'}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              musicMode === 'ambient' ? 'bg-[#003DA5] text-white' : 'bg-slate-800 text-gray-200'
            }`}
          >
            {t('modeAmbient')}
          </button>
          <button
            type="button"
            onClick={() => onMusicModeChange('edm')}
            aria-pressed={musicMode === 'edm'}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              musicMode === 'edm' ? 'bg-[#003DA5] text-white' : 'bg-slate-800 text-gray-200'
            }`}
          >
            {t('modeEdm')}
          </button>
        </div>
      </fieldset>

      <fieldset className="mb-6 border-0 p-0 m-0">
        <legend className="text-xs uppercase tracking-wider text-gray-300 block mb-2">{t('language')}</legend>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLanguage('ja')}
            aria-pressed={language === 'ja'}
            lang="ja"
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              language === 'ja' ? 'bg-[#003DA5] text-white' : 'bg-slate-800 text-gray-200'
            }`}
          >
            日本語
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            aria-pressed={language === 'en'}
            lang="en"
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              language === 'en' ? 'bg-[#003DA5] text-white' : 'bg-slate-800 text-gray-200'
            }`}
          >
            English
          </button>
        </div>
      </fieldset>

      <div className="mb-6">
        <label htmlFor={volumeId} className="text-xs uppercase tracking-wider text-gray-300 block mb-2">{t('masterVolume')}</label>
        <input
          id={volumeId}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          aria-valuetext={`${Math.round(volume * 100)}%`}
          className="w-full accent-[#003DA5]"
        />
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wider text-gray-300 block mb-3">{t('lines')}</h3>
        <div className="space-y-2">
          {COMPANY_ORDER.map((company) => {
            const groupLines = groups[company];
            if (groupLines.length === 0) return null;
            const isExpanded = expanded.has(company);
            const mutedCount = groupLines.filter((l) => mutedLines.has(l.id)).length;
            const audibleCount = groupLines.length - mutedCount;
            const groupId = `settings-group-${company}`;
            return (
              <div key={company}>
                <button
                  type="button"
                  onClick={() => toggleGroup(company)}
                  aria-expanded={isExpanded}
                  aria-controls={groupId}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-colors"
                >
                  <span aria-hidden="true" className={`text-gray-300 text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                  <span className="text-sm font-medium text-gray-100 flex-1 text-left">{t(COMPANY_LABEL_KEY[company])}</span>
                  <span className="text-xs text-gray-300">
                    <span aria-hidden="true">{audibleCount}/{groupLines.length}</span>
                    <span className="sr-only">{audibleCount} of {groupLines.length} lines audible</span>
                  </span>
                </button>
                {isExpanded && (
                  <ul id={groupId} className="mt-1 ml-2 space-y-1 list-none p-0 m-0">
                    {groupLines.map((line) => {
                      const isMuted = mutedLines.has(line.id);
                      const lineName = language === 'ja' ? line.nameJa : line.name;
                      return (
                        <li key={line.id}>
                          <button
                            type="button"
                            onClick={() => onToggleMute(line.id)}
                            aria-pressed={!isMuted}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isMuted ? 'opacity-50' : 'opacity-100'} hover:bg-slate-800`}
                          >
                            <span aria-hidden="true" className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: line.color }} />
                            <span className="text-sm text-gray-100 flex-1 text-left">{lineName}</span>
                            <span className="text-xs text-gray-300">{tInstrument(line.instrument)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
