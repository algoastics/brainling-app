import { describe, expect, it } from '@jest/globals';

import { mixColors, mixTokenSets } from '../mixColors';
import { darkColors, lightColors } from '../tokens';

describe('mixColors', () => {
  it('returns the ends exactly', () => {
    expect(mixColors('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixColors('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
  });

  it('mixes channels linearly', () => {
    expect(mixColors('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mixColors('#FF0000', '#0000FF', 0.5)).toBe('#800080');
  });

  it('carries alpha when either end has one', () => {
    expect(mixColors('#2A1C7A80', '#000000A0', 0.5)).toBe('#150E3D90');
    expect(mixColors('#FFFFFF', '#00000000', 0.5)).toBe('#80808080');
  });

  it('falls back to a hard switch for a value it cannot parse', () => {
    expect(mixColors('transparent', '#FFFFFF', 0.25)).toBe('transparent');
    expect(mixColors('transparent', '#FFFFFF', 0.75)).toBe('#FFFFFF');
  });
});

describe('mixTokenSets', () => {
  it('mixes every token and keeps the key set', () => {
    const half = mixTokenSets(lightColors, darkColors, 0.5);
    expect(Object.keys(half).sort()).toEqual(Object.keys(lightColors).sort());
    expect(half.bgScreen).not.toBe(lightColors.bgScreen);
    expect(half.bgScreen).not.toBe(darkColors.bgScreen);
    expect(mixTokenSets(lightColors, darkColors, 1)).toEqual(darkColors);
    expect(mixTokenSets(lightColors, darkColors, 0)).toEqual(lightColors);
  });
});
