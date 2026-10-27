import { health } from '@/theme';

/** Static Thumb states shown in Phase 0 (zombie folds into fried until Phase 1). */
export type ThumbState = 'glowing' | 'happy' | 'meh' | 'tired' | 'fried';

export const THUMB_STATES: readonly ThumbState[] = ['glowing', 'happy', 'meh', 'tired', 'fried'];

/**
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
