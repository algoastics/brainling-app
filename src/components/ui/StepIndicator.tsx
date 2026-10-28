import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '@/i18n';
import { useReducedMotion } from '@/motion';
import { motion, radius, useTheme } from '@/theme';

import { Text } from './Text';

export type StepIndicatorProps = {
  /** 1-based current step. */
  current: number;
  total: number;
};

const DOT = 8;
const ACTIVE_WIDTH = 28;
/** Figma A97: dots Easing.out(Easing.cubic) 250 ms, counter digit Easing.out(Easing.quad) 120 ms. */
const DOT_EASE = Easing.out(Easing.cubic);
const DIGIT_EASE = Easing.out(Easing.quad);
const DIGIT_HALF = motion.duration.fast / 2;
/** Pill states (not started, finished, current); the animation runs between them. */
const TODO = 0;
const DONE = 1;
const CURRENT = 2;

function Pill({ state, reduced }: { state: number; reduced: boolean }) {
  const { colors } = useTheme();
  const progress = useSharedValue(state);
  useEffect(() => {
    progress.value = reduced
      ? state
      : withTiming(state, { duration: motion.duration.entrance, easing: DOT_EASE });
  }, [state, reduced, progress]);
  const style = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [TODO, DONE, CURRENT], [DOT, DOT, ACTIVE_WIDTH]),
    backgroundColor: interpolateColor(
      progress.value,
      [TODO, DONE, CURRENT],
      [colors.borderStrong, colors.brandLilac, colors.brandPrimary],
    ),
  }));
  return <Animated.View style={[styles.pill, style]} />;
}

/**
 * "n of total": only the step digit changes, in place (60 ms out, 60 ms in); the rest of the text
 * and its box never move.
 */
function Counter({
  label,
  current,
  reduced,
}: {
  label: string;
  current: number;
  reduced: boolean;
}) {
  const [shown, setShown] = useState(current);
  const fade = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      fade.value = 1;
      return;
    }
    fade.value = withSequence(
      withTiming(0, { duration: DIGIT_HALF, easing: DIGIT_EASE }),
      withTiming(1, { duration: DIGIT_HALF, easing: DIGIT_EASE }),
    );
    const timer = setTimeout(() => setShown(current), DIGIT_HALF);
    return () => clearTimeout(timer);
  }, [current, reduced, fade]);
  const digitStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  // The label comes from the translation, so split it around the digit instead of assuming a form.
  const at = Math.max(label.indexOf(String(current)), 0);
  const digit = String(current);
  return (
    <View style={styles.counter} importantForAccessibility="no-hide-descendants">
      <Text variant="caption" color="textMuted">
        {label.slice(0, at)}
      </Text>
      <Animated.View style={digitStyle}>
        <Text variant="caption" color="textMuted">
          {reduced ? current : shown}
        </Text>
      </Animated.View>
      <Text variant="caption" color="textMuted">
        {label.slice(at + digit.length)}
      </Text>
    </View>
  );
}

/**
 * Step indicator (Figma 121:5922, motion A97): one 8 dp pill per step, the current one 28 dp wide
 * in the brand colour, finished steps in lilac, and "n of total" on the right. Mounted once in the
 * onboarding header: when `current` changes the pills stretch and shrink into place (250 ms
 * ease-out) and the counter digit fades in place (120 ms); reduced motion swaps at once. The row
 * is one accessible element ("Step n of total") that is announced when the step changes.
 */
export function StepIndicator({ current, total }: StepIndicatorProps) {
  const t = useT();
  const reduced = useReducedMotion();
  const label = t('common.step', { current, total });
  const spoken = t('common.stepLabel', { current, total });
  const previous = useRef(current);
  useEffect(() => {
    if (previous.current !== current) AccessibilityInfo.announceForAccessibility(spoken);
    previous.current = current;
  }, [current, spoken]);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={spoken}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.pills} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: total }, (_, i) => {
          const step = i + 1;
          return (
            <Pill
              key={step}
              state={step === current ? CURRENT : step < current ? DONE : TODO}
              reduced={reduced}
            />
          );
        })}
      </View>
      <Counter label={label} current={current} reduced={reduced} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: { height: DOT, borderRadius: radius.xs / 2 },
  counter: { flexDirection: 'row', alignItems: 'center' },
});
