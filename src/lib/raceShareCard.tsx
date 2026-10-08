import { ImageResponse } from 'next/og';
import linesData from '../config/lines.json';
import type { LineConfig } from '../types';

export const RACE_CARD_SIZE = { width: 1200, height: 630 };
export const RACE_CARD_ALT = 'Train Race — a song drives Tokyo train lines; each line races on one musical note';

const PAPER = '#EBEDE8';
const INK = '#15171A';
const INK_2 = '#565B57';
const RULE = '#C6CBC4';

/** A frozen moment of a race, on real lines: Yamanote just arrived, the rest
 *  strung out behind it. Station counts are the lines' true ones. */
const LANES = [
  { id: 'jr-yamanote', note: 'G', progress: 1 },
  { id: 'ginza', note: 'C#', progress: 0.74 },
  { id: 'oedo-toei', note: 'E', progress: 0.52 },
  { id: 'marunouchi', note: 'A', progress: 0.31 },
];

const TRACK_WIDTH = 700;
const TRAIN_W = 46;

/** Share card for /race, built from the race screen's own parts: the
 *  line-color band, paper ground, and a lane board mid-race. Latin copy
 *  only — ImageResponse's bundled font has no CJK glyphs (see the home
 *  card in app/opengraph-image.tsx). */
export function renderRaceCard(): ImageResponse {
  const lines = linesData as LineConfig[];
  const byId = new Map(lines.map((l) => [l.id, l]));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: PAPER,
          color: INK,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', width: '100%', height: 16 }}>
          {lines.map((line) => (
            <div key={line.id} style={{ flex: 1, backgroundColor: line.color }} />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '52px 72px 44px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>Train Race</div>
              <div style={{ fontSize: 30, color: INK_2, marginTop: 14 }}>
                Pick a song. Pick a line. The notes drive the trains.
              </div>
            </div>
            <div style={{ display: 'flex', fontSize: 19, color: INK_2, letterSpacing: 3, marginTop: 14 }}>
              TOKYO TRAIN ORCHESTRA
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 38, borderTop: `2px solid ${RULE}` }}>
            {LANES.map((lane, i) => {
              const line = byId.get(lane.id)!;
              const n = line.stations.length;
              const finished = lane.progress >= 1;
              const trainLeft = lane.progress * TRACK_WIDTH - TRAIN_W / 2;
              return (
                <div
                  key={lane.id}
                  style={{ display: 'flex', alignItems: 'center', height: 62, borderBottom: `2px solid ${RULE}` }}
                >
                  <div style={{ display: 'flex', width: 64, fontSize: 32, fontWeight: 700, justifyContent: 'center' }}>
                    {lane.note}
                  </div>
                  <div style={{ display: 'flex', width: 6, height: 42, backgroundColor: line.color, marginLeft: 8 }} />
                  <div style={{ display: 'flex', alignItems: 'center', width: 230, marginLeft: 18, fontSize: 25 }}>
                    {line.name}
                    {i === 0 && (
                      <div
                        style={{
                          display: 'flex',
                          marginLeft: 12,
                          padding: '2px 10px',
                          fontSize: 17,
                          fontWeight: 700,
                          color: PAPER,
                          backgroundColor: INK,
                          borderRadius: 3,
                        }}
                      >
                        1st
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', position: 'relative', width: TRACK_WIDTH, height: 40 }}>
                    <div style={{ position: 'absolute', left: 0, top: 18, width: TRACK_WIDTH, height: 4, backgroundColor: RULE }} />
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 18,
                        width: lane.progress * TRACK_WIDTH,
                        height: 4,
                        backgroundColor: line.color,
                      }}
                    />
                    {line.stations.map((s, k) => (
                      <div
                        key={s.id}
                        style={{
                          position: 'absolute',
                          left: (k / (n - 1)) * TRACK_WIDTH - 5,
                          top: 15,
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          border: `2px solid ${line.color}`,
                          backgroundColor: PAPER,
                        }}
                      />
                    ))}
                    <div style={{ position: 'absolute', left: TRACK_WIDTH - 2, top: 0, width: 5, height: 40, backgroundColor: INK }} />
                    <div
                      style={{
                        display: 'flex',
                        position: 'absolute',
                        left: finished ? TRACK_WIDTH - TRAIN_W - 6 : trainLeft,
                        top: 8,
                        width: TRAIN_W,
                        height: 24,
                        borderRadius: 5,
                        backgroundColor: line.color,
                        borderBottom: '5px solid rgba(0,0,0,0.18)',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: 7,
                          right: 7,
                          top: 5,
                          height: 5,
                          borderRadius: 2,
                          backgroundColor: 'rgba(255,255,255,0.88)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', marginTop: 'auto', fontSize: 22, color: INK_2 }}>
            tokyotrainmusic.japantv.app/race
          </div>
        </div>
      </div>
    ),
    RACE_CARD_SIZE,
  );
}
