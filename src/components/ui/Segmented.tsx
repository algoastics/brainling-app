import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

export type SegmentedOption<T extends string> = { value: T; label: string };

export type SegmentedProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

/** C02 — Segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: SegmentedProps<T>) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.root, { backgroundColor: colors.surface2, opacity: disabled ? 0.45 : 1 }]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: colors.surface }]}
          >
            <Text variant="body.sm" color={selected ? 'primary' : 'ink2'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', borderRadius: radius.pill, padding: 4 },
  segment: {
    flex: 1,
    minHeight: layout.minTouch - 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[12],
  },
});
