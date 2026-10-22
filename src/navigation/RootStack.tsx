import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { TESTER_MODE, TESTER_SETUP_ROUTE } from '@/config/tester';
import { ONBOARDING_ROUTES } from '@/onboarding/flow';
import { useAppStore } from '@/state/appStore';
import { useTheme } from '@/theme';

/**
 * Root navigator. First launch lands in `(onboarding)` (the first available screen while
 * `(tabs)` is guarded); completing onboarding flips the guards, which drops the onboarding
 * history and redirects to Home. Tester builds ([TESTER_MODE]) skip onboarding and land on the
 * single Tester Setup screen instead.
 */
export function RootStack() {
  const { colors, scheme } = useTheme();
  const onboardingCompleted = useAppStore((s) => s.onboardingCompleted);
  const testerSetupDone = useAppStore((s) => s.testerSetupDone);
  const setupDone = TESTER_MODE ? testerSetupDone : onboardingCompleted;
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={TESTER_MODE && !testerSetupDone}>
          <Stack.Screen name="tester-setup" />
        </Stack.Protected>
        <Stack.Protected guard={!TESTER_MODE && !onboardingCompleted}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected
          guard={setupDone}
          redirectTo={TESTER_MODE ? TESTER_SETUP_ROUTE : ONBOARDING_ROUTES.welcome}
        >
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
