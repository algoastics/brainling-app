import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { mascotColors, motion, radius, useTheme, type MascotState } from '@/theme';

export type HealthBarProps = {
  /** 0–100 */
  health: number;
  state: MascotState;
  accessibilityLabel: string;
  height?: number;
};

const [x1, y1, x2, y2] = motion.easing.standard;
const standard = Easing.bezier(x1, y1, x2, y2);

/** C04 — HealthBar. A13: width tweens over 500 ms; colour follows the mascot state. */
export function HealthBar({ health, state, accessibilityLabel, height = 12 }: HealthBarProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, health));
  const width = useSharedValue(clamped);

  useEffect(() => {
    width.set(
      withTiming(clamped, { duration: reduceMotion ? 0 : motion.duration.slow, easing: standard }),
    );
  }, [clamped, reduceMotion, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.get()}%` }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={[styles.track, { height, backgroundColor: colors.surface2 }]}
    >
      <Animated.View
        style={[styles.fill, { backgroundColor: mascotColors[state].ui }, fillStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
