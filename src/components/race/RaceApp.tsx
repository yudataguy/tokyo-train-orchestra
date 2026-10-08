'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LineConfig } from '../../types';
import linesData from '../../config/lines.json';
import { LanguageProvider, useLanguage } from '../../i18n/useLanguage';
import type { RaceState } from '../../race/raceEngine';
import type { Entry, SongChoice, Step } from './types';

const LINES = linesData as LineConfig[];
const LINES_BY_ID = new Map(LINES.map((l) => [l.id, l]));

const STEP_LABELS = [
  ['song', 'raceStepSong'],
  ['lineup', 'raceStepLineup'],
  ['draw', 'raceStepDraw'],
  ['race', 'raceStepRace'],
] as const;

function RaceInner() {
  const { language, setLanguage, t } = useLanguage();
  const [step, setStep] = useState<Step>('song');
  const [song, setSong] = useState<SongChoice | null>(null);
  const [entries, setEntriesRaw] = useState<Entry[]>([]);
  const [assignment, setAssignment] = useState<Record<string, number> | null>(null);
  const [result, setResult] = useState<RaceState | null>(null);

  // A changed lineup invalidates any previous draw.
  const setEntries = (next: Entry[]) => {
    setEntriesRaw(next);
    setAssignment(null);
  };

  const activeStep: Step = step === 'results' ? 'race' : step;

  return (
    <main className="h-screen w-screen overflow-y-auto bg-[var(--paper)] text-[var(--ink)]">
      <div className="flex h-[5px] w-full" aria-hidden="true">
        {LINES.map((line, i) => (
          <div key={line.id} className="band-seg flex-1" style={{ background: line.color, animationDelay: `${i * 18}ms` }} />
        ))}
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 pb-10 sm:px-8">
        <header className="flex items-end justify-between gap-4 pt-5 pb-4">
          <div className="min-w-0">
            <Link href="/" className="text-[12px] text-[var(--ink-2)] hover:text-[var(--ink)]">
              ← {t('raceHome')}
            </Link>
            <h1 className="text-[25px] leading-tight font-bold tracking-tight sm:text-[31px]">{t('modeRace')}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <ol className="hidden gap-3 text-[12px] text-[var(--ink-2)] sm:flex">
              {STEP_LABELS.map(([key, label], i) => (
                <li
                  key={key}
                  aria-current={activeStep === key ? 'step' : undefined}
                  className={activeStep === key ? 'font-bold text-[var(--ink)]' : undefined}
                >
                  <span className="tnum">{i + 1}</span> {t(label)}
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="chip px-2 py-1 text-[12px]"
              onClick={() => setLanguage(language === 'ja' ? 'en' : 'ja')}
            >
              {language === 'ja' ? 'EN' : '日本語'}
            </button>
          </div>
        </header>

        {/* steps */}
      </div>
    </main>
  );
}

export default function RaceApp() {
  return (
    <LanguageProvider>
      <RaceInner />
    </LanguageProvider>
  );
}
