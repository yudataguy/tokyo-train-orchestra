const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Video ID from the URL shapes people actually paste, or null. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/shorts\/([^/]+)/)?.[1] ?? null;
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

/** IFrame API error codes: 101/150 mean the owner disabled embedding (common
 *  for label-owned music videos); 2/5/100 mean bad ID / HTML5 error / gone.
 *  -1 is ours: the API script itself failed to load. */
export function classifyYouTubeError(code: number): 'notEmbeddable' | 'unavailable' {
  return code === 101 || code === 150 ? 'notEmbeddable' : 'unavailable';
}

export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

/** The slice of the IFrame Player API we use, declared locally instead of
 *  pulling in @types/youtube. */
export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

export interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/** Inject the IFrame API script once; later calls share the same promise.
 *  A failed load clears the cache so the next attempt retries. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      script.remove();
      reject(new Error('YouTube IFrame API failed to load'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}
