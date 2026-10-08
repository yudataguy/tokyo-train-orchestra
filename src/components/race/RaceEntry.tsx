'use client';

import dynamic from 'next/dynamic';

// Client-only: the race touches window, AudioContext and the YouTube API on
// mount. `ssr: false` is not allowed in a Server Component in Next 16, which
// is why this tiny client wrapper exists between page.tsx and RaceApp.
const RaceApp = dynamic(() => import('./RaceApp'), { ssr: false });

export default function RaceEntry() {
  return <RaceApp />;
}
