import * as Tone from 'tone';
import type { ArrivalEvent, LineConfig, WeatherEffect } from '../types';
import { stationToNote } from './scales';
import { getInstrumentConfig } from './instruments';

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
  private currentEffect: WeatherEffect = 'none';
  private masterVolume = 0.7;

  constructor(lineConfigs: LineConfig[]) {
    for (const config of lineConfigs) {
      const instrumentConfig = getInstrumentConfig(config.instrument);
      const synth = instrumentConfig.create() as Tone.PolySynth;
      synth.toDestination();

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

    lineState.activeTrains.add(event.trainId);
    // Auto-cleanup after 5 minutes to prevent unbounded growth
    setTimeout(() => lineState.activeTrains.delete(event.trainId), 5 * 60 * 1000);

    const totalStations = lineState.config.stations.length;
    const note = stationToNote(event.stationIndex, totalStations);

    const trainCount = lineState.activeTrains.size;
    const boost = Math.min(trainCount * 0.5, 6);
    lineState.synth.volume.value = lineState.baseGain + boost;

    lineState.synth.triggerAttackRelease(note, '4n');
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
        state.synth.toDestination();
      });
      this.reverb.dispose();
      this.reverb = null;
    }

    if (effect === 'rain') {
      this.reverb = new Tone.Reverb({ decay: 4, wet: 0.4 }).toDestination();
      this.lines.forEach((state) => {
        state.synth.disconnect();
        state.synth.connect(this.reverb!);
      });
    } else if (effect === 'clear-night') {
      this.reverb = new Tone.Reverb({ decay: 8, wet: 0.2 }).toDestination();
      this.lines.forEach((state) => {
        state.synth.disconnect();
        state.synth.connect(this.reverb!);
      });
    } else if (effect === 'snow') {
      this.reverb = new Tone.Reverb({ decay: 3, wet: 0.3 }).toDestination();
      this.lines.forEach((state) => {
        state.synth.disconnect();
        state.synth.connect(this.reverb!);
        state.synth.volume.value = state.baseGain - 3;
      });
    }

    this.currentEffect = effect;
  }

  dispose(): void {
    this.lines.forEach((state) => state.synth.dispose());
    this.reverb?.dispose();
    this.lines.clear();
  }
}
