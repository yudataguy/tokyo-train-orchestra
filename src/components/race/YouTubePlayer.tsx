'use client';

import { useEffect, useRef } from 'react';
import { loadYouTubeApi, type YTPlayer } from '../../race/youtube';

interface YouTubePlayerProps {
  videoId: string;
  onReady?: (player: YTPlayer) => void;
  onStateChange?: (state: number) => void;
  onError?: (code: number) => void;
  className?: string;
}

export default function YouTubePlayer({ videoId, onReady, onStateChange, onError, className }: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handlersRef = useRef({ onReady, onStateChange, onError });
  useEffect(() => {
    handlersRef.current = { onReady, onStateChange, onError };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // YT.Player *replaces* the element it is given with an iframe. Handing it
    // a React-rendered node would corrupt React's tree, so it gets a plain
    // child div that React never knows about.
    const mount = document.createElement('div');
    host.appendChild(mount);
    let player: YTPlayer | null = null;
    let cancelled = false;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(mount, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { playsinline: 1, rel: 0 },
          events: {
            onReady: (e) => handlersRef.current.onReady?.(e.target),
            onStateChange: (e) => handlersRef.current.onStateChange?.(e.data),
            onError: (e) => handlersRef.current.onError?.(e.data),
          },
        });
      })
      .catch(() => {
        if (!cancelled) handlersRef.current.onError?.(-1);
      });

    return () => {
      cancelled = true;
      player?.destroy();
      host.replaceChildren();
    };
  }, [videoId]);

  return <div ref={hostRef} className={className} />;
}
