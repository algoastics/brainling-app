import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

export type CheckboxProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
};

/** C02 — Checkbox with a label; the whole row is the touch target. */
export function Checkbox({ value, onChange, label, disabled = false }: CheckboxProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[styles.row, { opacity: disabled ? 0.45 : 1 }]}
    >
      <View
        style={[
          styles.box,
          {
            backgroundColor: value ? colors.primary : colors.surface,
            borderColor: value ? colors.primary : colors.ink2,
          },
        ]}
      >
        {value ? <View style={[styles.tick, { borderColor: colors.onPrimary }]} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[12], minHeight: layout.minTouch },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.xs - 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    width: 12,
    height: 7,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ translateY: -2 }, { rotate: '-45deg' }],
  },
  label: { flex: 1 },
});
