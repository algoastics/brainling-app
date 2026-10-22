import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { mascotAst, type MascotArtState } from '@/components/mascot';
import { useTheme } from '@/theme';

export const unstable_settings = { initialRouteName: 'welcome' };

/** Mascot states drawn during onboarding; parsed once, after the first frame, not on mount. */
const ONBOARDING_MASCOTS: readonly MascotArtState[] = ['happy', 'fried', 'glowing', 'meh'];

export default function OnboardingLayout() {
  const { colors } = useTheme();

  useEffect(() => {
    const id = setTimeout(() => ONBOARDING_MASCOTS.forEach(mascotAst), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
