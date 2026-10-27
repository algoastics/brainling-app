import type { DailyLimit } from 'thumbwell-core';

/**
 * The daily-limit rule (F06), mirrored from the native `DailyLimit` so the UI can say what will
 * happen before the user confirms. The native side is authoritative: lowering applies at once,
 * raising applies from the next logical day. Day keys are `yyyy-MM-dd` strings, which compare as text.
 */
export type LimitState = DailyLimit;

export const DEFAULT_LIMIT = 60;
/** Quick picks on S04-P0. */
export const LIMIT_PRESETS = [30, 60, 100] as const;
export const LIMIT_STEP = 5;
/** Stepper bounds. The native store accepts 0 to 1000 ("zero mode" is not offered in Phase 0). */
export const LIMIT_MIN = 5;
export const LIMIT_MAX = 500;
/** One reel is about 20 to 30 seconds (S04-P0 estimate copy). */
const SECONDS_PER_REEL = 25;

export type LimitChange = 'now' | 'next_day' | 'unchanged';

export const limitState = (effective: number): LimitState => ({
  effective,
  pending: null,
  pendingFromDay: null,
});

export function clampLimit(value: number): number {
  const rounded = Math.round(value);
  return Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, rounded));
}

/** Steps the stepper by `direction` (+1 or -1) and clamps. */
export function stepLimit(value: number, direction: 1 | -1): number {
  return clampLimit(value + direction * LIMIT_STEP);
}

/** Minutes of reels the limit allows (estimate shown under the stepper). */
export function estimateMinutes(limit: number): number {
  return Math.round((limit * SECONDS_PER_REEL) / 60);
}

/** Promotes a pending limit once `todayKey` has reached its start day. */
export function resolveLimit(state: LimitState, todayKey: string): LimitState {
  if (state.pending === null) return state;
  if (state.pendingFromDay === null || todayKey >= state.pendingFromDay) {
    return limitState(state.pending);
  }
  return state;
}

/** When a change to `value` takes effect, given the limit in force. */
export function classifyLimitChange(state: LimitState, value: number): LimitChange {
  if (value < state.effective) return 'now';
  if (value > state.effective) return 'next_day';
  return 'unchanged';
}

/**
 * Applies a change made on `todayKey`. Lower: effective now and any pending raise is dropped.
 * Higher: waits until `nextDayKey`. Equal: cancels a pending raise.
 */
export function applyLimitChange(
  state: LimitState,
  value: number,
  todayKey: string,
  nextDayKey: string,
): LimitState {
  const current = resolveLimit(state, todayKey);
  switch (classifyLimitChange(current, value)) {
    case 'now':
      return limitState(value);
    case 'next_day':
      return { effective: current.effective, pending: value, pendingFromDay: nextDayKey };
    case 'unchanged':
      return limitState(current.effective);
  }
}
