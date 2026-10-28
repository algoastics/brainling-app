import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

export type StatusChipProps = {
  label: string;
  /** good = green dot, warn = amber dot. */
  tone: 'good' | 'warn';
  testID?: string;
};

/** Status chip (Figma "Chip" status-good / status-warn): pill, 1.5 dp border, 8 dp status dot. */
export function StatusChip({ label, tone, testID }: StatusChipProps) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      style={[
        styles.chip,
        { backgroundColor: colors.bgSurface2, borderColor: colors.borderDefault },
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: tone === 'good' ? colors.statusGood : colors.statusWarn },
        ]}
      />
      <Text variant="label">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
    paddingHorizontal: space[16],
    paddingVertical: space[8],
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
