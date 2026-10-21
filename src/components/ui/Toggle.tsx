import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion, palette, radius, useTheme } from '@/theme';

export type ToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

const TRACK_W = 52;
const TRACK_H = 32;
const THUMB = 24;
const TRAVEL = TRACK_W - THUMB - 8;

/** C02 — Toggle (switch). */
export function Toggle({ value, onChange, accessibilityLabel, disabled = false }: ToggleProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(value ? TRAVEL : 0);

  useEffect(() => {
    x.set(withTiming(value ? TRAVEL : 0, { duration: reduceMotion ? 0 : motion.duration.fast }));
  }, [value, reduceMotion, x]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={[
        styles.track,
        { backgroundColor: value ? colors.primary : colors.line, opacity: disabled ? 0.45 : 1 },
      ]}
    >
      <Animated.View style={[styles.thumb, thumbStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: TRACK_W, height: TRACK_H, borderRadius: radius.pill, padding: 4 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
  },
});
