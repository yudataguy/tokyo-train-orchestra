export type Step = 'song' | 'lineup' | 'draw' | 'race' | 'results';

/** The song the race is run against.
 *  videoId null = "I'll play it myself" (any source, mic only).
 *  endsOnTime = the race stops at durationSec rather than on YouTube ENDED:
 *  true for manual mode, live streams, and songs longer than the race cap. */
export interface SongChoice {
  videoId: string | null;
  durationSec: number;
  endsOnTime: boolean;
}
