'use client';

import { useEffect, useState } from 'react';
import type { LineConfig, WeatherData } from '../types';
import { useLanguage } from '../i18n/useLanguage';
import { groupByCompany, COMPANY_LABEL_KEY } from '../lib/company';
import { computeVibe } from '../engine/edmVibe';
import { ACCENT_AMBIENT, ACCENT_EDM } from '../lib/accents';

interface StartScreenProps {
  lines: LineConfig[];
  weather: WeatherData | null;
  vibe: ReturnType<typeof computeVibe>;
  dataSourceLabel: 'hybridMode' | 'demoMode' | 'missingApiKey';
  onStart: (mode: 'ambient' | 'edm') => void;
}

/** Wall-clock HH:MM, re-rendered on the minute.
 *
 *  Deliberately starts as null and fills in from an effect: this is a static
 *  export, so rendering a time during the first paint would bake the build
 *  machine's clock into the HTML. The dash placeholder holds the layout for
 *  the one frame before the effect runs. */
function useClock(): string | null {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const render = () => {
      const d = new Date();
      setNow(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    };
    render();
    // Align the first tick to the top of the next minute so the display never
    // sits up to 59s stale; after that a plain 60s interval stays in step.
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      render();
      interval = setInterval(render, 60_000);
    }, msToNextMinute);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, []);

  return now;
}

/** Split operator groups into two visually balanced columns, keeping each
 *  group whole and in order. Rendered as two explicit tracks rather than CSS
 *  `columns-2`: multi-column flows to the *container's height* and then starts
 *  a third column off to the side, which silently clipped the last group. */
function splitIntoColumns<T extends { lines: unknown[] }>(groups: T[]): [T[], T[]] {
  // +1 per group for its header row, so tall groups aren't undercounted.
  const rowsOf = (g: T) => g.lines.length + 1;
  const total = groups.reduce((n, g) => n + rowsOf(g), 0);
  const left: T[] = [];
  let filled = 0;
  let i = 0;
  // Fill the left column while doing so keeps it nearer the halfway mark than
  // stopping would; everything remaining goes right.
  while (i < groups.length - 1 && Math.abs(filled + rowsOf(groups[i]) - total / 2) <= Math.abs(filled - total / 2)) {
    left.push(groups[i]);
    filled += rowsOf(groups[i]);
    i++;
  }
  return [left, groups.slice(i)];
}

