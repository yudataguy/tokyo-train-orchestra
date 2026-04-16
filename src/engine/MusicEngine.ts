import * as Tone from 'tone';
import type { ArrivalEvent, LineConfig, WeatherEffect } from '../types';
import { stationToNote } from './scales';
import { getInstrumentConfig } from './instruments';
import { EdmEngine } from './edmEngine';

interface LineState {
  config: LineConfig;
  synth: Tone.PolySynth;
  activeTrains: Set<string>;
  muted: boolean;
  baseGain: number;
}

export class MusicEngine {
  private lines = new Map<string, LineState>();
  private reverb: Tone.Reverb | null = null;
  private masterFilter: Tone.Filter;
  private currentEffect: WeatherEffect = 'none';
  private masterVolume = 0.7;
  private mode: 'ambient' | 'edm' = 'ambient';
  private edmEngine: EdmEngine | null = null;

  constructor(lineConfigs: LineConfig[]) {
    // Gentle lowpass on the master bus tames raw-oscillator brightness.
    // -12 dB/oct is subtle; cutoff at 4 kHz leaves speech-band content clear
    // while softening harsh harmonics from square/sawtooth instruments.
    this.masterFilter = new Tone.Filter({ frequency: 4000, type: 'lowpass', rolloff: -12 }).toDestination();

    for (const config of lineConfigs) {
      const instrumentConfig = getInstrumentConfig(config.instrument);
      const synth = instrumentConfig.create() as Tone.PolySynth;
      synth.connect(this.masterFilter);

      this.lines.set(config.id, {
        config, synth,
        activeTrains: new Set(),
        muted: false,
        baseGain: -12,
      });
    }
  }

  handleArrival(event: ArrivalEvent): void {
    const lineState = this.lines.get(event.line);
    if (!lineState || lineState.muted) return;

    if (this.mode === 'edm') {
      this.edmEngine?.triggerArrival(event.line, event.stationIndex, lineState.config.stations.length);
      return;
    }

    // ambient path — existing behavior
    lineState.activeTrains.add(event.trainId);
    // Auto-cleanup after 5 minutes to prevent unbounded growth
    setTimeout(() => lineState.activeTrains.delete(event.trainId), 5 * 60 * 1000);

    const totalStations = lineState.config.stations.length;
    const note = stationToNote(event.stationIndex, totalStations, lineState.config.instrument);

    const trainCount = lineState.activeTrains.size;
    const boost = Math.min(trainCount * 0.5, 6);
    lineState.synth.volume.value = lineState.baseGain + boost;

    lineState.synth.triggerAttackRelease(note, '4n');
  }

  getMode(): 'ambient' | 'edm' {
    return this.mode;
  }

  setMode(mode: 'ambient' | 'edm'): void {
    if (this.mode === mode) return;

    if (mode === 'edm') {
      // Silence ambient voices (release any held notes).
      this.lines.forEach((state) => state.synth.releaseAll?.());
      this.edmEngine = new EdmEngine();
      this.edmEngine.start();
    } else {
      this.edmEngine?.stop();
      this.edmEngine = null;
    }
    this.mode = mode;
  }

  setMasterVolume(value: number): void {
    this.masterVolume = Math.max(0, Math.min(1, value));
    Tone.getDestination().volume.value = Tone.gainToDb(this.masterVolume);
  }

  setLineMuted(lineId: string, muted: boolean): void {
    const lineState = this.lines.get(lineId);
    if (lineState) lineState.muted = muted;
  }

  setWeatherEffect(effect: WeatherEffect): void {
    if (effect === this.currentEffect) return;

    if (this.reverb) {
      this.lines.forEach((state) => {
        state.synth.disconnect();
        state.synth.connect(this.masterFilter);
      });
      this.reverb.dispose();
      this.reverb = null;
    }

    if (effect === 'rain') {
      this.reverb = new Tone.Reverb({ decay: 4, wet: 0.4 }).connect(this.masterFilter);
      this.lines.forEach((state) => {
        state.synth.disconnect();
        state.synth.connect(this.reverb!);
      });
    } else if (effect === 'clear-night') {
      this.reverb = new Tone.Reverb({ decay: 8, wet: 0.2 }).connect(this.masterFilter);
      this.lines.forEach((state) => {
        state.synth.disconnect();
        state.synth.connect(this.reverb!);
      });
    } else if (effect === 'snow') {
      this.reverb = new Tone.Reverb({ decay: 3, wet: 0.3 }).connect(this.masterFilter);
      this.lines.forEach((state) => {
        state.synth.disconnect();
        state.synth.connect(this.reverb!);
        state.synth.volume.value = state.baseGain - 3;
      });
    }

    this.currentEffect = effect;
  }

  dispose(): void {
    this.edmEngine?.stop();
    this.edmEngine = null;
    this.lines.forEach((state) => state.synth.dispose());
    this.reverb?.dispose();
    this.masterFilter.dispose();
    this.lines.clear();
  }
}
