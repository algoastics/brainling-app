import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

export type ProgressDotsProps = { count: number; index: number };

/** C09 — ProgressDots for paged flows; the active dot is elongated. */
export function ProgressDots({ count, index }: ProgressDotsProps) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
      style={styles.row}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === index
              ? { width: 24, backgroundColor: colors.primary }
              : { backgroundColor: colors.line },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[8], alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
});
