import * as Tone from 'tone';
import { createEdmVoices, type EdmVoices } from './edmVoices';
import { getEdmVoiceId, BASS_REGISTER, LEAD_REGISTER } from './edmMapping';
import { FULL_PENTATONIC } from './scales';

const BPM = 124;

// I-V-vi-IV in C major. Two bars per chord, 8-bar loop.
const PAD_CHORDS: readonly (readonly string[])[] = [
  ['C3', 'E3', 'G3', 'C4'],   // C
  ['G2', 'D3', 'G3', 'B3'],   // G
  ['A2', 'E3', 'A3', 'C4'],   // Am
  ['F2', 'A2', 'C3', 'F3'],   // F
];

export class EdmEngine {
  private voices: EdmVoices | null = null;
  private masterFilter: Tone.Filter | null = null;
  private padScheduleId: number | null = null;
  private padChordIdx = 0;
  private started = false;

  start(): void {
    if (this.started) return;
    this.masterFilter = new Tone.Filter({ frequency: 6000, type: 'lowpass', rolloff: -12 }).toDestination();
    this.voices = createEdmVoices(this.masterFilter);

    // Schedule chord changes every 2 bars via Transport.scheduleRepeat.
    // Each callback play all four voices of the current chord, then advances
    // the index so the next callback plays the next chord. Wraps on PAD_CHORDS.length.
    const pad = this.voices.pad;
    this.padChordIdx = 0;
    this.padScheduleId = Tone.getTransport().scheduleRepeat((time) => {
      const chord = PAD_CHORDS[this.padChordIdx % PAD_CHORDS.length];
      for (const note of chord) pad.triggerAttackRelease(note, '2m', time);
      this.padChordIdx += 1;
    }, '2m', 0);

    Tone.getTransport().bpm.value = BPM;
    Tone.getTransport().start();
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    Tone.getTransport().stop();
    if (this.padScheduleId !== null) {
      Tone.getTransport().clear(this.padScheduleId);
      this.padScheduleId = null;
    }
    Tone.getTransport().cancel();
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
