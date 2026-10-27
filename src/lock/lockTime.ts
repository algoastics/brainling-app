/**
 * "Locked until HH:MM" for the limit lock (S22-P0). The lock ends when the next logical day
 * starts, so the time comes from the user's day-start setting (default 04:00) in their time zone.
 * Native twin (M4) must produce the same instants: the first wall-clock `dayStartMinutes` after now.
 */
export const DEFAULT_DAY_START_MINUTES = 4 * 60;
export const MINUTES_PER_DAY = 24 * 60;

type Wall = { y: number; mo: number; d: number; h: number; mi: number; s: number };

export function systemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function wallAt(ms: number, zone: string): Wall {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    y: get('year'),
    mo: get('month'),
    d: get('day'),
    h: get('hour') % 24,
    mi: get('minute'),
    s: get('second'),
  };
}

/** Zone offset (zone wall clock minus UTC) at `ms`. */
function offsetMs(ms: number, zone: string): number {
  const w = wallAt(ms, zone);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000;
}

/** The instant at which the wall clock in `zone` reads the given date and time. */
function instantOfWall(y: number, mo: number, d: number, minutes: number, zone: string): number {
  const guess = Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60);
  const first = guess - offsetMs(guess, zone);
  return guess - offsetMs(first, zone);
}

function assertMinutes(dayStartMinutes: number) {
  if (
    !Number.isInteger(dayStartMinutes) ||
    dayStartMinutes < 0 ||
    dayStartMinutes >= MINUTES_PER_DAY
  ) {
    throw new RangeError('dayStartMinutes must be an integer from 0 to 1439');
  }
}

/** Epoch ms of the first day start after `nowMs` (the moment the lock lifts). */
export function nextDayStartMs(
  nowMs: number,
  dayStartMinutes: number = DEFAULT_DAY_START_MINUTES,
  zone: string = systemTimeZone(),
): number {
  assertMinutes(dayStartMinutes);
  const w = wallAt(nowMs, zone);
  const today = instantOfWall(w.y, w.mo, w.d, dayStartMinutes, zone);
  if (today > nowMs) return today;
  const next = new Date(Date.UTC(w.y, w.mo - 1, w.d + 1));
  return instantOfWall(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    dayStartMinutes,
    zone,
  );
}

/** 24-hour `HH:MM` of an instant in `zone`. */
export function formatClock(ms: number, zone: string = systemTimeZone()): string {
  const w = wallAt(ms, zone);
  return `${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}`;
}

/** 24-hour `HH:MM` for a day-start setting in minutes after midnight. */
export function formatDayStart(dayStartMinutes: number): string {
  assertMinutes(dayStartMinutes);
  const h = Math.floor(dayStartMinutes / 60);
  return `${String(h).padStart(2, '0')}:${String(dayStartMinutes % 60).padStart(2, '0')}`;
}

/** `HH:MM` the lock lifts, for the "Locked until" copy. */
export function lockedUntilLabel(
  nowMs: number,
  dayStartMinutes: number = DEFAULT_DAY_START_MINUTES,
  zone: string = systemTimeZone(),
): string {
  return formatClock(nextDayStartMs(nowMs, dayStartMinutes, zone), zone);
}

/** Day-start choices offered in Settings (whole hours from 00:00 to 06:00; default 04:00). */
export const DAY_START_OPTIONS = [0, 60, 120, 180, 240, 300, 360] as const;
