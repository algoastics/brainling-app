import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { bezier, haptics, useReducedMotion } from '@/motion';
import { motion, sizes, useTheme } from '@/theme';

export type SwitchProps = {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
  testID?: string;
};

const PAD = 4;
const TRAVEL = sizes.switchWidth - sizes.switchThumb - PAD * 2;
const SWITCH_MS = 150;
const SWITCH_EASING = bezier(motion.easing.decelerate);

/**
 * Switch (Figma 52 x 32, thumb 24). The thumb slides and the track colour cross-fades in 150 ms
 * (A60); reduced motion jumps. A light selection tick fires on the change, not on touch-down.
 */
export function Switch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  testID,
}: SwitchProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, {
      duration: reduced ? 0 : SWITCH_MS,
      easing: SWITCH_EASING,
    });
  }, [value, reduced, progress]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * TRAVEL }],
  }));

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        haptics.selection();
        onValueChange?.(!value);
      }}
      style={[
        styles.track,
        { backgroundColor: value ? colors.brandPrimary : colors.borderControl },
        disabled && styles.disabled,
      ]}
    >
      <Animated.View
        style={[styles.thumb, { backgroundColor: colors.brandOnPrimary }, thumbStyle]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: sizes.switchWidth,
    height: sizes.switchHeight,
    borderRadius: sizes.switchHeight / 2,
    padding: PAD,
    justifyContent: 'center',
  },
  thumb: {
    width: sizes.switchThumb,
    height: sizes.switchThumb,
    borderRadius: sizes.switchThumb / 2,
  },
  disabled: { opacity: 0.45 },
});
