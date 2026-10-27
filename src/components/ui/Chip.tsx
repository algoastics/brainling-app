import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { haptics, pressTo, useReducedMotion } from '@/motion';

import { layout, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * Preset chip (Figma S04: selected = soft violet fill with a brand border), one of a radio group.
 * A50: scale 1 to 0.96 on press and a Light haptic on press-in; reduced motion keeps no scale.
 */
export function Chip({ label, selected, onPress, disabled = false, testID }: ChipProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const press = useSharedValue(0);
  const scale = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.04 * press.value }] }));
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={label}
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
        <Text variant="label" color={selected ? 'brandAccentText' : 'textSecondary'}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: layout.minTouch,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[16],
    borderRadius: radius.pill,
    borderWidth: 2,
  },
});
