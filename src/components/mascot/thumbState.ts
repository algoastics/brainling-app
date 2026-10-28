import { health } from '@/theme';

/** Static Thumb states shown in Phase 0 (zombie folds into fried until Phase 1). */
export type ThumbState = 'glowing' | 'happy' | 'meh' | 'tired' | 'fried';

export const THUMB_STATES: readonly ThumbState[] = ['glowing', 'happy', 'meh', 'tired', 'fried'];

/**
 * Health bands are Phase 1 (F14). Phase 0 Home keeps one happy Thumb and animates it (A59).
 * The daily-limit screen uses `thumbPoseForLimit` (A58), not these bands.
 *
 * Figma "Mascot states" bands on the health score (scope F14 formula): glowing 90 to 100,
 * happy 70 to 89, meh 45 to 69, tired 35 to 44, fried below 35.
 */
export function thumbStateForHealth(score: number): ThumbState {
  if (score >= 90) return 'glowing';
  if (score >= 70) return 'happy';
  if (score >= 45) return 'meh';
  if (score >= 35) return 'tired';
  return 'fried';
}

/** The state for `count` reels against a daily `budget`. */
export function thumbStateFor(count: number, budget: number): ThumbState {
  return thumbStateForHealth(health(count, budget));
}

/** Preview pose on the daily-limit screen (A58). Health bands stay Phase 1. */
export type LimitThumbPose = 'glowing' | 'happy' | 'meh';

/**
 * Onboarding preview poses by the limit being chosen (Figma A58): 10–40 glowing, 50–100 happy,
 * 110–200 meh. The stepper also lands on the fives in between, which take the next band
 * (45 is happy, 105 is meh).
 */
export function thumbPoseForLimit(value: number): LimitThumbPose {
  if (value <= 40) return 'glowing';
  if (value <= 100) return 'happy';
  return 'meh';
}
