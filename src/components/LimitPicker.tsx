import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Chip, Icon, OdometerNumber, Slider } from '@/components/ui';
import { useT } from '@/i18n';
import { LIMIT_MAX, LIMIT_MIN, LIMIT_PRESETS, stepLimit } from '@/limit/limitRule';
import { haptics, useReducedMotion } from '@/motion';
import { radius, sizes, space, useTheme } from '@/theme';

export type LimitPickerProps = {
  value: number;
  onChange: (value: number) => void;
};

/** Slider range (Figma A57): steps of 10 from 10 to 200. The stepper still moves by 5. */
export const SLIDER_MIN = 10;
export const SLIDER_MAX = 200;
export const SLIDER_STEP = 10;

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
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const press = (to: number) => {
    scale.set(withTiming(reduced ? 1 : to, { duration: to < 1 ? 60 : 120 }));
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={() => {
        haptics.light();
        press(0.96);
      }}
      onPressOut={() => press(1)}
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.step,
          { borderColor: colors.borderControl, backgroundColor: colors.bgPrimarySoft },
          disabled && { opacity: 0.4 },
          style,
        ]}
      >
        <Icon name={icon} size={24} color="brandAccentText" />
      </Animated.View>
    </Pressable>
  );
}

/**
 * Limit picker (Figma S04 and the Daily limit sheet): 48 dp round steppers around an odometer
 * number, a 10 to 200 slider and the 30 / 60 / 100 presets.
 */
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
        <OdometerNumber testID="limit-value" value={value} label={t('limit.unit')} />
        <StepButton
          testID="limit-more"
          icon="plus"
          label={t('limit.more')}
          disabled={value >= LIMIT_MAX}
          onPress={() => onChange(stepLimit(value, 1))}
        />
      </View>
      <Slider
        testID="limit-slider"
        accessibilityLabel={t('limit.title')}
        value={value}
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={SLIDER_STEP}
        onChange={onChange}
      />
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
  root: { gap: space[16], alignItems: 'center', width: '100%' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[16] },
  step: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presets: { flexDirection: 'row', gap: space[8], justifyContent: 'center' },
});
