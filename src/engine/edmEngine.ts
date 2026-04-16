import * as Tone from 'tone';
import { createEdmVoices, type EdmVoices } from './edmVoices';
import { getEdmVoiceId, BASS_REGISTER, LEAD_REGISTER } from './edmMapping';
import { FULL_PENTATONIC } from './scales';

const BPM = 124;

export class EdmEngine {
  private voices: EdmVoices | null = null;
  private masterFilter: Tone.Filter | null = null;
  private padSequence: Tone.Sequence | null = null;
  private started = false;

  start(): void {
    if (this.started) return;
    this.masterFilter = new Tone.Filter({ frequency: 6000, type: 'lowpass', rolloff: -12 }).toDestination();
    this.voices = createEdmVoices(this.masterFilter);
    // I-V-vi-IV in C major, two bars per chord (duration '2m').
    const chords: string[][] = [
      ['C3', 'E3', 'G3', 'C4'],   // C
      ['G2', 'D3', 'G3', 'B3'],   // G
      ['A2', 'E3', 'A3', 'C4'],   // Am
      ['F2', 'A2', 'C3', 'F3'],   // F
    ];
    const pad = this.voices.pad;
    this.padSequence = new Tone.Sequence<string[]>(
      (time, chord) => {
        chord.forEach((n) => pad.triggerAttackRelease(n, '2m', time));
      },
      chords,
      '2m',
    ).start(0);
    Tone.getTransport().bpm.value = BPM;
    Tone.getTransport().start();
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    this.padSequence?.dispose();
    this.padSequence = null;
    if (this.voices) {
      for (const voice of Object.values(this.voices)) voice.dispose();
      this.voices = null;
    }
    this.masterFilter?.dispose();
    this.masterFilter = null;
    this.started = false;
  }

  triggerArrival(lineId: string, stationIndex: number, totalStations: number): void {
    if (!this.started || !this.voices) return;
    const voiceId = getEdmVoiceId(lineId);
    if (!voiceId) return;
    const voice = this.voices[voiceId];

    // Pitch for bass/lead only; drums and FX ignore the note arg.
    let note = 'C4';
    if (voiceId === 'bass') note = this.pickNote(stationIndex, totalStations, BASS_REGISTER);
    else if (voiceId === 'lead') note = this.pickNote(stationIndex, totalStations, LEAD_REGISTER);

    // Schedule on the next 16th. '@16n' tells Tone to align to the next 16th grid.
    voice.triggerAttackRelease(note, '16n');
  }

  private pickNote(
    stationIndex: number,
    totalStations: number,
    register: readonly [number, number],
  ): string {
    const [lo, hi] = register;
    const windowLen = hi - lo + 1;
    const denom = Math.max(1, totalStations - 1);
    const idx = Math.round((stationIndex / denom) * (windowLen - 1));
    return FULL_PENTATONIC[lo + idx];
  }
}
