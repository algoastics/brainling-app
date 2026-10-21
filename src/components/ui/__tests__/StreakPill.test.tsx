import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { StreakPill, streakTier } from '../StreakPill';

describe('streakTier', () => {
  it.each([
    [0, 'broken'],
    [1, 'orange'],
    [6, 'orange'],
    [7, 'blue'],
    [29, 'blue'],
    [30, 'purple'],
    [99, 'purple'],
    [100, 'rainbow'],
  ] as const)('%i days is %s', (days, tier) => {
    expect(streakTier(days)).toBe(tier);
  });
});

describe('StreakPill', () => {
  it('announces the streak and frozen state', async () => {
    await render(<StreakPill days={8} frozen />);
    expect(screen.getByLabelText('8 day streak, frozen')).toBeOnTheScreen();
  });
});
