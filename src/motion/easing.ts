import { Easing } from 'react-native-reanimated';

type Curve = readonly [number, number, number, number];

/** Reanimated easing for one of the `motion.easing` curves. */
export function bezier([x1, y1, x2, y2]: Curve) {
  return Easing.bezier(x1, y1, x2, y2);
}
