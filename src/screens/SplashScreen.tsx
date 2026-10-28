import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Thumb } from '@/components/mascot';
import { Text } from '@/components/ui';
import { Wordmark } from '@/components/Wordmark';
import { useT } from '@/i18n';
import { initialRoute } from '@/navigation/initialRoute';
import { useAppStore } from '@/state/appStore';
import { space, spacing, useTheme } from '@/theme';

/** How long S01 stays up before routing (first run: Welcome; later: Home). */
export const SPLASH_MS = 1200;

/** S01-P0 Splash: Thumb, the wordmark and the tagline. */
export function SplashScreen() {
  const t = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const onboardingCompleted = useAppStore((s) => s.onboardingCompleted);

  useEffect(() => {
    const id = setTimeout(() => router.replace(initialRoute(onboardingCompleted)), SPLASH_MS);
    return () => clearTimeout(id);
  }, [onboardingCompleted]);

  return (
    <View
      testID="splash"
      style={[
        styles.root,
        {
          backgroundColor: colors.bgScreen,
          paddingTop: insets.top + space[12],
          paddingBottom: insets.bottom + space[32],
        },
      ]}
    >
      <Thumb pose="happy" width={240} />
      <Wordmark size={48} />
      <Text variant="bodyL" color="textSecondary">
        {t('splash.tagline')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[12],
    paddingHorizontal: spacing.screenMargin,
  },
});
