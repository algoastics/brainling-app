import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { bezier, useReducedMotion } from '@/motion';
import { motion, type, type ColorTokens } from '@/theme';

import { odometerCellWidth, odometerSlots, type OdometerSlot } from './odometer';
import { Text } from './Text';

const ROLL_EASING = bezier(motion.easing.decelerate);

type DigitSize = 'counterXl' | 'counterL' | 'counterM';

function DigitCell({
  slot,
  size,
  color,
  rollKey,
  reduced,
}: {
  slot: OdometerSlot;
  size: DigitSize;
  color: keyof ColorTokens;
  rollKey: string;
  reduced: boolean;
}) {
  const { fontSize, lineHeight } = type[size];
  const height = lineHeight + 8;
  const progress = useSharedValue(1);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const rolling = slot.from !== null && !reduced && settledKey !== rollKey;

  useEffect(() => {
    if (!rolling) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      slot.delay,
      withTiming(1, { duration: motion.duration.digit, easing: ROLL_EASING }),
    );
    const timer = setTimeout(() => setSettledKey(rollKey), slot.delay + motion.duration.digit + 20);
    return () => clearTimeout(timer);
  }, [rolling, rollKey, slot.delay, progress]);

  const sign = slot.direction;
  const enter = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: sign * (1 - progress.value) * height }],
  }));
  const leave = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: -sign * progress.value * height }],
  }));

  return (
    <View style={[styles.cell, { width: odometerCellWidth(fontSize), height }]}>
      {rolling ? (
        <Animated.View style={[styles.layer, leave]}>
          <Text variant={size} color={color} maxFontSizeMultiplier={1}>
            {slot.from}
          </Text>
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.layer, rolling ? enter : null]}>
        <Text variant={size} color={color} maxFontSizeMultiplier={1}>
          {slot.digit}
        </Text>
      </Animated.View>
    </View>
  );
}

export type OdometerNumberProps = {
  value: number;
  size?: DigitSize;
  color?: keyof ColorTokens;
  /** Caption under the digits ("reels per day"). */
  label?: string;
  testID?: string;
};

/**
 * Odometer number (Figma "OdometerNumber"): tabular digit cells in a roll window. A changed digit
 * rolls out and in (150 ms, 30 ms later per place, decelerate); reduced motion swaps at once.
 * Exposed to screen readers as one value.
 */
export function OdometerNumber({
  value,
  size = 'counterL',
  color = 'brandAccentText',
  label,
  testID,
}: OdometerNumberProps) {
  const reduced = useReducedMotion();
  const [tracked, setTracked] = useState({ value, prev: null as number | null, seq: 0 });
  if (tracked.value !== value) {
    setTracked({ value, prev: tracked.value, seq: tracked.seq + 1 });
  }
  const slots = odometerSlots(tracked.prev, tracked.value);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label ? `${value} ${label}` : String(value)}
      accessibilityValue={{ text: String(value) }}
      accessibilityLiveRegion="polite"
      style={styles.root}
    >
      <View style={styles.digits} importantForAccessibility="no-hide-descendants">
        {slots.map((slot) => (
          <DigitCell
            key={slot.place}
            slot={slot}
            size={size}
            color={color}
            rollKey={`${tracked.seq}`}
            reduced={reduced}
          />
        ))}
      </View>
      {label ? (
        <Text variant="caption" color="textSecondary">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 4 },
  digits: { flexDirection: 'row' },
  cell: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
