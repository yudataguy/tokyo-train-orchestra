/**
 * EDM mode: static mapping from line id to the EDM voice that an arrival
 * on that line should trigger. Keys are the `id` field from lines.json
 * (e.g. "ginza", "jr-yamanote"), not display names.
 *
 * Kept pure (no Tone.js) so the mapping can be unit-tested without a
 * Web Audio context.
 */

export type EdmVoiceId =
  // Metro drums
  | 'kick' | 'clap' | 'closedHat' | 'snare' | 'openHat'
  | 'rim' | 'lowTom' | 'shaker' | 'cowbell'
  // JR
  | 'bass'
  // Toei
  | 'lead'
  // Other FX
  | 'fxRiser' | 'fxReverseCymbal' | 'fxZap' | 'fxImpact'
  // Base track
  | 'pad';

export const EDM_VOICE_FOR_LINE: Record<string, EdmVoiceId> = {
  // Tokyo Metro → per-line drums
  'ginza': 'kick',
  'marunouchi': 'clap',
  'marunouchi-branch': 'clap',
  'hibiya': 'closedHat',
  'tozai': 'snare',
  'chiyoda': 'openHat',
  'yurakucho': 'rim',
  'hanzomon': 'lowTom',
  'namboku': 'shaker',
  'fukutoshin': 'cowbell',

  // Toei → shared lead synth
  'asakusa-toei': 'lead',
  'mita-toei': 'lead',
  'shinjuku-toei': 'lead',
  'oedo-toei': 'lead',

  // JR East → shared bass synth
  'jr-yamanote': 'bass',
  'jr-chuo-rapid': 'bass',
  'jr-chuo-sobu': 'bass',
  'jr-keihin-tohoku': 'bass',
  'jr-saikyo': 'bass',

  // Other operators → per-line FX one-shots
  'yurikamome': 'fxRiser',
  'twr-rinkai': 'fxReverseCymbal',
  'tama-monorail': 'fxZap',
  'tsukuba-express': 'fxImpact',
};

/** [lo, hi] inclusive indices into FULL_PENTATONIC (see scales.ts). */
export const BASS_REGISTER: readonly [number, number] = [0, 7];   // C2 – E3
export const LEAD_REGISTER: readonly [number, number] = [10, 17]; // C4 – E5

export function getEdmVoiceId(lineId: string): EdmVoiceId | undefined {
  return EDM_VOICE_FOR_LINE[lineId];
}

/**
 * Each arrival starts a bounded rhythmic loop on its voice for the train's
 * simulated dwell time (4 bars ≈ 7.7 s at 124 BPM). A later arrival on
 * the same voice restarts the loop. `null` means "one-shot, no loop" —
 * used for FX whose tails already fill a long duration.
 *
 * - `subdivision`: Tone.js time string for the repeat interval.
 * - `totalTicks`: number of subdivisions before the loop stops (4 bars).
 * - `gate(tick)`: optional — only fire on ticks where this returns true.
 */
export interface DwellPattern {
  subdivision: string;
  totalTicks: number;
  gate?: (tick: number) => boolean;
}

// At 4 bars:
//   1m (whole) → 4 ticks, 2n (half) → 8, 4n (quarter) → 16, 8n (eighth) → 32
export const DWELL_PATTERNS: Record<EdmVoiceId, DwellPattern | null> = {
  kick: { subdivision: '4n', totalTicks: 16 },                          // four-on-the-floor
  snare: { subdivision: '4n', totalTicks: 16, gate: (t) => t % 4 === 1 || t % 4 === 3 }, // 2 & 4
  clap: { subdivision: '4n', totalTicks: 16, gate: (t) => t % 4 === 2 },                 // beat 3
  closedHat: { subdivision: '8n', totalTicks: 32 },                     // steady 8ths
  openHat: { subdivision: '2n', totalTicks: 8 },                        // half-note pulse
  shaker: { subdivision: '8n', totalTicks: 32, gate: (t) => t % 2 === 1 },               // off-beat 8ths
  rim: { subdivision: '1m', totalTicks: 4 },                            // downbeat only
  cowbell: { subdivision: '1m', totalTicks: 4 },
  lowTom: { subdivision: '1m', totalTicks: 4 },
  bass: { subdivision: '2n', totalTicks: 8 },                           // root on 1 & 3
  lead: { subdivision: '1m', totalTicks: 4 },                           // stab on beat 1 of each bar
  fxRiser: null,
  fxReverseCymbal: null,
  fxZap: null,
  fxImpact: null,
  pad: null,
};
