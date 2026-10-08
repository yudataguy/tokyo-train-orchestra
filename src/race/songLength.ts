/** Longest race, in seconds. A party round, not a listening session: a long
 *  song is cut off here rather than stretching the race (and shrinking every
 *  train's step) to fit an hour-long mix. */
export const MAX_RACE_SEC = 180;

/** Race lengths offered when the song has no usable duration (played from
 *  another device, or a live stream). */
export const MANUAL_LENGTHS_MIN = [1, 2, 3] as const;

/** How long a race against a YouTube video runs. A song that fits races to
 *  its natural end (YouTube ENDED); a longer one ends on the race clock. */
export function raceLengthForVideo(videoSec: number): { durationSec: number; endsOnTime: boolean } {
  return videoSec > MAX_RACE_SEC
    ? { durationSec: MAX_RACE_SEC, endsOnTime: true }
    : { durationSec: videoSec, endsOnTime: false };
}
