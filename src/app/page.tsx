'use client';

import dynamic from 'next/dynamic';

const Orchestra = dynamic(() => import('../components/Orchestra'), { ssr: false });

export default function Home() {
  return <Orchestra />;
}
