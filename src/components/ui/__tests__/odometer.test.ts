import { describe, expect, it } from '@jest/globals';

import { odometerCellWidth, odometerSlots } from '../odometer';
import { shouldDismissSheet, sheetDragOffset } from '../sheetMotion';

describe('odometerSlots', () => {
  it('does not roll on the first render', () => {
    const slots = odometerSlots(null, 60);
    expect(slots.map((s) => s.digit)).toEqual(['6', '0']);
    expect(slots.every((s) => s.from === null)).toBe(true);
  });

  it('rolls only the digits that changed, matched by place from the right', () => {
    const slots = odometerSlots(60, 65);
    expect(slots).toEqual([
      expect.objectContaining({ place: 1, digit: '6', from: null }),
      expect.objectContaining({ place: 0, digit: '5', from: '0', direction: 1, delay: 0 }),
    ]);
  });

  it('delays each place by 30 ms and rolls down when the value falls', () => {
    const slots = odometerSlots(100, 90);
    expect(slots.map((s) => [s.place, s.digit, s.from, s.direction, s.delay])).toEqual([
      [1, '9', '0', -1, 30],
      [0, '0', null, -1, 0],
    ]);
  });

  it('fades a new leading slot in when the number gains a digit', () => {
    const slots = odometerSlots(99, 100);
    expect(slots.map((s) => [s.digit, s.from])).toEqual([
      ['1', null],
      ['0', '9'],
      ['0', '9'],
    ]);
  });

  it('treats negative and fractional input as a whole number from zero', () => {
    expect(odometerSlots(null, -4).map((s) => s.digit)).toEqual(['0']);
    expect(odometerSlots(null, 12.9).map((s) => s.digit)).toEqual(['1', '2']);
  });

  it('keeps 44 dp cells at 64 dp type', () => {
    expect(odometerCellWidth(64)).toBe(44);
    expect(odometerCellWidth(48)).toBe(32);
    expect(odometerCellWidth(32)).toBe(24);
  });
});

describe('bottom sheet drag rules', () => {
  it('follows the finger downwards and rubber-bands upwards at 25 %', () => {
    expect(sheetDragOffset(80)).toBe(80);
    expect(sheetDragOffset(-80)).toBe(-20);
  });

  it('dismisses past 30 % of the height or faster than 800 dp/s, never when dragged up', () => {
    expect(shouldDismissSheet(70, 0.1, 200)).toBe(true);
    expect(shouldDismissSheet(50, 0.1, 200)).toBe(false);
    expect(shouldDismissSheet(20, 0.9, 200)).toBe(true);
    expect(shouldDismissSheet(-40, 2, 200)).toBe(false);
  });
});
