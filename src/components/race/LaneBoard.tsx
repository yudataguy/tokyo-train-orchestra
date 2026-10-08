import type { LineConfig } from '../../types';
import { useLanguage } from '../../i18n/useLanguage';
import { PITCH_NAMES } from '../../race/chroma';
import { currentStationIndex, formatClock, type RaceState } from '../../race/raceEngine';
import type { Entry } from './types';

interface LaneBoardProps {
  linesById: Map<string, LineConfig>;
  entries: Entry[];
  state: RaceState;
}

export default function LaneBoard({ linesById, entries, state }: LaneBoardProps) {
  const { language, t } = useLanguage();
  const players = new Map(entries.map((e) => [e.lineId, e.player]));

  return (
    <ol className="border-t border-[var(--rule)]">
      {state.lanes.map((lane) => {
        const line = linesById.get(lane.lineId)!;
        const n = lane.stationCount;
        const station = line.stations[currentStationIndex(lane)];
        const player = players.get(lane.lineId);
        const finished = lane.finishedAtSec !== null;
        return (
          <li
            key={lane.lineId}
            className="grid grid-cols-[2.25rem_3px_minmax(0,8.5rem)_1fr] items-center gap-x-3 border-b border-[var(--rule)] py-2 sm:grid-cols-[2.5rem_3px_minmax(0,11rem)_1fr]"
          >
            <span className="tnum text-center text-[15px] font-bold">{PITCH_NAMES[lane.pitchClass]}</span>
            <span className="self-stretch" style={{ background: line.color }} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-medium">
                {language === 'ja' ? line.nameJa : line.name}
                {player && <span className="font-normal text-[var(--ink-2)]"> · {player}</span>}
              </span>
              <span className="block truncate text-[11.5px] text-[var(--ink-2)]">
                {finished
                  ? `${t('raceArrived')} ${formatClock(lane.finishedAtSec!)}`
                  : `${t('raceNowAt')} ${language === 'ja' ? station.nameJa : station.name}`}
              </span>
            </span>
            <div className="relative mr-3 h-7" aria-hidden="true">
              <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-[var(--rule)]" />
              <div
                className="race-fill absolute top-1/2 left-0 h-[3px] -translate-y-1/2"
                style={{ width: `${lane.progress * 100}%`, background: line.color }}
              />
              {line.stations.map((s, i) => (
                <span
                  key={s.id}
                  className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border bg-[var(--paper)]"
                  style={{ left: `${n > 1 ? (i / (n - 1)) * 100 : 0}%`, borderColor: line.color }}
                />
              ))}
              <span className="absolute top-0 right-0 h-full w-[3px] translate-x-1/2 bg-[var(--ink)]" />
              <span
                className={`race-train${finished ? ' race-idle' : ''}`}
                style={{ left: `${lane.progress * 100}%`, background: line.color }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
