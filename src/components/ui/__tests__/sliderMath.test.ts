import { describe, expect, it } from '@jest/globals';

import {
  clamp,
  grabAtTouch,
  markCenter,
  offsetAtFinger,
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
const THUMB = 28;
const TRAVEL = thumbTravel(328, THUMB);

/** Finger `x` on the track whose centre would sit at `offset` if grab were 0. */
function xAt(offset: number): number {
  return offset + THUMB / 2;
}

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
    expect(thumbTravel(20, THUMB)).toBe(0);
  });

  it('pins values outside the range to an end of the track', () => {
    expect(positionOfValue(5, MIN, MAX)).toBe(0);
    expect(positionOfValue(105, MIN, MAX)).toBe(0.5);
    expect(positionOfValue(500, MIN, MAX)).toBe(1);
  });

  it('puts the Figma snap marks where the design has them', () => {
    // Snap 30, 60, 100, 150 at cx 45.58, 92.95, 156.1, 235.05 on the 328 dp frame.
    expect(markCenter(30, MIN, MAX, 328, THUMB)).toBeCloseTo(45.58, 1);
    expect(markCenter(60, MIN, MAX, 328, THUMB)).toBeCloseTo(92.95, 1);
    expect(markCenter(100, MIN, MAX, 328, THUMB)).toBeCloseTo(156.1, 1);
    expect(markCenter(150, MIN, MAX, 328, THUMB)).toBeCloseTo(235.05, 1);
  });

  it('does not move at touch-down, even when the finger is not on the thumb centre', () => {
    for (const start of [0, 31.6, 150, TRAVEL]) {
      const grabCentre = grabAtTouch(start, xAt(start), THUMB);
      expect(offsetAtFinger(xAt(start), grabCentre, TRAVEL, THUMB)).toBe(start);
      const grabEdge = grabAtTouch(start, start, THUMB);
      expect(offsetAtFinger(start, grabEdge, TRAVEL, THUMB)).toBe(start);
    }
    const start = offsetOfValue(60, MIN, MAX, TRAVEL);
    const grab = grabAtTouch(start, xAt(start), THUMB);
    expect(
      valueAtOffset(offsetAtFinger(xAt(start), grab, TRAVEL, THUMB), TRAVEL, MIN, MAX, STEP),
    ).toBe(60);
  });

  it('follows the finger one to one, whatever the start and grab', () => {
    const grab = grabAtTouch(100, xAt(100), THUMB);
    expect(offsetAtFinger(xAt(100) + 25, grab, TRAVEL, THUMB)).toBe(125);
    expect(offsetAtFinger(xAt(100) - 40, grab, TRAVEL, THUMB)).toBe(60);
    const fromEdge = grabAtTouch(100, 100, THUMB);
    expect(offsetAtFinger(100 + 25, fromEdge, TRAVEL, THUMB)).toBe(125);
  });

  it('clamps at both ends and follows again as soon as the finger is back on the track', () => {
    const grab = grabAtTouch(280, xAt(280), THUMB);
    expect(offsetAtFinger(xAt(280) + 100, grab, TRAVEL, THUMB)).toBe(TRAVEL);
    expect(offsetAtFinger(xAt(20) - 100, grabAtTouch(20, xAt(20), THUMB), TRAVEL, THUMB)).toBe(0);
    // Finger ran past the end, then back 10 dp short of the end: absolute x maps there at once.
    expect(offsetAtFinger(xAt(TRAVEL - 10), grab, TRAVEL, THUMB)).toBe(290);
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
    const grab = grabAtTouch(start, xAt(start), THUMB);
    expect(
      valueAtOffset(
        offsetAtFinger(xAt(start) + stepWidth, grab, TRAVEL, THUMB),
        TRAVEL,
        MIN,
        MAX,
        STEP,
      ),
    ).toBe(110);
    expect(
      valueAtOffset(
        offsetAtFinger(xAt(start) - 2 * stepWidth, grab, TRAVEL, THUMB),
        TRAVEL,
        MIN,
        MAX,
        STEP,
      ),
    ).toBe(80);
    // Less than half a step does not change it.
    expect(
      valueAtOffset(
        offsetAtFinger(xAt(start) + stepWidth * 0.4, grab, TRAVEL, THUMB),
        TRAVEL,
        MIN,
        MAX,
        STEP,
      ),
    ).toBe(100);
  });

  it('puts the thumb centre under a tap, clamped to the track', () => {
    expect(offsetForTap(164, TRAVEL, THUMB)).toBe(150);
    expect(offsetForTap(3, TRAVEL, THUMB)).toBe(0);
    expect(offsetForTap(400, TRAVEL, THUMB)).toBe(TRAVEL);
  });
});
