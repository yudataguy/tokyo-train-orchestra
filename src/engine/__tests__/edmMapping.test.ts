import linesConfig from '../../config/lines.json';
import type { LineConfig } from '../../types';
import {
  EDM_VOICE_FOR_LINE,
  BASS_REGISTER,
  LEAD_REGISTER,
  getEdmVoiceId,
} from '../edmMapping';

const lines = linesConfig as LineConfig[];

describe('edmMapping', () => {
  it('has a voice mapping for every line in lines.json', () => {
    for (const line of lines) {
      expect(EDM_VOICE_FOR_LINE[line.id]).toBeDefined();
    }
  });

  it('maps Tokyo Metro lines to drum voices', () => {
    expect(EDM_VOICE_FOR_LINE['ginza']).toBe('kick');
    expect(EDM_VOICE_FOR_LINE['marunouchi']).toBe('clap');
    expect(EDM_VOICE_FOR_LINE['marunouchi-branch']).toBe('clap');
    expect(EDM_VOICE_FOR_LINE['hibiya']).toBe('closedHat');
    expect(EDM_VOICE_FOR_LINE['tozai']).toBe('snare');
    expect(EDM_VOICE_FOR_LINE['chiyoda']).toBe('openHat');
    expect(EDM_VOICE_FOR_LINE['yurakucho']).toBe('rim');
    expect(EDM_VOICE_FOR_LINE['hanzomon']).toBe('lowTom');
    expect(EDM_VOICE_FOR_LINE['namboku']).toBe('shaker');
    expect(EDM_VOICE_FOR_LINE['fukutoshin']).toBe('cowbell');
  });

  it('maps all Toei lines to the shared lead voice', () => {
    expect(EDM_VOICE_FOR_LINE['asakusa-toei']).toBe('lead');
    expect(EDM_VOICE_FOR_LINE['mita-toei']).toBe('lead');
    expect(EDM_VOICE_FOR_LINE['shinjuku-toei']).toBe('lead');
    expect(EDM_VOICE_FOR_LINE['oedo-toei']).toBe('lead');
  });

  it('maps all JR East lines to the shared bass voice', () => {
    for (const line of lines.filter((l) => l.id.startsWith('jr-'))) {
      expect(EDM_VOICE_FOR_LINE[line.id]).toBe('bass');
    }
  });

  it('maps Other lines to per-line FX voices', () => {
    expect(EDM_VOICE_FOR_LINE['yurikamome']).toBe('fxRiser');
    expect(EDM_VOICE_FOR_LINE['twr-rinkai']).toBe('fxReverseCymbal');
    expect(EDM_VOICE_FOR_LINE['tama-monorail']).toBe('fxZap');
    expect(EDM_VOICE_FOR_LINE['tsukuba-express']).toBe('fxImpact');
  });

  it('exposes bass and lead register clamps as [lo, hi] indices into FULL_PENTATONIC', () => {
    expect(BASS_REGISTER).toEqual([0, 7]);  // C2 – E3
    expect(LEAD_REGISTER).toEqual([10, 17]); // C4 – E5
  });

  it('getEdmVoiceId returns voice id or undefined', () => {
    expect(getEdmVoiceId('ginza')).toBe('kick');
    expect(getEdmVoiceId('does-not-exist')).toBeUndefined();
  });
});
