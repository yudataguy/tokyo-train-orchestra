'use client';

import { useEffect, useRef, useState } from 'react';
import type { LineConfig } from '../../types';
import { useLanguage } from '../../i18n/useLanguage';
import { OnsetDetector } from '../../race/onsets';
import { advance, createRace, formatClock, frameDt, type RaceState } from '../../race/raceEngine';
import { MicError, openMic, type MicAnalyser, type MicErrorKind } from '../../race/micAnalyser';
import { YT_STATE, type YTPlayer } from '../../race/youtube';
import YouTubePlayer from './YouTubePlayer';
import LaneBoard from './LaneBoard';
import NoteBars, { noteColors } from './NoteBars';
import type { Entry, SongChoice } from './types';

const COUNTDOWN_SEC = 3;
/** Seconds of race clock with no onsets before suggesting louder speakers. */
const CANT_HEAR_SEC = 8;
/** If YouTube isn't PLAYING this long after playVideo(), autoplay was blocked. */
const AUTOPLAY_GRACE_MS = 2000;

const MIC_ERROR_KEY = {
  denied: 'raceMicDenied',
  unsupported: 'raceMicUnsupported',
  unavailable: 'raceMicUnavailable',
} as const;

type Phase = 'ready' | 'countdown' | 'running';

interface RaceStepProps {
  linesById: Map<string, LineConfig>;
  song: SongChoice;
  entries: Entry[];
  assignment: Record<string, number>;
  onBack: () => void;
  onFinish: (state: RaceState) => void;
}

