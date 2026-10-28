import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { motion, useTheme } from '@/theme';

import type { ProgressTone } from './ProgressBar';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const [x1, y1, x2, y2] = motion.easing.standard;
const standard = Easing.bezier(x1, y1, x2, y2);

const SIZE = 168;
const STROKE = 14;
const RADIUS = 77;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type ProgressRingProps = {
  /** 0–1 (clamped). */
  value: number;
  tone?: ProgressTone;
  /** Centre content, e.g. the odometer count. */
  children?: ReactNode;
  testID?: string;
};

/**
 * Progress ring (Figma "Progress ring", 168 dp): a 14 dp soft track with a round-capped arc that
 * starts at 12 o'clock and sweeps clockwise in 500 ms; reduced motion draws it at once.
 */
export function ProgressRing({ value, tone = 'brand', children, testID }: ProgressRingProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, value));
  const progress = useSharedValue(reduceMotion ? clamped : 0);

  useEffect(() => {
    progress.set(
      withTiming(clamped, { duration: reduceMotion ? 0 : motion.duration.slow, easing: standard }),
    );
  }, [clamped, reduceMotion, progress]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.get()),
  }));
  const arc = {
    brand: colors.brandPrimary,
    good: colors.statusGood,
    warn: colors.statusWarn,
    over: colors.statusDanger,
  }[tone];

  return (
    <View testID={testID} style={styles.root}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={styles.svg}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.bgPrimarySoft}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={arc}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          fill="none"
          rotation={-90}
          origin={`${SIZE / 2}, ${SIZE / 2}`}
          opacity={clamped === 0 ? 0 : 1}
          animatedProps={arcProps}
        />
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: SIZE, height: SIZE },
  svg: StyleSheet.absoluteFill,
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
