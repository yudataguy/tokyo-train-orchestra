import { formatTokyoClock } from '../tokyoTime';

describe('formatTokyoClock', () => {
  it('shows Tokyo wall-clock time regardless of the viewer’s zone', () => {
    // 08:35 UTC is 17:35 in Tokyo (UTC+9, no DST).
    expect(formatTokyoClock(new Date('2026-10-08T08:35:00Z'))).toBe('17:35');
  });

  it('rolls past midnight as 00:xx, not 24:xx', () => {
    expect(formatTokyoClock(new Date('2026-10-08T15:05:00Z'))).toBe('00:05');
  });

  it('zero-pads single-digit hours', () => {
    expect(formatTokyoClock(new Date('2026-10-08T23:07:00Z'))).toBe('08:07');
  });
});
