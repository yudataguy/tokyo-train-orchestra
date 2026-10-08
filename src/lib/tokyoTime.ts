/** 24-hour Tokyo wall clock. `hourCycle: 'h23'` rather than `hour12: false`:
 *  some engines render midnight as "24:05" under the latter. */
const TOKYO_CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tokyo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** HH:MM in Tokyo, whatever zone the viewer's device is in. The app plays
 *  Tokyo's trains, so its clock reads Tokyo time like the HUD does. */
export function formatTokyoClock(date: Date): string {
  return TOKYO_CLOCK.format(date);
}
