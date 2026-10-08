'use client';

import { useRef, useState } from 'react';
import { useLanguage } from '../../i18n/useLanguage';
import { classifyYouTubeError, parseYouTubeId } from '../../race/youtube';
import YouTubePlayer from './YouTubePlayer';
import type { SongChoice } from './types';

const LENGTH_OPTIONS = [2, 3, 4, 5];

/** What the preview player told us about a specific video ID. Keyed by ID so
 *  editing the URL invalidates it without an effect. */
type Probe = { id: string; status: 'ready' | 'live' | 'notEmbeddable' | 'unavailable'; durationSec: number };

interface SongStepProps {
  initial: SongChoice | null;
  onNext: (song: SongChoice) => void;
}

export default function SongStep({ initial, onNext }: SongStepProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [manual, setManual] = useState(initial !== null && initial.videoId === null);
  const [input, setInput] = useState(initial?.videoId ? `https://youtu.be/${initial.videoId}` : '');
  const [minutes, setMinutes] = useState(initial?.endsOnTime ? Math.round(initial.durationSec / 60) : 3);
  const [probe, setProbe] = useState<Probe | null>(null);

  const videoId = manual ? null : parseYouTubeId(input);
  const invalid = !manual && input.trim() !== '' && videoId === null;
  const status = videoId === null ? 'idle' : probe?.id === videoId ? probe.status : 'loading';
  const needsLength = manual || status === 'live';
  const canNext = manual || status === 'ready' || status === 'live';

  const handleNext = () => {
    if (manual) onNext({ videoId: null, durationSec: minutes * 60, endsOnTime: true });
    else if (videoId && probe && status === 'ready') onNext({ videoId, durationSec: probe.durationSec, endsOnTime: false });
    else if (videoId && status === 'live') onNext({ videoId, durationSec: minutes * 60, endsOnTime: true });
  };

  return (
    <section className="max-w-2xl">
      {!manual && (
        <>
          <label htmlFor="race-url" className="block pb-1.5 text-[12px] text-[var(--ink-2)]">{t('raceSongLabel')}</label>
          <input
            id="race-url"
            ref={inputRef}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('raceSongPlaceholder')}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'race-url-error' : undefined}
            className="w-full rounded-[2px] border border-[var(--rule)] bg-transparent px-3 py-2 text-[14px] focus:border-[var(--ink)]"
          />
          {invalid && <p id="race-url-error" className="pt-1.5 text-[12.5px] text-[#A8420B]">{t('raceSongInvalid')}</p>}

          {videoId && (
            <div className="mt-4">
              <YouTubePlayer
                key={videoId}
                videoId={videoId}
                className="aspect-video w-full overflow-hidden rounded-[2px] bg-black/5"
                onReady={(player) => {
                  const d = player.getDuration();
                  setProbe({ id: videoId, status: d > 0 ? 'ready' : 'live', durationSec: d });
                }}
                onError={(code) => {
                  setProbe({ id: videoId, status: classifyYouTubeError(code), durationSec: 0 });
                  if (classifyYouTubeError(code) === 'unavailable') inputRef.current?.focus();
                }}
              />
              <p role="status" className="pt-2 text-[12.5px] text-[var(--ink-2)]">
                {status === 'loading' && t('raceSongLoading')}
                {status === 'live' && t('raceSongLive')}
                {status === 'unavailable' && <span className="text-[#A8420B]">{t('raceSongUnavailable')}</span>}
                {status === 'notEmbeddable' && (
                  <span className="text-[#A8420B]">
                    {t('raceSongNotEmbeddable')}{' '}
                    <button type="button" className="underline" onClick={() => setManual(true)}>
                      {t('racePlayMyself')}
                    </button>
                  </span>
                )}
              </p>
            </div>
          )}
        </>
      )}

      {manual && <p className="text-[14px] text-[var(--ink-2)]">{t('racePlayMyselfHint')}</p>}

      {needsLength && (
        <div className="mt-4">
          <h2 id="race-length-label" className="pb-1.5 text-[12px] text-[var(--ink-2)]">{t('raceLength')}</h2>
          <div role="group" aria-labelledby="race-length-label" className="flex gap-2">
            {LENGTH_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m}
                onClick={() => setMinutes(m)}
                className="chip tnum px-3 py-1.5 text-[13px]"
                style={{ '--accent': 'var(--ink)' } as React.CSSProperties}
              >
                {m} {t('raceMinutes')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button type="button" className="race-primary" disabled={!canNext} onClick={handleNext}>
          {t('raceNext')}
        </button>
        <button
          type="button"
          aria-pressed={manual}
          onClick={() => setManual((m) => !m)}
          className="chip px-3 py-1.5 text-[13px]"
          style={{ '--accent': 'var(--ink)' } as React.CSSProperties}
        >
          {t('racePlayMyself')}
        </button>
      </div>
    </section>
  );
}
