import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StepIndicator } from '@/components/ui';
import { motion, space, spacing, useTheme } from '@/theme';
import { ONBOARDING_STEPS, onboardingStepFor } from '@/onboarding/steps';
import { useOverlayStage } from '@/onboarding/overlayStage';

/**
 * Layout of the onboarding routes (Welcome, Limit, Disclosure, Guide). It owns the step header, so
 * the dots and the counter stay mounted and fixed while only the screen below slides in (300 ms).
 * It also pads the top safe area, so the screens inside pad the bottom only.
 */
export function OnboardingLayout() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const { from } = useGlobalSearchParams<{ from?: string }>();
  const overlayStage = useOverlayStage((s) => s.active);
  const step = onboardingStepFor(pathname, from, overlayStage);
  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.root, { backgroundColor: colors.bgScreen }]}
      testID="onboarding-layout"
    >
      {step !== null ? (
        <View style={styles.header} testID="onboarding-header">
          <StepIndicator current={step} total={ONBOARDING_STEPS} />
        </View>
      ) : null}
      <View style={styles.body}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: motion.duration.base,
            contentStyle: { backgroundColor: colors.bgScreen },
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenMargin,
    paddingTop: space[12],
    paddingBottom: space[4],
  },
  body: { flex: 1 },
});
