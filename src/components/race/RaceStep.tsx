'use client';

import { useEffect, useRef, useState } from 'react';
import type { LineConfig } from '../../types';
import { useLanguage } from '../../i18n/useLanguage';
import { MIN_CALIBRATION_FRAMES, OnsetDetector } from '../../race/onsets';
import { advance, createRace, formatClock, frameDt, type RaceState } from '../../race/raceEngine';
import { MicError, openMic, type MicAnalyser, type MicErrorKind } from '../../race/micAnalyser';
import { classifyYouTubeError, YT_STATE, type YTPlayer } from '../../race/youtube';
import YouTubePlayer from './YouTubePlayer';
import LaneBoard from './LaneBoard';
import NoteBars, { noteColors } from './NoteBars';
import type { SongChoice } from './types';

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

const PLAYER_ERROR_KEY = {
  notEmbeddable: 'raceSongNotEmbeddable',
  unavailable: 'raceSongUnavailable',
} as const;

type Phase = 'ready' | 'countdown' | 'running';

interface RaceStepProps {
  linesById: Map<string, LineConfig>;
  song: SongChoice;
  lineup: string[];
  assignment: Record<string, number>;
  onBack: () => void;
  onFinish: (state: RaceState) => void;
}

export default function RaceStep({ linesById, song, lineup, assignment, onBack, onFinish }: RaceStepProps) {
  const { t } = useLanguage();
  const [race, setRace] = useState<RaceState>(() =>
    createRace(
      lineup.map((lineId) => ({
        lineId,
        pitchClass: assignment[lineId],
        stationCount: linesById.get(lineId)!.stations.length,
      })),
      song.durationSec,
    ),
  );
  const [phase, setPhase] = useState<Phase>('ready');
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [mic, setMic] = useState<MicAnalyser | null>(null);
  const [starting, setStarting] = useState(false);
  const [micError, setMicError] = useState<MicErrorKind | null>(null);
  const [micLost, setMicLost] = useState(false);
  const [playerError, setPlayerError] = useState<'notEmbeddable' | 'unavailable' | null>(null);
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
  const countdownDoneRef = useRef(false);
  const finishedRef = useRef(false);
  const mountedRef = useRef(true);
  const onFinishRef = useRef(onFinish);
  const onFrameRef = useRef<(chroma: number[], nowMs: number) => void>(() => {});
  const beginRef = useRef<() => void>(() => {});

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinishRef.current(raceRef.current);
  };

  const isPlaying = () =>
    song.videoId ? playerRef.current?.getPlayerState() === YT_STATE.PLAYING : !pausedRef.current;

  /** Countdown over → race on, but only once the room has actually been
   *  heard: a countdown that ran in a hidden tab got no frames, and starting
   *  then would leave the silence floor at 0. */
  const begin = () => {
    const detector = detectorRef.current;
    if (phaseRef.current !== 'countdown' || !countdownDoneRef.current) return;
    if (!detector || detector.calibrationFrames < MIN_CALIBRATION_FRAMES) return;
    phaseRef.current = 'running';
    lastFrameRef.current = null;
    setPhase('running');
    if (song.videoId) playerRef.current?.playVideo();
  };

  const onFrame = (frame: number[], nowMs: number) => {
    setChroma(frame);
    const detector = detectorRef.current;
    if (!detector) return;
    if (phaseRef.current === 'countdown') {
      detector.calibrate(frame);
      begin();
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
    if (song.endsOnTime && next.elapsedSec >= song.durationSec) {
      playerRef.current?.pauseVideo();
      finish();
    }
  };

  useEffect(() => {
    onFinishRef.current = onFinish;
    onFrameRef.current = onFrame;
    beginRef.current = begin;
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
      countdownDoneRef.current = true;
      beginRef.current();
    }, COUNTDOWN_SEC * 1000));
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'running' || !song.videoId) return;
    const id = setTimeout(() => {
      if (playerRef.current?.getPlayerState() !== YT_STATE.PLAYING) setNeedsTap(true);
    }, AUTOPLAY_GRACE_MS);
    return () => clearTimeout(id);
  }, [phase, song.videoId]);

  const handleStart = async () => {
    setMicError(null);
    setMicLost(false);
    setStarting(true);
    try {
      const opened = await openMic(() => setMicLost(true));
      if (!mountedRef.current) {
        void opened.close();
        return;
      }
      // The countdown measures the room, so the song must not already be
      // playing — and the race budget assumes it starts from the top.
      if (song.videoId) {
        playerRef.current?.pauseVideo();
        playerRef.current?.seekTo(0, true);
      }
      detectorRef.current = new OnsetDetector();
      countdownDoneRef.current = false;
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
                // Slow load: the countdown may already be over.
                if (phaseRef.current === 'running') player.playVideo();
              }}
              onStateChange={(state) => {
                if (state === YT_STATE.PLAYING) setNeedsTap(false);
                if (state === YT_STATE.ENDED && phaseRef.current === 'running') finish();
              }}
              onError={(code) => {
                setPlayerError(classifyYouTubeError(code));
                setNeedsTap(false);
              }}
            />
            {/* A hint, not a button: where autoplay is blocked (Safari,
                mobile) only a tap on YouTube's own player counts as a user
                gesture, so taps must pass through to it. */}
            {needsTap && !playerError && (
              <p
                role="status"
                className="pointer-events-none absolute inset-x-0 top-0 bg-[var(--ink)]/85 px-3 py-1.5 text-center text-[13px] text-[var(--paper)]"
              >
                {t('raceTapToPlay')}
              </p>
            )}
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-[2px] border border-[var(--rule)] p-4 text-center text-[14px] text-[var(--ink-2)]">
            {phase === 'running' ? t('racePlayNow') : t('raceWaitCountdown')}
          </div>
        )}

        <div className="flex min-w-0 flex-col justify-between gap-3">
          {playerError && (
            <p role="alert" className="text-[13px] text-[#A8420B]">{t(PLAYER_ERROR_KEY[playerError])}</p>
          )}

          {phase === 'ready' && (
            <div>
              <p className="pb-3 text-[13px] text-[var(--ink-2)]">{t('raceMicNeeded')}</p>
              {micError && (
                <p role="alert" className="pb-3 text-[13px] text-[#A8420B]">{t(MIC_ERROR_KEY[micError])}</p>
              )}
              <div className="flex gap-3">
                <button type="button" className="race-primary" disabled={starting || playerError !== null} onClick={handleStart}>
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
              {micLost ? (
                <p role="alert" className="pt-2 text-[13px] text-[#A8420B]">{t('raceMicLost')}</p>
              ) : (
                cantHear && <p role="status" className="pt-2 text-[13px] text-[#A8420B]">{t('raceCantHear')}</p>
              )}
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

      <LaneBoard linesById={linesById} state={race} />
    </section>
  );
}
