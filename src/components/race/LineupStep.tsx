'use client';

import type { LineConfig } from '../../types';
import { useLanguage } from '../../i18n/useLanguage';
import { COMPANY_LABEL_KEY, groupByCompany } from '../../lib/company';
import { MAX_LANES, MIN_LANES } from '../../race/draw';
import type { Entry } from './types';

const MAX_PLAYER_NAME = 16;

interface LineupStepProps {
  lines: LineConfig[];
  entries: Entry[];
  onChange: (entries: Entry[]) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function LineupStep({ lines, entries, onChange, onBack, onNext }: LineupStepProps) {
  const { language, t } = useLanguage();
  const selected = new Set(entries.map((e) => e.lineId));
  const full = entries.length >= MAX_LANES;
  const byId = new Map(lines.map((l) => [l.id, l]));

  const toggle = (lineId: string) => {
    if (selected.has(lineId)) onChange(entries.filter((e) => e.lineId !== lineId));
    else if (!full) onChange([...entries, { lineId, player: '' }]);
  };

  const rename = (lineId: string, player: string) =>
    onChange(entries.map((e) => (e.lineId === lineId ? { ...e, player } : e)));

  return (
    <section>
      <p className="pb-3 text-[13px] text-[var(--ink-2)]">
        {t('raceLineupHint')} · <span className="tnum">{entries.length}/{MAX_LANES}</span>
      </p>

      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {groupByCompany(lines).map(({ company, lines: group }) => (
          <div key={company}>
            <h2 className="border-b border-[var(--rule)] pb-1 text-[12px] font-medium">{t(COMPANY_LABEL_KEY[company])}</h2>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {group.map((line) => (
                <button
                  key={line.id}
                  type="button"
                  aria-pressed={selected.has(line.id)}
                  disabled={full && !selected.has(line.id)}
                  onClick={() => toggle(line.id)}
                  className="chip py-1 pr-2.5 pl-3 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ '--accent': line.color } as React.CSSProperties}
                >
                  {language === 'ja' ? line.nameJa : line.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {entries.length > 0 && (
        <ul className="mt-6 border-t border-[var(--rule)]">
          {entries.map((entry) => {
            const line = byId.get(entry.lineId)!;
            const name = language === 'ja' ? line.nameJa : line.name;
            return (
              <li key={entry.lineId} className="grid grid-cols-[3px_minmax(0,10rem)_1fr] items-stretch gap-x-3 border-b border-[var(--rule)]">
                <span style={{ background: line.color }} aria-hidden="true" />
                <span className="self-center truncate py-1.5 text-[13.5px]">{name}</span>
                <input
                  type="text"
                  value={entry.player}
                  maxLength={MAX_PLAYER_NAME}
                  onChange={(e) => rename(entry.lineId, e.target.value)}
                  placeholder={t('racePlayerName')}
                  aria-label={`${name} — ${t('racePlayerName')}`}
                  className="my-1 rounded-[2px] border border-transparent bg-transparent px-2 py-1 text-[13px] hover:border-[var(--rule)] focus:border-[var(--ink)]"
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button type="button" className="race-primary" disabled={entries.length < MIN_LANES} onClick={onNext}>
          {t('raceNext')}
        </button>
        <button type="button" className="chip px-3 py-1.5 text-[13px]" onClick={onBack}>{t('raceBack')}</button>
      </div>
    </section>
  );
}
