import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

export type StepBarProps = { steps: number; current: number };

/** C09 — StepBar: segmented progress for multi-step flows (`current` is 0-based). */
export function StepBar({ steps, current }: StepBarProps) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: steps, now: current + 1 }}
      style={styles.row}
    >
      {Array.from({ length: steps }, (_, i) => (
        <View
          key={i}
          style={[styles.seg, { backgroundColor: i <= current ? colors.primary : colors.line }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[4] },
  seg: { flex: 1, height: 6, borderRadius: radius.pill },
});
