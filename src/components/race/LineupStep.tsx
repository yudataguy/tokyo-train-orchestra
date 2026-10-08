'use client';

import type { LineConfig } from '../../types';
import { useLanguage } from '../../i18n/useLanguage';
import { COMPANY_LABEL_KEY, groupByCompany } from '../../lib/company';
import { MAX_LANES, MIN_LANES } from '../../race/draw';

interface LineupStepProps {
  lines: LineConfig[];
  lineup: string[];
  onChange: (lineup: string[]) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function LineupStep({ lines, lineup, onChange, onBack, onNext }: LineupStepProps) {
  const { language, t } = useLanguage();
  const selected = new Set(lineup);
  const full = lineup.length >= MAX_LANES;

  const toggle = (lineId: string) => {
    if (selected.has(lineId)) onChange(lineup.filter((id) => id !== lineId));
    else if (!full) onChange([...lineup, lineId]);
  };

  return (
    <section>
      <p className="pb-3 text-[13px] text-[var(--ink-2)]">
        {t('raceLineupHint')} · <span className="tnum">{lineup.length}/{MAX_LANES}</span>
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

      <div className="mt-6 flex items-center gap-3">
        <button type="button" className="race-primary" disabled={lineup.length < MIN_LANES} onClick={onNext}>
          {t('raceNext')}
        </button>
        <button type="button" className="chip px-3 py-1.5 text-[13px]" onClick={onBack}>{t('raceBack')}</button>
      </div>
    </section>
  );
}
