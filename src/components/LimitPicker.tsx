import { Pressable, StyleSheet, View } from 'react-native';

import { Chip, Icon, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { LIMIT_MAX, LIMIT_MIN, LIMIT_PRESETS, stepLimit } from '@/limit/limitRule';
import { space, useTheme } from '@/theme';

export type LimitPickerProps = {
  value: number;
  onChange: (value: number) => void;
};

function StepButton({
  icon,
  label,
  onPress,
  disabled,
  testID,
}: {
  icon: 'minus' | 'plus';
  label: string;
  onPress: () => void;
  disabled: boolean;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.step,
        { borderColor: colors.borderControl, backgroundColor: colors.bgSurface },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Icon name={icon} size={24} />
    </Pressable>
  );
}

/** Limit stepper (48dp round buttons around the value) with the 30 / 60 / 100 presets (S04). */
export function LimitPicker({ value, onChange }: LimitPickerProps) {
  const t = useT();
  return (
    <View style={styles.root}>
      <View style={styles.stepper}>
        <StepButton
          testID="limit-less"
          icon="minus"
          label={t('limit.less')}
          disabled={value <= LIMIT_MIN}
          onPress={() => onChange(stepLimit(value, -1))}
        />
        <View style={styles.value} accessible accessibilityLiveRegion="polite">
          <Text variant="h1" testID="limit-value">
            {String(value)}
          </Text>
          <Text variant="label" color="textMuted">
            {t('limit.unit')}
          </Text>
        </View>
        <StepButton
          testID="limit-more"
          icon="plus"
          label={t('limit.more')}
          disabled={value >= LIMIT_MAX}
          onPress={() => onChange(stepLimit(value, 1))}
        />
      </View>
      <View accessibilityRole="radiogroup" style={styles.presets}>
        {LIMIT_PRESETS.map((preset) => (
          <Chip
            key={preset}
            testID={`limit-preset-${preset}`}
            label={t('limit.preset', { count: preset })}
            selected={value === preset}
            onPress={() => onChange(preset)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[16], alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[24] },
  step: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { minWidth: 96, alignItems: 'center' },
  presets: { flexDirection: 'row', gap: space[8], justifyContent: 'center' },
});
