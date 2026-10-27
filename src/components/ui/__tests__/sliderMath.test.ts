import { describe, expect, it } from '@jest/globals';

import {
  clamp,
  dragOffset,
  markCenter,
  offsetForTap,
  offsetOfValue,
  positionOfValue,
  snapToStep,
  thumbTravel,
  valueAtOffset,
} from '../sliderMath';

// The limit slider: 10 to 200 in steps of 10, 328 dp wide with a 28 dp thumb (Figma 100:1191).
const MIN = 10;
const MAX = 200;
const STEP = 10;
const TRAVEL = thumbTravel(328, 28);

describe('slider math', () => {
  it('clamps into the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });

  it('snaps to the nearest step inside the range', () => {
    expect(snapToStep(64, MIN, MAX, STEP)).toBe(60);
    expect(snapToStep(66, MIN, MAX, STEP)).toBe(70);
    expect(snapToStep(3, MIN, MAX, STEP)).toBe(10);
    expect(snapToStep(999, MIN, MAX, STEP)).toBe(200);
  });

  it('keeps the thumb inside the track', () => {
    expect(TRAVEL).toBe(300);
    expect(thumbTravel(20, 28)).toBe(0);
  });

  it('pins values outside the range to an end of the track', () => {
    expect(positionOfValue(5, MIN, MAX)).toBe(0);
    expect(positionOfValue(105, MIN, MAX)).toBe(0.5);
    expect(positionOfValue(500, MIN, MAX)).toBe(1);
  });

  it('puts the Figma snap marks where the design has them', () => {
    // Snap 30, 60, 100, 150 at cx 45.58, 92.95, 156.1, 235.05 on the 328 dp frame.
    expect(markCenter(30, MIN, MAX, 328, 28)).toBeCloseTo(45.58, 1);
    expect(markCenter(60, MIN, MAX, 328, 28)).toBeCloseTo(92.95, 1);
    expect(markCenter(100, MIN, MAX, 328, 28)).toBeCloseTo(156.1, 1);
    expect(markCenter(150, MIN, MAX, 328, 28)).toBeCloseTo(235.05, 1);
  });

  it('does not move at touch-down: zero travel keeps the start offset', () => {
    for (const start of [0, 31.6, 150, TRAVEL]) {
      expect(dragOffset(start, 0, TRAVEL)).toBe(start);
    }
    const start = offsetOfValue(60, MIN, MAX, TRAVEL);
    expect(valueAtOffset(dragOffset(start, 0, TRAVEL), TRAVEL, MIN, MAX, STEP)).toBe(60);
  });

  it('follows the finger one to one, whatever the start', () => {
    expect(dragOffset(100, 25, TRAVEL)).toBe(125);
    expect(dragOffset(100, -40, TRAVEL)).toBe(60);
  });

  it('clamps at both ends and comes back from where the thumb stopped', () => {
    expect(dragOffset(280, 100, TRAVEL)).toBe(TRAVEL);
    expect(dragOffset(20, -100, TRAVEL)).toBe(0);
    // Finger ran 100 past the end, then back 90: still 10 dp short of the end it was pinned at.
    expect(dragOffset(280, 100 - 90, TRAVEL)).toBe(290);
  });

  it('maps a thumb offset to a snapped value, ends included', () => {
    expect(valueAtOffset(0, TRAVEL, MIN, MAX, STEP)).toBe(10);
    expect(valueAtOffset(TRAVEL, TRAVEL, MIN, MAX, STEP)).toBe(200);
    expect(valueAtOffset(150, TRAVEL, MIN, MAX, STEP)).toBe(110);
    expect(valueAtOffset(-30, TRAVEL, MIN, MAX, STEP)).toBe(10);
    expect(valueAtOffset(500, TRAVEL, MIN, MAX, STEP)).toBe(200);
    expect(valueAtOffset(50, 0, MIN, MAX, STEP)).toBe(10);
  });

  it('round-trips every step: the thumb offset of a value maps back to the value', () => {
    for (let v = MIN; v <= MAX; v += STEP) {
      expect(valueAtOffset(offsetOfValue(v, MIN, MAX, TRAVEL), TRAVEL, MIN, MAX, STEP)).toBe(v);
    }
  });

  it('changes the value by exactly one step per step width of finger travel', () => {
    const stepWidth = TRAVEL / ((MAX - MIN) / STEP);
    const start = offsetOfValue(100, MIN, MAX, TRAVEL);
    expect(valueAtOffset(dragOffset(start, stepWidth, TRAVEL), TRAVEL, MIN, MAX, STEP)).toBe(110);
    expect(valueAtOffset(dragOffset(start, -2 * stepWidth, TRAVEL), TRAVEL, MIN, MAX, STEP)).toBe(
      80,
    );
    // Less than half a step does not change it.
    expect(valueAtOffset(dragOffset(start, stepWidth * 0.4, TRAVEL), TRAVEL, MIN, MAX, STEP)).toBe(
      100,
    );
  });

  it('puts the thumb centre under a tap, clamped to the track', () => {
    expect(offsetForTap(164, TRAVEL, 28)).toBe(150);
    expect(offsetForTap(3, TRAVEL, 28)).toBe(0);
    expect(offsetForTap(400, TRAVEL, 28)).toBe(TRAVEL);
  });
});
