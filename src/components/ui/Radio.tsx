import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

export type RadioProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
};

/** C02 — Radio button with a label. Group several and keep the selection in the parent. */
export function Radio({ value, onChange, label, disabled = false }: RadioProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(true)}
      style={[styles.row, { opacity: disabled ? 0.45 : 1 }]}
    >
      <View style={[styles.outer, { borderColor: value ? colors.primary : colors.ink2 }]}>
        {value ? <View style={[styles.inner, { backgroundColor: colors.primary }]} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[12], minHeight: layout.minTouch },
  outer: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { width: 12, height: 12, borderRadius: radius.pill },
  label: { flex: 1 },
});
