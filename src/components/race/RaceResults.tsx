'use client';

import type { LineConfig } from '../../types';
import { useLanguage } from '../../i18n/useLanguage';
import { PITCH_NAMES } from '../../race/chroma';
import { formatClock, standings, type RaceState } from '../../race/raceEngine';
import NoteBars, { noteColors } from './NoteBars';

interface RaceResultsProps {
  linesById: Map<string, LineConfig>;
  state: RaceState;
  onRematch: () => void;
  onNewSong: () => void;
}

export default function RaceResults({ linesById, state, onRematch, onNewSong }: RaceResultsProps) {
  const { language, t } = useLanguage();

  return (
    <section className="max-w-2xl">
      <h2 className="pb-2 text-[12px] text-[var(--ink-2)]">{t('raceResults')}</h2>
      <ol className="border-t border-[var(--rule)]">
        {standings(state).map((lane, i) => {
          const line = linesById.get(lane.lineId)!;
          return (
            <li
              key={lane.lineId}
              className="grid grid-cols-[2rem_2.5rem_3px_1fr_auto] items-center gap-x-3 border-b border-[var(--rule)] py-2"
            >
              <span className={`tnum font-bold ${i === 0 ? 'text-[28px]' : 'text-[18px] text-[var(--ink-2)]'}`}>{i + 1}</span>
              <span className="tnum text-[15px] font-bold">{PITCH_NAMES[lane.pitchClass]}</span>
              <span className="self-stretch" style={{ background: line.color }} aria-hidden="true" />
              <span className={i === 0 ? 'text-[17px] font-bold' : 'text-[14px]'}>
                {language === 'ja' ? line.nameJa : line.name}
              </span>
              <span className="tnum text-[13px] text-[var(--ink-2)]">
                {lane.finishedAtSec !== null
                  ? `${t('raceArrived')} ${formatClock(lane.finishedAtSec)}`
                  : `${Math.round(lane.progress * 100)}%`}
              </span>
            </li>
          );
        })}
      </ol>

      <h3 className="pt-6 pb-2 text-[12px] text-[var(--ink-2)]">{t('raceFingerprint')}</h3>
      <NoteBars values={state.classOnsets} colors={noteColors(state.lanes, linesById)} height={80} />

      <div className="mt-6 flex items-center gap-3">
        <button type="button" className="race-primary" onClick={onRematch}>{t('raceRematch')}</button>
        <button type="button" className="chip px-3 py-1.5 text-[13px]" onClick={onNewSong}>{t('raceNewSong')}</button>
      </div>
    </section>
  );
}
