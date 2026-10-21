import { Easing } from 'react-native-reanimated';

import { motion } from '@/theme';

const bezier = ([x1, y1, x2, y2]: readonly [number, number, number, number]) =>
  Easing.bezier(x1, y1, x2, y2);

/** Motion tokens (code/theme.ts `motion.easing`) as Reanimated easings. */
export const easeStandard = bezier(motion.easing.standard);
export const easeOut = bezier(motion.easing.out);
export const easeOvershoot = bezier(motion.easing.overshoot);
/** Sine-like in-out used for loops (motion spec A26-style breathing pulses). */
export const easeInOut = Easing.bezier(0.42, 0, 0.58, 1);
