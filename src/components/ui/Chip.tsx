import { Pressable, StyleSheet } from 'react-native';

import { layout, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/** Preset chip (Figma S04: selected = soft violet fill with a brand border). One of a radio group. */
export function Chip({ label, selected, onPress, disabled = false, testID }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.bgPrimarySoft : colors.bgSurface,
          borderColor: selected ? colors.brandPrimary : colors.borderControl,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Text variant="label" color={selected ? 'brandAccentText' : 'textSecondary'}>
        {label}
      </Text>
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
