import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { useT } from '@/i18n';
import { layout, motion, radius, space, useTheme } from '@/theme';

import { Icon } from './Icon';
import { easeStandard } from './motion';

export type OnboardingHeaderProps = {
  step: number;
  total: number;
  onBack?: () => void;
};

/** Kit `ob_head`: back chevron, progress bar and "n/N" counter. The bar eases in from the last step. */
export const OnboardingHeader = memo(function OnboardingHeader({
  step,
  total,
  onBack,
}: OnboardingHeaderProps) {
  const { colors } = useTheme();
  const t = useT();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue((step - 1) / total);

  useEffect(() => {
    progress.set(
      withTiming(step / total, {
        duration: reduceMotion ? 0 : motion.duration.base,
        easing: easeStandard,
      }),
    );
  }, [progress, reduceMotion, step, total]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={onBack}
          style={styles.back}
        >
          <Icon name="back" size={26} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
      ) : (
        <View style={styles.back} />
      )}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('onboarding.progress', { step, total })}
        accessibilityValue={{ min: 0, max: total, now: step }}
        style={[styles.track, { backgroundColor: colors.surface2 }]}
      >
        <Animated.View style={[styles.fill, { backgroundColor: colors.primary }, fill]} />
      </View>
      <Text variant="caption" color="muted" style={styles.count} importantForAccessibility="no">
        {t('onboarding.stepOf', { step, total })}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space[4],
    paddingRight: space[20],
    minHeight: 56,
  },
  back: {
    width: layout.minTouch,
    height: layout.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginLeft: space[8],
  },
  fill: { height: 8, borderRadius: radius.pill },
  count: { minWidth: 32, textAlign: 'right', marginLeft: space[12] },
});
