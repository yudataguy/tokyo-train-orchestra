import * as Tone from 'tone';
import { createEdmVoices, type EdmVoices } from './edmVoices';

const BPM = 124;

export class EdmEngine {
  private voices: EdmVoices | null = null;
  private masterFilter: Tone.Filter | null = null;
  private started = false;

  start(): void {
    if (this.started) return;
    this.masterFilter = new Tone.Filter({ frequency: 6000, type: 'lowpass', rolloff: -12 }).toDestination();
    this.voices = createEdmVoices(this.masterFilter);
    Tone.getTransport().bpm.value = BPM;
    Tone.getTransport().start();
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    if (this.voices) {
      for (const voice of Object.values(this.voices)) voice.dispose();
      this.voices = null;
    }
    this.masterFilter?.dispose();
    this.masterFilter = null;
    this.started = false;
  }
}
