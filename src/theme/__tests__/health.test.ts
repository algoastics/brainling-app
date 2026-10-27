import { describe, expect, it } from '@jest/globals';
import { health } from '../health';

describe('health', () => {
  it('is 100 with no reels and drops linearly to 10 at the budget', () => {
    expect(health(0, 30)).toBe(100);
    expect(health(15, 30)).toBe(55);
    expect(health(30, 30)).toBe(10);
  });

  it('loses 2 points per reel over budget and never goes below 0', () => {
    expect(health(31, 30)).toBe(8);
    expect(health(35, 30)).toBe(0);
    expect(health(100, 30)).toBe(0);
  });

  it('handles a zero budget', () => {
    expect(health(0, 0)).toBe(100);
    expect(health(1, 0)).toBe(0);
  });
});
