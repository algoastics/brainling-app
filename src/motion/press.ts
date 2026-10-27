import { withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { motion } from '@/theme';

/** A50 release spring: stiffness 500, damping ratio 0.6 (critical damping = 2 * sqrt(500)). */
export const PRESS_SPRING = { stiffness: 500, damping: 2 * 0.6 * Math.sqrt(500) };

/**
 * Drives a 0..1 press value: 60 ms linear on press-in, spring back on release (A50).
 * With reduced motion the value jumps (the caller swaps colour instead of travelling).
 */
export function pressTo(value: SharedValue<number>, down: boolean, reduced: boolean): void {
  if (reduced) {
    value.set(down ? 1 : 0);
    return;
  }
  value.set(
    down ? withTiming(1, { duration: motion.duration.pressIn }) : withSpring(0, PRESS_SPRING),
  );
}
