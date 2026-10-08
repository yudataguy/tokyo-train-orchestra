'use client';

import { useState } from 'react';
import type { LineConfig } from '../../types';
import { useLanguage } from '../../i18n/useLanguage';
import { drawNotes } from '../../race/draw';
import { PITCH_NAMES } from '../../race/chroma';

interface DrawStepProps {
  linesById: Map<string, LineConfig>;
  lineup: string[];
  assignment: Record<string, number> | null;
  onDraw: (assignment: Record<string, number>) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function DrawStep({ linesById, lineup, assignment, onDraw, onBack, onNext }: DrawStepProps) {
  const { language, t } = useLanguage();
  // Bumped per draw so the reveal animation replays on Redraw.
  const [drawSeq, setDrawSeq] = useState(0);

  const handleDraw = () => {
    onDraw(drawNotes(lineup));
    setDrawSeq((n) => n + 1);
  };

  return (
    <section className="max-w-2xl">
      <ul className="border-t border-[var(--rule)]">
        {lineup.map((lineId, i) => {
          const line = linesById.get(lineId)!;
          const pc = assignment?.[lineId];
          return (
            <li key={lineId} className="grid grid-cols-[3rem_3px_1fr] items-stretch gap-x-3 border-b border-[var(--rule)]">
              <span
                key={`${lineId}-${drawSeq}`}
                className={`tnum self-center py-2 text-center text-[22px] font-bold ${pc !== undefined ? 'race-reveal' : 'text-[var(--rule)]'}`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {pc !== undefined ? PITCH_NAMES[pc] : '?'}
              </span>
              <span style={{ background: line.color }} aria-hidden="true" />
              <span className="self-center py-2 text-[14px]">{language === 'ja' ? line.nameJa : line.name}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex items-center gap-3">
        {assignment ? (
          <>
            <button type="button" className="race-primary" onClick={onNext}>{t('raceToStart')}</button>
            <button type="button" className="chip px-3 py-1.5 text-[13px]" onClick={handleDraw}>{t('raceRedraw')}</button>
          </>
        ) : (
          <button type="button" className="race-primary" onClick={handleDraw}>{t('raceDraw')}</button>
        )}
        <button type="button" className="chip px-3 py-1.5 text-[13px]" onClick={onBack}>{t('raceBack')}</button>
      </div>
    </section>
  );
}
