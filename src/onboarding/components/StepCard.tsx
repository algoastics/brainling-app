import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { palette, radius, space, typography, useTheme } from '@/theme';

export type StepCardProps = { index: number; text: string; trailing?: ReactNode };

/** Numbered how-to step (S07-restricted, S10): primary disc with the number, bold text. */
export const StepCard = memo(function StepCard({ index, text, trailing }: StepCardProps) {
  const { colors } = useTheme();
  return (
    <Card elevated style={styles.card}>
      <View style={styles.row} accessible accessibilityLabel={`${index}. ${text}`}>
        <View style={[styles.disc, { backgroundColor: colors.primary }]}>
          <Text style={styles.num}>{index}</Text>
        </View>
        <Text variant="body.md" style={styles.text}>
          {text}
        </Text>
        {trailing}
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { paddingVertical: space[12], paddingHorizontal: space[12] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[12], minHeight: 34 },
  disc: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: { ...typography['body.sm'], fontSize: 14, color: palette.white },
  text: { flex: 1, fontFamily: typography['body.lg'].fontFamily },
});
