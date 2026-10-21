import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BrandSplash } from '@/components/brand';
import { useT } from '@/i18n';
import { getStorage } from '@/storage';
import { ThemeProvider, useBrainlingFonts, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

function openStorage(): boolean {
  try {
    getStorage();
    return true;
  } catch {
    return false;
  }
}

function RootStack() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="design-system" options={{ presentation: 'modal' }} />
        <Stack.Screen name="detection-debug" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  const t = useT();
  const [fontsLoaded, fontError] = useBrainlingFonts();
  const [storageReady, setStorageReady] = useState(openStorage);
  const [introDone, setIntroDone] = useState(false);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  const finishIntro = useCallback(() => setIntroDone(true), []);
  const retryStorage = useCallback(() => setStorageReady(openStorage()), []);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {storageReady ? <RootStack /> : null}
        {!storageReady ? (
          <BrandSplash
            error={{
              message: t('splash.storageError'),
              retryLabel: t('splash.retry'),
              onRetry: retryStorage,
            }}
          />
        ) : !introDone ? (
          <BrandSplash onIntroFinished={finishIntro} />
        ) : null}
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
