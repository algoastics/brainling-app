import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Button, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { RootStack } from '@/navigation/RootStack';
import { getStorage } from '@/storage';
import { ThemeProvider, space, useTheme, useThumbwellFonts } from '@/theme';

SplashScreen.preventAutoHideAsync();

function openStorage(): boolean {
  try {
    getStorage();
    return true;
  } catch {
    return false;
  }
}

function StorageError({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View style={[styles.error, { backgroundColor: colors.bgScreen }]}>
      <Text variant="h3" style={styles.center}>
        {t('splash.storageError')}
      </Text>
      <Button label={t('splash.retry')} onPress={onRetry} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useThumbwellFonts();
  const [storageReady, setStorageReady] = useState(openStorage);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  const retryStorage = useCallback(() => setStorageReady(openStorage()), []);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {storageReady ? <RootStack /> : <StorageError onRetry={retryStorage} />}
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', padding: space[24], gap: space[16] },
  center: { textAlign: 'center' },
});
