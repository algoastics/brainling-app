import { describe, expect, it } from '@jest/globals';

import { thumbStateFor, thumbStateForHealth } from '../thumbState';

describe('Thumb state bands', () => {
  it('maps the health score to the Figma bands', () => {
    expect(thumbStateForHealth(100)).toBe('glowing');
    expect(thumbStateForHealth(90)).toBe('glowing');
    expect(thumbStateForHealth(89)).toBe('happy');
    expect(thumbStateForHealth(70)).toBe('happy');
    expect(thumbStateForHealth(69)).toBe('meh');
    expect(thumbStateForHealth(45)).toBe('meh');
    expect(thumbStateForHealth(44)).toBe('tired');
    expect(thumbStateForHealth(35)).toBe('tired');
    expect(thumbStateForHealth(34)).toBe('fried');
    expect(thumbStateForHealth(0)).toBe('fried');
  });

  it('picks the state from reels against the budget', () => {
    expect(thumbStateFor(0, 60)).toBe('glowing');
    expect(thumbStateFor(6, 60)).toBe('glowing');
    expect(thumbStateFor(12, 60)).toBe('happy');
    expect(thumbStateFor(30, 60)).toBe('meh');
    expect(thumbStateFor(40, 60)).toBe('tired');
    expect(thumbStateFor(60, 60)).toBe('fried');
    expect(thumbStateFor(75, 60)).toBe('fried');
  });

  it('treats a zero budget as fried once anything is counted', () => {
    expect(thumbStateFor(0, 0)).toBe('glowing');
    expect(thumbStateFor(1, 0)).toBe('fried');
  });
});
