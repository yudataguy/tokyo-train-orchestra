import { ImageResponse } from 'next/og';
import linesData from '../config/lines.json';
import type { LineConfig } from '../types';
import { SITE_NAME_EN } from '../lib/site';

// Required under `output: export` — image routes are Route Handlers, and the
// exporter refuses to emit one that has not opted into being fully static.
export const dynamic = 'force-static';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = `${SITE_NAME_EN} — 23 Tokyo rail lines, 23 instruments`;

/** Share card, built from the same parts as the start screen: paper ground,
 *  the 23 official line colors as one continuous band, ink type on a strict
 *  left margin.
 *
 *  Latin copy only, deliberately. ImageResponse renders with its bundled
 *  font, which has no CJK coverage, so 東京電車オーケストラ would come out as
 *  tofu boxes. Supplying a Japanese face means fetching font binaries during
 *  the build; the color band already reads as Tokyo without that dependency. */
export default function OpengraphImage() {
  const lines = linesData as LineConfig[];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#EBEDE8',
          color: '#15171A',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', width: '100%', height: 16 }}>
          {lines.map((line) => (
            <div key={line.id} style={{ flex: 1, backgroundColor: line.color }} />
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            padding: '72px 80px 64px',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 82, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
              {SITE_NAME_EN}
            </div>
            <div style={{ display: 'flex', width: 180, height: 3, backgroundColor: '#15171A', marginTop: 28 }} />
            <div style={{ fontSize: 34, color: '#565B57', marginTop: 28, lineHeight: 1.45 }}>
              23 Tokyo rail lines. 23 instruments.
            </div>
            <div style={{ fontSize: 34, color: '#565B57', lineHeight: 1.45 }}>
              Every station arrival plays a note.
            </div>
          </div>

          <div style={{ display: 'flex', fontSize: 25, color: '#565B57' }}>
            tokyotrainmusic.japantv.app
          </div>
        </div>
      </div>
    ),
    size,
  );
}
