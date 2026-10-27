import { describe, expect, it } from '@jest/globals';

import { positionOfValue, snapToStep, valueAtPosition } from '../sliderMath';

describe('slider math', () => {
  it('snaps to the nearest step inside the range', () => {
    expect(snapToStep(64, 10, 200, 10)).toBe(60);
    expect(snapToStep(66, 10, 200, 10)).toBe(70);
    expect(snapToStep(3, 10, 200, 10)).toBe(10);
    expect(snapToStep(999, 10, 200, 10)).toBe(200);
  });

  it('maps a touch position to a snapped value and clamps outside the track', () => {
    expect(valueAtPosition(0, 200, 10, 200, 10)).toBe(10);
    expect(valueAtPosition(200, 200, 10, 200, 10)).toBe(200);
    expect(valueAtPosition(100, 200, 10, 200, 10)).toBe(110);
    expect(valueAtPosition(60, 200, 10, 200, 10)).toBe(70);
    expect(valueAtPosition(-30, 200, 10, 200, 10)).toBe(10);
    expect(valueAtPosition(500, 200, 10, 200, 10)).toBe(200);
    expect(valueAtPosition(50, 0, 10, 200, 10)).toBe(10);
  });

  it('pins values outside the range to an end of the track', () => {
    expect(positionOfValue(5, 10, 200)).toBe(0);
    expect(positionOfValue(105, 10, 200)).toBe(0.5);
    expect(positionOfValue(500, 10, 200)).toBe(1);
  });
});
