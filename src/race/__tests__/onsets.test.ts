import { OnsetDetector, SILENCE_FACTOR } from '../onsets';

const zeros = () => new Array<number>(12).fill(0);
const only = (pc: number, v: number) => { const a = zeros(); a[pc] = v; return a; };
const countFor = (frames: boolean[][], pc: number) => frames.filter((f) => f[pc]).length;
const total = (frames: boolean[][]) => frames.flat().filter(Boolean).length;

describe('OnsetDetector', () => {
  it('fires once when a note starts and not again while it is held', () => {
    const d = new OnsetDetector();
    const out: boolean[][] = [];
    let t = 0;
    for (let i = 0; i < 10; i++) out.push(d.push(zeros(), (t += 33)));
    for (let i = 0; i < 10; i++) out.push(d.push(only(9, 1), (t += 33)));
    expect(countFor(out, 9)).toBe(1);
    expect(total(out)).toBe(1);
  });

  it('suppresses a second rise inside the refractory window', () => {
    const d = new OnsetDetector();
    const out: boolean[][] = [];
    let t = 0;
    for (let i = 0; i < 5; i++) out.push(d.push(zeros(), (t += 33)));
    out.push(d.push(only(9, 1), (t += 33)));  // onset
    out.push(d.push(zeros(), (t += 33)));
    out.push(d.push(only(9, 1), (t += 33)));  // 66 ms later: suppressed
    out.push(d.push(zeros(), (t += 33)));
    out.push(d.push(only(9, 1), (t += 100))); // well past 120 ms: fires
    expect(countFor(out, 9)).toBe(2);
  });

  it('calibrates the silence floor from countdown frames', () => {
    const d = new OnsetDetector();
    for (let i = 0; i < 3; i++) d.calibrate(new Array(12).fill(0.5));
    expect(d.silenceFloor).toBe(SILENCE_FACTOR * 6);
  });

  it('reports how many room frames it has heard', () => {
    const d = new OnsetDetector();
    expect(d.calibrationFrames).toBe(0);
    for (let i = 0; i < 4; i++) d.calibrate(new Array(12).fill(0.5));
    expect(d.calibrationFrames).toBe(4);
  });

  it('keeps the floor at room level when someone shouts the countdown', () => {
    const d = new OnsetDetector();
    for (let i = 0; i < 8; i++) d.calibrate(new Array(12).fill(0.5)); // room: sum 6
    for (let i = 0; i < 2; i++) d.calibrate(new Array(12).fill(10));  // "3, 2, 1!": sum 120
    expect(d.silenceFloor).toBe(SILENCE_FACTOR * 6);
  });

  it('ignores rises quieter than the silence floor', () => {
    const d = new OnsetDetector();
    for (let i = 0; i < 3; i++) d.calibrate(new Array(12).fill(0.5)); // floor = 12
    let t = 0;
    d.push(zeros(), (t += 33));
    expect(d.push(only(9, 5), (t += 33))[9]).toBe(false);
    d.push(zeros(), (t += 500));
    expect(d.push(only(9, 20), (t += 33))[9]).toBe(true);
  });

  it('ignores spectral leakage that rises alongside a loud note', () => {
    // A struck note lifts every bin a little (FFT leakage). Only the note
    // itself should count — quiet classes rising in lockstep must not.
    const d = new OnsetDetector();
    const out: boolean[][] = [];
    let t = 0;
    const leak = (loud: number) => new Array<number>(12).fill(loud * 0.001);
    for (let i = 0; i < 10; i++) out.push(d.push(zeros(), (t += 33)));
    const hit = leak(1); hit[9] = 1;
    out.push(d.push(hit, (t += 33)));
    expect(countFor(out, 9)).toBe(1);
    expect(total(out)).toBe(1);
  });

  it('never fires on a silent mic', () => {
    const d = new OnsetDetector();
    let t = 0;
    const out: boolean[][] = [];
    for (let i = 0; i < 60; i++) out.push(d.push(zeros(), (t += 33)));
    expect(total(out)).toBe(0);
  });
});
