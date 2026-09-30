import { localDateString } from '@/lib/outfits';

describe('localDateString', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(localDateString(new Date(2026, 2, 7))).toBe('2026-03-07'); // March 7 (month is 0-indexed)
  });

  it('zero-pads single-digit months and days', () => {
    expect(localDateString(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('does not shift the date across a UTC day boundary (uses local getters, not toISOString)', () => {
    // A late-night local time whose UTC equivalent would already be the next
    // day -- this is exactly the bug localDateString exists to avoid, since
    // Date#toISOString() would report the wrong day here.
    const lateNight = new Date(2026, 5, 15, 23, 30);
    expect(localDateString(lateNight)).toBe('2026-06-15');
  });
});
