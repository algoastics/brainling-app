import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ONBOARDING_ROUTES } from '@/onboarding/flow';
import { useAppStore } from '@/state/appStore';
import { useTheme } from '@/theme';

/**
 * Root navigator. First launch lands in `(onboarding)` (the first available screen while
 * `(tabs)` is guarded); completing onboarding flips the guards, which drops the onboarding
 * history and redirects to Home.
 */
export function RootStack() {
  const { colors, scheme } = useTheme();
  const onboardingCompleted = useAppStore((s) => s.onboardingCompleted);
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={!onboardingCompleted}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={onboardingCompleted} redirectTo={ONBOARDING_ROUTES.welcome}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Screen name="design-system" options={{ presentation: 'modal' }} />
        <Stack.Screen name="detection-debug" options={{ presentation: 'modal' }} />
        {/* Unguarded: the watchdog deep-link must open whether or not onboarding is done. */}
        <Stack.Screen name="reenable" />
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
