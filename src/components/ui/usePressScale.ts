import { useCallback } from 'react';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/theme';

/** Press feedback: scales to `pressedScale` while held, springs back on release. */
export function usePressScale(pressedScale = 0.97) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    if (reduceMotion) return;
    scale.set(withTiming(pressedScale, { duration: motion.duration.instant }));
  }, [pressedScale, reduceMotion, scale]);

  const onPressOut = useCallback(() => {
    if (reduceMotion) return;
    scale.set(withSpring(1, motion.spring));
  }, [reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return { onPressIn, onPressOut, animatedStyle };
}
