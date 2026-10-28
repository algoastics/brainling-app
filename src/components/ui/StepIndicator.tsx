import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { radius, useTheme } from '@/theme';

import { Text } from './Text';

export type StepIndicatorProps = {
  /** 1-based current step. */
  current: number;
  total: number;
};

const DOT = 8;
const ACTIVE_WIDTH = 28;

/**
 * Step indicator (Figma 121:5922): one 8 dp pill per step, the current one 28 dp wide in the brand
 * colour, finished steps in lilac, and "n of total" on the right. The pills are decoration; the
 * text carries the meaning for screen readers.
 */
export function StepIndicator({ current, total }: StepIndicatorProps) {
  const { colors } = useTheme();
  const t = useT();
  const label = t('common.step', { current, total });
  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      <View style={styles.pills} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: total }, (_, i) => {
          const step = i + 1;
          const active = step === current;
          const done = step < current;
          return (
            <View
              key={step}
              style={[
                styles.pill,
                {
                  width: active ? ACTIVE_WIDTH : DOT,
                  backgroundColor: active
                    ? colors.brandPrimary
                    : done
                      ? colors.brandLilac
                      : colors.borderDefault,
                },
              ]}
            />
          );
        })}
      </View>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: { height: DOT, borderRadius: radius.xs / 2 },
});
