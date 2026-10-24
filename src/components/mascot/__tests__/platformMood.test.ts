import { describe, expect, it } from '@jest/globals';

import { moodForCount, PLATFORM_MOOD_THRESHOLDS, platformCount } from '../platformMood';

describe('moodForCount', () => {
  it('walks glowing → happy → meh → fried → zombie at the configured thresholds', () => {
    const t = PLATFORM_MOOD_THRESHOLDS;
    expect(moodForCount(0)).toBe('glowing');
    expect(moodForCount(t.happy - 1)).toBe('glowing');
    expect(moodForCount(t.happy)).toBe('happy');
    expect(moodForCount(t.meh - 1)).toBe('happy');
    expect(moodForCount(t.meh)).toBe('meh');
    expect(moodForCount(t.fried)).toBe('fried');
    expect(moodForCount(t.zombie - 1)).toBe('fried');
    expect(moodForCount(t.zombie)).toBe('zombie');
    expect(moodForCount(500)).toBe('zombie');
  });
});

describe('platformCount', () => {
  const counts = { date: 'd', total: 9, apps: { tiktok: 4, tiktok_lite: 3, snapchat: 2 } } as never;
  it('adds a platform’s rule keys and treats missing data as 0', () => {
    expect(platformCount(counts, ['tiktok', 'tiktok_lite'])).toBe(7);
    expect(platformCount(counts, ['facebook'])).toBe(0);
    expect(platformCount(null, ['snapchat'])).toBe(0);
  });
});
