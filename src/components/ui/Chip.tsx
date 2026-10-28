import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { haptics, pressTo, useReducedMotion } from '@/motion';

import { layout, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

/** Figma chip is 37 dp tall; the touch area grows to the 48 dp minimum. */
const HIT_SLOP = (layout.minTouch - 37) / 2;

export type ChipProps = {
  label: string;
  /** Spoken name when it differs from the visible label ("60" is read as "60 reels"). */
  accessibilityLabel?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * Preset chip (Figma S04: selected = soft violet fill with a brand border, 1.5 dp borders, 16 x 8 dp padding), one of a radio group.
 * A50: scale 1 to 0.96 on press and a Light haptic on press-in; reduced motion keeps no scale.
 */
export function Chip({
  label,
  accessibilityLabel,
  selected,
  onPress,
  disabled = false,
  testID,
}: ChipProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const press = useSharedValue(0);
  const scale = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.04 * press.value }] }));
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={{ top: HIT_SLOP, bottom: HIT_SLOP }}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        haptics.light();
        pressTo(press, true, reduced);
      }}
      onPressOut={() => pressTo(press, false, reduced)}
    >
      <Animated.View
        style={[
          styles.chip,
          {
            backgroundColor: selected ? colors.bgPrimarySoft : colors.bgSurface,
            borderColor: selected ? colors.brandPrimary : colors.borderControl,
            opacity: disabled ? 0.45 : 1,
          },
          reduced ? null : scale,
        ]}
      >
        <Text variant="label" color={selected ? 'textPrimary' : 'textSecondary'}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[16],
    paddingVertical: space[8],
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
});
