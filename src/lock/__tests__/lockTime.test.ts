import { describe, expect, it } from '@jest/globals';

import { formatClock, formatDayStart, lockedUntilLabel, nextDayStartMs } from '../lockTime';

const utc = (iso: string) => Date.parse(iso);

describe('locked-until time', () => {
  it('defaults to 04:00 and locks until the next 04:00 in the user zone', () => {
    // 22:15 in Karachi (UTC+5) on 27 Oct: the lock lifts at 04:00 on the 28th.
    const now = utc('2026-10-27T17:15:00Z');
    const until = nextDayStartMs(now, undefined, 'Asia/Karachi');
    expect(until).toBe(utc('2026-10-27T23:00:00Z'));
    expect(lockedUntilLabel(now, undefined, 'Asia/Karachi')).toBe('04:00');
  });

  it('is the same day when the clock is before the day start', () => {
    // 02:30 in Karachi: the lock lifts at 04:00 the same morning.
    const now = utc('2026-10-26T21:30:00Z');
    expect(nextDayStartMs(now, 240, 'Asia/Karachi')).toBe(utc('2026-10-26T23:00:00Z'));
  });

  it('rolls over at exactly the day start', () => {
    const at = utc('2026-10-26T23:00:00Z');
    expect(nextDayStartMs(at, 240, 'Asia/Karachi')).toBe(utc('2026-10-27T23:00:00Z'));
  });

  it('follows a custom day start', () => {
    const now = utc('2026-10-27T17:15:00Z');
    expect(lockedUntilLabel(now, 6 * 60 + 30, 'Asia/Karachi')).toBe('06:30');
    expect(lockedUntilLabel(now, 0, 'Asia/Karachi')).toBe('00:00');
  });

  it('uses the time zone, not UTC', () => {
    const now = utc('2026-10-27T12:00:00Z');
    expect(nextDayStartMs(now, 240, 'America/New_York')).toBe(utc('2026-10-28T08:00:00Z'));
    expect(formatClock(utc('2026-10-28T08:00:00Z'), 'America/New_York')).toBe('04:00');
    expect(nextDayStartMs(now, 240, 'Asia/Tokyo')).toBe(utc('2026-10-27T19:00:00Z'));
  });

  it('handles daylight-saving changes', () => {
    // New York falls back on 1 Nov 2026 at 02:00 local: 04:00 that day is UTC-5.
    const now = utc('2026-10-31T20:00:00Z');
    const until = nextDayStartMs(now, 240, 'America/New_York');
    expect(until).toBe(utc('2026-11-01T09:00:00Z'));
    expect(formatClock(until, 'America/New_York')).toBe('04:00');
    // Spring forward on 8 Mar 2026: 04:00 that day is UTC-4.
    const spring = nextDayStartMs(utc('2026-03-07T20:00:00Z'), 240, 'America/New_York');
    expect(spring).toBe(utc('2026-03-08T08:00:00Z'));
    expect(formatClock(spring, 'America/New_York')).toBe('04:00');
  });

  it('crosses month and year ends', () => {
    const now = utc('2026-12-31T20:00:00Z');
    expect(nextDayStartMs(now, 240, 'UTC')).toBe(utc('2027-01-01T04:00:00Z'));
  });

  it('formats a day start and rejects bad values', () => {
    expect(formatDayStart(240)).toBe('04:00');
    expect(formatDayStart(0)).toBe('00:00');
    expect(formatDayStart(1439)).toBe('23:59');
    expect(() => nextDayStartMs(0, 1440, 'UTC')).toThrow(RangeError);
    expect(() => formatDayStart(-1)).toThrow(RangeError);
  });
});
