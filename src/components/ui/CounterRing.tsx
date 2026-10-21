import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { mascotColors, motion, useTheme, type MascotState } from '@/theme';

import { Text } from './Text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type CounterRingProps = {
  count: number;
  budget: number;
  state: MascotState;
  size?: number;
  /** Spoken label, e.g. "12 of 30 reels today". */
  accessibilityLabel: string;
};

const [ox1, oy1, ox2, oy2] = motion.easing.overshoot;
const overshoot = Easing.bezier(ox1, oy1, ox2, oy2);
const [sx1, sy1, sx2, sy2] = motion.easing.standard;
const standard = Easing.bezier(sx1, sy1, sx2, sy2);

/** C04 — CounterRing. Ring colour follows the mascot state; A11 bump when the count rises. */
export function CounterRing({
  count,
  budget,
  state,
  size = 200,
  accessibilityLabel,
}: CounterRingProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const stroke = Math.round(size * 0.09);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = budget > 0 ? Math.min(count / budget, 1) : 1;

  const progress = useSharedValue(ratio);
  const bump = useSharedValue(1);
  const previous = useRef(count);

  useEffect(() => {
    progress.set(
      withTiming(ratio, { duration: reduceMotion ? 0 : motion.duration.slow, easing: standard }),
    );
  }, [ratio, reduceMotion, progress]);

  useEffect(() => {
    if (count > previous.current && !reduceMotion) {
      bump.set(
        withSequence(
          withTiming(1.15, { duration: 75, easing: overshoot }),
          withTiming(1, { duration: 75, easing: overshoot }),
        ),
      );
    }
    previous.current = count;
  }, [count, reduceMotion, bump]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.get()),
  }));
  const numberStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.get() }] }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: budget, now: count }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.line}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={mascotColors[state].ui}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={ringProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Animated.View style={numberStyle}>
          <Text variant={size >= 160 ? 'display.lg' : 'heading.h2'} style={styles.tabular}>
            {count}
          </Text>
        </Animated.View>
        <Text variant="body.sm" color="muted" style={styles.tabular}>
          / {budget}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
});
