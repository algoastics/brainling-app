import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, space, useTheme } from '@/theme';

import { Icon } from './Icon';

import { Text } from './Text';

export type CheckboxProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  testID?: string;
};

/** C02 — Checkbox with a label; the whole row is the touch target. */
export function Checkbox({ value, onChange, label, disabled = false, testID }: CheckboxProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
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
            backgroundColor: value ? colors.brandPrimary : colors.bgSurface,
            borderColor: value ? colors.brandPrimary : colors.borderControl,
          },
        ]}
      >
        {value ? <Icon name="check" size={16} color="brandOnPrimary" bold /> : null}
      </View>
      <Text variant="label" color="textSecondary" style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[12],
    minHeight: layout.minTouch,
  },
  box: {
    marginTop: space[4],
    width: 24,
    height: 24,
    borderRadius: radius.xs - 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
});
