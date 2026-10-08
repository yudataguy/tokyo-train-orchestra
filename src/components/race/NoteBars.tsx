import type { LineConfig } from '../../types';
import type { Lane } from '../../race/raceEngine';
import { PITCH_NAMES } from '../../race/chroma';

/** Per pitch class: the racing line's color, or null for a note with no train. */
export function noteColors(lanes: Lane[], linesById: Map<string, LineConfig>): (string | null)[] {
  const colors: (string | null)[] = new Array(12).fill(null);
  for (const lane of lanes) colors[lane.pitchClass] = linesById.get(lane.lineId)?.color ?? null;
  return colors;
}

interface NoteBarsProps {
  values: number[];
  colors: (string | null)[];
  height: number; // px, tallest bar
}

/** Twelve bars, C to B, scaled to the largest value. Used live as the
 *  "is the mic hearing anything" meter and at the end as the song's
 *  note fingerprint (the reference installation's rail histogram). */
export default function NoteBars({ values, colors, height }: NoteBarsProps) {
  const max = Math.max(...values, 1e-9);
  return (
    <div className="flex items-end gap-[3px]" style={{ height: height + 16 }} aria-hidden="true">
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-0.5">
          <div className="w-full" style={{ height: Math.max(2, (v / max) * height), background: colors[i] ?? 'var(--rule)' }} />
          <span className="tnum text-[9.5px] leading-none text-[var(--ink-2)]">{PITCH_NAMES[i]}</span>
        </div>
      ))}
    </div>
  );
}
