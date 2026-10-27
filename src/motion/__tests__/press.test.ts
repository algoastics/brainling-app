import { describe, expect, it } from '@jest/globals';

import { PRESS_SPRING, pressTo } from '../press';

function sharedValue(initial: number) {
  let current = initial;
  return {
    get: () => current,
    set: (next: number) => (current = next),
    get value() {
      return current;
    },
  };
}

describe('pressTo', () => {
  it('presses in and releases', () => {
    const v = sharedValue(0);
    pressTo(v as never, true, false);
    expect(v.get()).toBe(1);
    pressTo(v as never, false, false);
    expect(v.get()).toBe(0);
  });

  it('jumps instantly under reduced motion', () => {
    const v = sharedValue(0);
    pressTo(v as never, true, true);
    expect(v.get()).toBe(1);
    pressTo(v as never, false, true);
    expect(v.get()).toBe(0);
  });

  it('uses the A50 spring: stiffness 500, damping ratio 0.6', () => {
    expect(PRESS_SPRING.stiffness).toBe(500);
    expect(PRESS_SPRING.damping / (2 * Math.sqrt(PRESS_SPRING.stiffness))).toBeCloseTo(0.6, 5);
  });
});
