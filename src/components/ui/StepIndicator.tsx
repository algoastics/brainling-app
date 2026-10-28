import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '@/i18n';
import { bezier, useReducedMotion } from '@/motion';
import { motion, radius, useTheme } from '@/theme';

import { Text } from './Text';

export type StepIndicatorProps = {
  /** 1-based current step. */
  current: number;
  total: number;
};

const DOT = 8;
const ACTIVE_WIDTH = 28;
const EASE = bezier(motion.easing.out);
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
      : withTiming(state, { duration: motion.duration.entrance, easing: EASE });
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

/** The "n of total" text: the old value fades out and the new one in, in place. */
function Counter({ label, reduced }: { label: string; reduced: boolean }) {
  const [tracked, setTracked] = useState({ label, prev: null as string | null });
  if (tracked.label !== label) setTracked({ label, prev: tracked.label });
  const fade = useSharedValue(1);
  useEffect(() => {
    if (tracked.prev === null || reduced) {
      fade.value = 1;
      return;
    }
    fade.value = 0;
    fade.value = withTiming(1, { duration: motion.duration.fast, easing: EASE });
    const timer = setTimeout(
      () => setTracked((s) => ({ ...s, prev: null })),
      motion.duration.fast + 20,
    );
    return () => clearTimeout(timer);
  }, [tracked.label, tracked.prev, reduced, fade]);
  const enter = useAnimatedStyle(() => ({ opacity: fade.value }));
  const leave = useAnimatedStyle(() => ({ opacity: 1 - fade.value }));
  const fading = tracked.prev !== null && !reduced;
  return (
    <View importantForAccessibility="no-hide-descendants">
      {fading ? (
        <Animated.View style={[styles.previous, leave]}>
          <Text variant="caption" color="textMuted">
            {tracked.prev}
          </Text>
        </Animated.View>
      ) : null}
      <Animated.View style={fading ? enter : null}>
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}

/**
 * Step indicator (Figma 121:5922): one 8 dp pill per step, the current one 28 dp wide in the brand
 * colour, finished steps in lilac, and "n of total" on the right. Mounted once in the onboarding
 * header: when `current` changes the pills stretch and shrink into place (250 ms ease-out) and the
 * counter cross-fades in place; reduced motion swaps at once. The pills are decoration; the row's
 * label carries the meaning for screen readers.
 */
export function StepIndicator({ current, total }: StepIndicatorProps) {
  const t = useT();
  const reduced = useReducedMotion();
  const label = t('common.step', { current, total });
  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
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
      <Counter label={label} reduced={reduced} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: { height: DOT, borderRadius: radius.xs / 2 },
  previous: { ...StyleSheet.absoluteFill, alignItems: 'flex-end' },
});
