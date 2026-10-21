import { describe, expect, it } from '@jest/globals';

import { detectOem, guideOrder, needsAutostart, OEM_KEYS, OEM_TARGETS } from '../oem';

describe('detectOem', () => {
  it.each([
    ['samsung', 'samsung', 'samsung'],
    ['Xiaomi', 'Redmi', 'xiaomi'],
    ['Xiaomi', 'POCO', 'xiaomi'],
    ['OPPO', 'OPPO', 'oppo'],
    ['realme', 'realme', 'oppo'],
    ['vivo', 'iQOO', 'vivo'],
    ['OnePlus', 'OnePlus', 'oneplus'],
    ['Google', 'google', 'pixel'],
  ] as const)('%s / %s → %s', (manufacturer, brand, key) => {
    expect(detectOem(manufacturer, brand)).toBe(key);
  });

  it('returns null for makers without a guide', () => {
    expect(detectOem('motorola', 'motorola')).toBeNull();
    expect(detectOem(undefined, null)).toBeNull();
  });
});

describe('guideOrder', () => {
  it('leads with Samsung when nothing is detected', () => {
    expect(guideOrder(null)[0]).toBe('samsung');
    expect(guideOrder(null)).toEqual([...OEM_KEYS]);
  });

  it('puts the detected maker first without duplicates', () => {
    const order = guideOrder('vivo');
    expect(order[0]).toBe('vivo');
    expect(new Set(order).size).toBe(OEM_KEYS.length);
  });
});

describe('OEM targets', () => {
  it('only uses explicit components or the app info page', () => {
    for (const key of OEM_KEYS) {
      expect(OEM_TARGETS[key].length).toBeGreaterThan(0);
      for (const target of OEM_TARGETS[key]) {
        if (target.kind === 'component') {
          expect(target.packageName).toMatch(/^[a-z]+(\.[a-z]+)+$/);
          expect(target.className.startsWith('com.')).toBe(true);
        }
      }
    }
  });

  it('skips autostart for stock Android', () => {
    expect(needsAutostart('pixel')).toBe(false);
    expect(needsAutostart(null)).toBe(false);
    expect(needsAutostart('xiaomi')).toBe(true);
  });
});
