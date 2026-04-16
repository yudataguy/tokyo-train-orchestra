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
