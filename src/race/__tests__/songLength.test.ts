import { MANUAL_LENGTHS_MIN, MAX_RACE_SEC, raceLengthForVideo } from '../songLength';

describe('raceLengthForVideo', () => {
  it('races the whole song when it fits in the cap', () => {
    expect(raceLengthForVideo(150)).toEqual({ durationSec: 150, endsOnTime: false });
  });

  it('races exactly to the end of a song as long as the cap', () => {
    expect(raceLengthForVideo(MAX_RACE_SEC)).toEqual({ durationSec: MAX_RACE_SEC, endsOnTime: false });
  });

  it('cuts a longer song off at the cap, ending on the race clock', () => {
    expect(raceLengthForVideo(3 * 60 * 60)).toEqual({ durationSec: MAX_RACE_SEC, endsOnTime: true });
  });

  it('caps races at three minutes', () => {
    expect(MAX_RACE_SEC).toBe(180);
    expect(Math.max(...MANUAL_LENGTHS_MIN) * 60).toBeLessThanOrEqual(MAX_RACE_SEC);
  });
});
