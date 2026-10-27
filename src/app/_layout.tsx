import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BrandSplash } from '@/components/brand';
import { useT } from '@/i18n';
import { RootStack } from '@/navigation/RootStack';
import { getStorage } from '@/storage';
import { ThemeProvider, useThumbwellFonts } from '@/theme';

SplashScreen.preventAutoHideAsync();

function openStorage(): boolean {
  try {
    getStorage();
    return true;
  } catch {
    return false;
  }
}

export default function RootLayout() {
  const t = useT();
  const [fontsLoaded, fontError] = useThumbwellFonts();
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
