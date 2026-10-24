import type { DayCounts } from 'brainling-core';

import type { MascotState } from '@/theme';

/** The five moods used for a platform's reel count, mildest first. */
export type PlatformMood = Extract<MascotState, 'glowing' | 'happy' | 'meh' | 'fried' | 'zombie'>;

/**
 * Internal placeholder thresholds (single place to tune): a count below `happy` is glowing,
 * below `meh` happy, below `fried` meh, below `zombie` fried, and at or above `zombie` a zombie.
 */
export const PLATFORM_MOOD_THRESHOLDS = { happy: 5, meh: 15, fried: 30, zombie: 50 } as const;

export function moodForCount(count: number): PlatformMood {
  const t = PLATFORM_MOOD_THRESHOLDS;
  if (count < t.happy) return 'glowing';
  if (count < t.meh) return 'happy';
  if (count < t.fried) return 'meh';
  if (count < t.zombie) return 'fried';
  return 'zombie';
}

/** Platforms shown, in order, with the native rule keys whose counts they add up (Lite apps too). */
export const PLATFORMS = [
  { key: 'instagram', ruleKeys: ['instagram'] },
  { key: 'youtube', ruleKeys: ['youtube'] },
  { key: 'tiktok', ruleKeys: ['tiktok', 'tiktok_lite'] },
  { key: 'facebook', ruleKeys: ['facebook', 'facebook_lite'] },
  { key: 'snapchat', ruleKeys: ['snapchat'] },
] as const;

export type PlatformKey = (typeof PLATFORMS)[number]['key'];

export function platformCount(counts: DayCounts | null, ruleKeys: readonly string[]): number {
  if (counts == null) return 0;
  return ruleKeys.reduce((sum, k) => sum + (counts.apps[k] ?? 0), 0);
}
