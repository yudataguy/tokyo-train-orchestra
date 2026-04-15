/**
 * Server-side proxy for OpenSky Network's REST API.
 *
 * Why the proxy: OpenSky's CORS policy allows only its own origin, so
 * browsers can't fetch directly. This route runs server-side and forwards
 * the upstream JSON unchanged, with a small in-memory cache so multiple
 * concurrent client polls share a single upstream call (OpenSky rate-limits
 * anonymous access at 400 req/day per IP).
 *
 * Note: this route requires Next.js's runtime, so `output: 'export'` in
 * next.config.ts must be removed (or this route excluded) to do a static
 * production build. In `npm run dev` it works as-is.
 */
import { NextResponse } from 'next/server';

const BBOX_QS = 'lamin=35.2&lamax=36.2&lomin=139.2&lomax=140.3';
const UPSTREAM = `https://opensky-network.org/api/states/all?${BBOX_QS}`;
const CACHE_TTL_MS = 8_000;

let cache: { fetchedAt: number; payload: unknown } | null = null;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.payload, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=8' },
    });
  }

  try {
    const upstream = await fetch(UPSTREAM, { cache: 'no-store' });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `OpenSky HTTP ${upstream.status}` },
        { status: upstream.status },
      );
    }
    const payload = await upstream.json();
    cache = { fetchedAt: now, payload };
    return NextResponse.json(payload, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, max-age=8' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fetch failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
