import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { layout, motion, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected: boolean;
  onChange: (selected: boolean) => void;
  icon?: ReactNode;
  disabled?: boolean;
};

const [x1, y1, x2, y2] = motion.easing.overshoot;
const overshoot = Easing.bezier(x1, y1, x2, y2);

/** C02 — selectable Chip. A04: bounces 1 → 1.08 → 1 (120 ms, overshoot) when selected. */
export function Chip({ label, selected, onChange, icon, disabled = false }: ChipProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const handlePress = () => {
    const next = !selected;
    if (next && !reduceMotion) {
      const half = motion.duration.fast / 2;
      scale.set(
        withSequence(
          withTiming(1.08, { duration: half, easing: overshoot }),
          withTiming(1, { duration: half, easing: overshoot }),
        ),
      );
    }
    onChange(next);
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked: selected, disabled }}
        disabled={disabled}
        onPress={handlePress}
        style={[
          styles.chip,
          {
            backgroundColor: selected ? colors.primarySoft : colors.surface,
            borderColor: selected ? colors.primary : colors.line,
            opacity: disabled ? 0.45 : 1,
          },
        ]}
      >
        {icon}
        <Text variant="body.sm" color={selected ? 'primary' : 'ink'}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: layout.minTouch - 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    paddingHorizontal: space[16],
    borderRadius: radius.pill,
    borderWidth: 1.5,
    marginVertical: 4,
  },
});
