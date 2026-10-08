export type Step = 'song' | 'lineup' | 'draw' | 'race' | 'results';

/** One racing lane as the players set it up. */
export interface Entry {
  lineId: string;
  player: string; // optional display name, '' when blank
}

/** The song the race is run against.
 *  videoId null = "I'll play it myself" (any source, mic only).
 *  endsOnTime = the race stops at durationSec rather than on YouTube ENDED:
 *  true for manual mode and for live streams with no real duration. */
export interface SongChoice {
  videoId: string | null;
  durationSec: number;
  endsOnTime: boolean;
}