export default function RaceStep({ linesById, song, entries, assignment, onBack, onFinish }: RaceStepProps) {
  const { t } = useLanguage();
  const [race, setRace] = useState<RaceState>(() =>
    createRace(
      entries.map((e) => ({
        lineId: e.lineId,
        pitchClass: assignment[e.lineId],
        stationCount: linesById.get(e.lineId)!.stations.length,
      })),
      song.durationSec,
    ),
  );
  const [phase, setPhase] = useState<Phase>('ready');
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [mic, setMic] = useState<MicAnalyser | null>(null);
  const [starting, setStarting] = useState(false);
  const [micError, setMicError] = useState<MicErrorKind | null>(null);
  const [chroma, setChroma] = useState<number[]>(() => new Array(12).fill(0));
  const [cantHear, setCantHear] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [paused, setPaused] = useState(false);

  // Hot-path state lives in refs: the analysis callback runs ~30×/s outside
  // React and must see the latest values without re-subscribing.
  const raceRef = useRef(race);
  const phaseRef = useRef<Phase>('ready');
  const pausedRef = useRef(false);
  const detectorRef = useRef<OnsetDetector | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const lastOnsetAtRef = useRef(0);
  const finishedRef = useRef(false);
  const mountedRef = useRef(true);
  const onFinishRef = useRef(onFinish);
  const onFrameRef = useRef<(chroma: number[], nowMs: number) => void>(() => {});

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinishRef.current(raceRef.current);
  };

  const isPlaying = () =>
    song.videoId ? playerRef.current?.getPlayerState() === YT_STATE.PLAYING : !pausedRef.current;

  const onFrame = (frame: number[], nowMs: number) => {
    setChroma(frame);
    const detector = detectorRef.current;
    if (!detector) return;
    if (phaseRef.current === 'countdown') {
      detector.calibrate(frame);
      return;
    }
    if (phaseRef.current !== 'running' || finishedRef.current) return;
    const dt = frameDt(lastFrameRef.current, nowMs, isPlaying());
    lastFrameRef.current = nowMs;
    const onsets = detector.push(frame, nowMs);
    if (dt === 0) return;
    const next = advance(raceRef.current, onsets, dt);
    if (onsets.some(Boolean)) lastOnsetAtRef.current = next.elapsedSec;
    raceRef.current = next;
    setRace(next);
    setCantHear(next.elapsedSec - lastOnsetAtRef.current > CANT_HEAR_SEC);
    if (song.endsOnTime && next.elapsedSec >= song.durationSec) finish();
  };

  useEffect(() => {
    onFinishRef.current = onFinish;
    onFrameRef.current = onFrame;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // The mic's lifetime is this component's: opened on Start, closed on
  // unmount (results, back, or leaving the page).
  useEffect(() => {
    if (!mic) return;
    mic.start((frame, nowMs) => onFrameRef.current(frame, nowMs));
    return () => {
      void mic.close();
    };
  }, [mic]);

  // Countdown: also the room-noise calibration window, since it is the only
  // moment we know the mic hears the room and not the song.
  useEffect(() => {
    if (phase !== 'countdown') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < COUNTDOWN_SEC; i++) {
      timers.push(setTimeout(() => setCountdown(COUNTDOWN_SEC - i), i * 1000));
    }
    timers.push(setTimeout(() => {
      phaseRef.current = 'running';
      lastFrameRef.current = null;
      setPhase('running');
      if (song.videoId) playerRef.current?.playVideo();
    }, COUNTDOWN_SEC * 1000));
    return () => timers.forEach(clearTimeout);
  }, [phase, song.videoId]);

  useEffect(() => {
    if (phase !== 'running' || !song.videoId) return;
    const id = setTimeout(() => {
      if (playerRef.current?.getPlayerState() !== YT_STATE.PLAYING) setNeedsTap(true);
    }, AUTOPLAY_GRACE_MS);
    return () => clearTimeout(id);
  }, [phase, song.videoId]);

  const handleStart = async () => {
    setMicError(null);
    setStarting(true);
    try {
      const opened = await openMic();
      if (!mountedRef.current) {
        void opened.close();
        return;
      }
      detectorRef.current = new OnsetDetector();
      phaseRef.current = 'countdown';
      setCountdown(COUNTDOWN_SEC);
      setPhase('countdown');
      setMic(opened);
    } catch (err) {
      setMicError(err instanceof MicError ? err.kind : 'unavailable');
    } finally {
      setStarting(false);
    }
  };

  const handleStop = () => {
    playerRef.current?.pauseVideo();
    finish();
  };

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  const colors = noteColors(race.lanes, linesById);

  return (
    <section>
      <div className="grid gap-4 pb-4 sm:grid-cols-[minmax(0,22rem)_1fr]">
        {song.videoId ? (
          <div className="relative">
            <YouTubePlayer
              videoId={song.videoId}
              className="aspect-video w-full overflow-hidden rounded-[2px] bg-black/5"
              onReady={(player) => {
                playerRef.current = player;
              }}
              onStateChange={(state) => {
                if (state === YT_STATE.PLAYING) setNeedsTap(false);
                if (state === YT_STATE.ENDED && phaseRef.current === 'running') finish();
              }}
            />
            {needsTap && (
              <button
                type="button"
                className="race-primary absolute inset-0 m-auto h-fit w-fit"
                onClick={() => playerRef.current?.playVideo()}
              >
                {t('raceTapToPlay')}
              </button>
            )}
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-[2px] border border-[var(--rule)] p-4 text-center text-[14px] text-[var(--ink-2)]">
            {phase === 'running' ? t('racePlayNow') : t('racePlayMyselfHint')}
          </div>
        )}

        <div className="flex min-w-0 flex-col justify-between gap-3">
          {phase === 'ready' && (
            <div>
              <p className="pb-3 text-[13px] text-[var(--ink-2)]">{t('raceMicNeeded')}</p>
              {micError && (
                <p role="alert" className="pb-3 text-[13px] text-[#A8420B]">{t(MIC_ERROR_KEY[micError])}</p>
              )}
              <div className="flex gap-3">
                <button type="button" className="race-primary" disabled={starting} onClick={handleStart}>
                  {micError ? t('raceRetry') : t('raceStart')}
                </button>
                <button type="button" className="chip px-3 py-1.5 text-[13px]" onClick={onBack}>{t('raceBack')}</button>
              </div>
            </div>
          )}

          {phase === 'countdown' && (
            <div className="tnum text-[64px] leading-none font-bold" aria-live="assertive">{countdown}</div>
          )}

          {phase === 'running' && (
            <div>
              <div className="tnum text-[26px] leading-none font-medium">
                {formatClock(race.elapsedSec)}
                <span className="text-[16px] text-[var(--ink-2)]"> / {formatClock(song.durationSec)}</span>
              </div>
              {cantHear && <p role="status" className="pt-2 text-[13px] text-[#A8420B]">{t('raceCantHear')}</p>}
              <div className="flex gap-3 pt-3">
                {!song.videoId && (
                  <button type="button" className="chip px-3 py-1.5 text-[13px]" onClick={togglePause}>
                    {paused ? t('raceResume') : t('racePause')}
                  </button>
                )}
                <button type="button" className="chip px-3 py-1.5 text-[13px]" onClick={handleStop}>{t('raceStop')}</button>
              </div>
            </div>
          )}

          {phase !== 'ready' && (
            <div>
              <p className="pb-1 text-[11px] text-[var(--ink-2)]">{t('raceListening')}</p>
              <NoteBars values={chroma} colors={colors} height={28} />
            </div>
          )}
        </div>
      </div>

      <LaneBoard linesById={linesById} entries={entries} state={race} />
    </section>
  );
}
