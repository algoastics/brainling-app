import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion, radius, sizes, useTheme } from '@/theme';

export type ProgressTone = 'brand' | 'good' | 'warn' | 'over';

export type ProgressBarProps = {
  /** 0–1 (clamped). */
  value: number;
  tone?: ProgressTone;
  accessibilityLabel: string;
};

const [x1, y1, x2, y2] = motion.easing.standard;
const standard = Easing.bezier(x1, y1, x2, y2);

/** Progress bar (Figma: 12 high pill; tones brand / good / warn / over). Width tweens in 500 ms. */
export function ProgressBar({ value, tone = 'brand', accessibilityLabel }: ProgressBarProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, value));
  const width = useSharedValue(clamped);

  useEffect(() => {
    width.set(
      withTiming(clamped, { duration: reduceMotion ? 0 : motion.duration.slow, easing: standard }),
    );
  }, [clamped, reduceMotion, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.get() * 100}%` }));
  const fill = {
    brand: colors.brandPrimary,
    good: colors.statusGood,
    warn: colors.statusWarn,
    over: colors.statusDanger,
  }[tone];

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { backgroundColor: colors.bgPrimarySoft }]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: fill }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    height: sizes.progressHeight,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
