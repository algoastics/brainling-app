import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useAppStore } from '@/state/appStore';
import { useTheme } from '@/theme';

/**
 * Root navigator. `index` is the splash and routes on first-run state: Welcome, Limit, Disclosure
 * and Guide form the onboarding; Home and About need onboarding to be done (S06 "Not now" or the
 * guide's "Go to Home" completes it). The lock preview and the detection debug screen exist in
 * development builds only.
 */
export function RootStack() {
  const { colors, scheme } = useTheme();
  const onboardingCompleted = useAppStore((s) => s.onboardingCompleted);
  return (
    <>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgScreen } }}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="limit" />
        <Stack.Screen name="disclosure" />
        <Stack.Screen name="guide" />
        <Stack.Protected guard={onboardingCompleted}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="about" />
        </Stack.Protected>
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="lock-preview" />
          <Stack.Screen name="detection-debug" />
        </Stack.Protected>
        {/* Unguarded: the watchdog deep link must open whether or not onboarding is done. */}
        <Stack.Screen name="reenable" />
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
