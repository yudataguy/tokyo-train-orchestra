import { RACE_CARD_ALT, RACE_CARD_SIZE, renderRaceCard } from '../../lib/raceShareCard';

// Required under `output: export`: image routes are Route Handlers, and the
// exporter only emits ones that opt into being fully static.
export const dynamic = 'force-static';

export const size = RACE_CARD_SIZE;
export const contentType = 'image/png';
export const alt = RACE_CARD_ALT;

export default function Image() {
  return renderRaceCard();
}
