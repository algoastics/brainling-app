import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StepIndicator } from '@/components/ui';
import { bezier, useReducedMotion } from '@/motion';
import { motion, space, spacing, useTheme } from '@/theme';
import { ONBOARDING_STEPS, onboardingStepFor } from '@/onboarding/steps';
import { useOverlayStage } from '@/onboarding/overlayStage';

const ENTER_DISTANCE = 30;
const ENTER_EASING = bezier(motion.easing.decelerate);

/**
 * Layout of the onboarding routes (Welcome, Limit, Disclosure, Guide). It owns the step header, so
 * the dots and the counter stay mounted and fixed while only the content below changes. Content
 * transition (A53): the new screen replaces the old at once and slides in 30 dp from the right
 * while fading in over 300 ms; reduced motion swaps with no movement. It also pads the top safe
 * area, so the screens inside pad the bottom only.
 */
export function OnboardingLayout() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const { from } = useGlobalSearchParams<{ from?: string }>();
  const overlayStage = useOverlayStage((s) => s.active);
  const step = onboardingStepFor(pathname, from, overlayStage);
  const reduced = useReducedMotion();
  const enter = useSharedValue(1);
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (reduced) return;
    enter.set(0);
    enter.set(withTiming(1, { duration: motion.duration.base, easing: ENTER_EASING }));
  }, [pathname, reduced, enter]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.get(),
    transform: [{ translateX: (1 - enter.get()) * ENTER_DISTANCE }],
  }));
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
      <Animated.View style={[styles.body, enterStyle]}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
            contentStyle: { backgroundColor: colors.bgScreen },
          }}
        />
      </Animated.View>
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