export default function StartScreen({ lines, vibe, dataSourceLabel, onStart }: StartScreenProps) {
  const { language, t, tInstrument } = useLanguage();
  const clock = useClock();
  const columns = splitIntoColumns(groupByCompany(lines));

  const moodWord = t(`mood${vibe.mood.charAt(0).toUpperCase()}${vibe.mood.slice(1)}` as 'moodHappy');
  const tempWord = t(`temp${vibe.temp.charAt(0).toUpperCase()}${vibe.temp.slice(1)}` as 'tempCold');
  const lineCount = language === 'ja' ? `${lines.length}${t('lines')}` : `${lines.length} ${t('lines')}`;

  return (
    <main className="paper min-h-screen w-screen overflow-y-auto flex flex-col bg-[var(--paper)] text-[var(--ink)]">
      {/* The palette, stated up front: every line's official color, in service
          order, as one continuous rule. It is the page's only ornament and the
          only place the 23 colors appear at full strength. */}
      <div className="flex h-[5px] w-full shrink-0" aria-hidden="true">
        {lines.map((line, i) => (
          <div
            key={line.id}
            className="band-seg flex-1"
            style={{ background: line.color, animationDelay: `${i * 18}ms` }}
          />
        ))}
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 sm:px-8">
        <header className="flex shrink-0 items-baseline justify-between gap-4 pt-6 pb-4">
          <div className="min-w-0">
            <h1 className="text-[25px] leading-tight font-bold tracking-tight sm:text-[31px]">
              {language === 'ja' ? '東京電車オーケストラ' : 'Tokyo Train Orchestra'}
            </h1>
            <p className="mt-1 text-[13px] text-[var(--ink-2)] sm:text-sm">
              {language === 'ja' ? 'Tokyo Train Orchestra' : '東京電車オーケストラ'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="tnum text-[26px] leading-none font-medium sm:text-[32px]">{clock ?? '--:--'}</div>
            <div className="mt-1.5 text-[11px] text-[var(--ink-2)]">{lineCount}</div>
          </div>
        </header>

        <p className="max-w-[58ch] shrink-0 pb-5 text-[14px] leading-relaxed text-[var(--ink-2)] sm:text-[14.5px]">
          {t('description')}
        </p>

        {/* Music mode. Sits above the roster because it is the only thing
            on this page you act on — behind 23 rows it was below the fold. */}
        <div className="pb-6">
          <h2 id="music-mode-label" className="pb-2 text-[12px] text-[var(--ink-2)]">{t('musicMode')}</h2>
          <div role="group" aria-labelledby="music-mode-label" className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onStart('ambient')}
              style={{ '--accent': ACCENT_AMBIENT } as React.CSSProperties}
              className="plate group grid grid-cols-[3px_1fr_auto] items-stretch gap-x-4 rounded-[2px] border text-left"
              aria-label={`${t('beginListening')} — ${t('modeAmbient')}`}
            >
              <span className="bg-[var(--accent)]" aria-hidden="true" />
              <span className="py-3">
                <span className="block text-[15px] font-bold">{t('modeAmbient')}</span>
                <span className="mt-0.5 block text-[12px] text-[var(--ink-2)]">{t('modeClassicTagline')}</span>
                <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 text-[12px] text-[var(--ink-2)]">
                  <dt>{t('instrumentColumn')}</dt>
                  <dd className="tnum">{lines.length}</dd>
                </dl>
              </span>
              <span className="self-center pr-4 text-[13px] font-medium text-[var(--accent-ink)]" aria-hidden="true">
                {t('beginListening')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onStart('edm')}
              style={{ '--accent': ACCENT_EDM } as React.CSSProperties}
              className="plate group grid grid-cols-[3px_1fr_auto] items-stretch gap-x-4 rounded-[2px] border text-left"
              aria-label={`${t('beginListening')} — ${t('modeEdm')} — ${vibe.bpm} ${t('bpm')}, ${moodWord}, ${tempWord}`}
            >
              <span className="bg-[var(--accent)]" aria-hidden="true" />
              <span className="py-3">
                <span className="block text-[15px] font-bold">{t('modeEdm')}</span>
                <span className="mt-0.5 block text-[12px] text-[var(--ink-2)]">{t('modeEdmTagline')}</span>
                <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 text-[12px] text-[var(--ink-2)]">
                  <dt>{t('bpm')}</dt>
                  <dd className="tnum">{vibe.bpm}</dd>
                  <dt>{t('moodLabel')}</dt>
                  <dd>{moodWord}</dd>
                  <dt>{t('tempLabel')}</dt>
                  <dd>{tempWord}</dd>
                </dl>
              </span>
              <span className="self-center pr-4 text-[13px] font-medium text-[var(--accent-ink)]" aria-hidden="true">
                {t('beginListening')}
              </span>
            </button>
          </div>
        </div>

        {/* Roster. The concept explained by showing it: every line that plays,
            paired with the instrument it plays. Grouped by operator because
            that is how the network is signed in the stations.
            Two tracks on wide viewports: a full-width row strands a line name
            ~650px from its instrument, which is the one pairing this screen
            exists to communicate. */}
        <div className="grid grid-cols-1 gap-x-10 border-t border-[var(--rule)] pt-1 sm:grid-cols-2">
          {columns.map((column, ci) => (
            <div key={ci}>
              {column.map(({ company, lines: groupLines }) => (
                <section key={company} className="mb-1.5">
                  <h2 className="border-b border-[var(--rule)] py-1 pl-[19px] text-[12px] font-medium">
                    {t(COMPANY_LABEL_KEY[company])}
                  </h2>
                  <ul>
                    {groupLines.map((line) => (
                      <li
                        key={line.id}
                        className="grid grid-cols-[3px_1fr_auto] items-stretch gap-x-4 border-b border-[var(--rule)]"
                      >
                        <span style={{ background: line.color }} aria-hidden="true" />
                        <span className="self-center py-[4px] text-[13.5px]">
                          {language === 'ja' ? line.nameJa : line.name}
                        </span>
                        <span className="self-center py-[4px] text-[12.5px] text-[var(--ink-2)]">
                          {tInstrument(line.instrument)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ))}
        </div>

        <p className={`mt-auto border-t border-[var(--rule)] pt-3 pb-5 text-[12px] ${dataSourceLabel === 'missingApiKey' ? 'text-[#A8420B]' : 'text-[var(--ink-2)]'}`}>
          {t(dataSourceLabel)}
        </p>
      </div>
    </main>
  );
}
