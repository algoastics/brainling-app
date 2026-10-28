import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Thumb } from '@/components/mascot';
import { Button, Card, Screen, ScreenGroup, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { space } from '@/theme';

/** S02-P0 Welcome (step 1 of 4). */
export function WelcomeScreen() {
  const t = useT();
  return (
    <Screen spread edges={['bottom']} testID="welcome">
      <ScreenGroup>
        <View style={styles.hero}>
          <Thumb pose="wave" width={192} />
        </View>
        <Text variant="h1" accessibilityRole="header">
          {t('welcome.title')}
        </Text>
        <Text variant="body" color="textSecondary">
          {t('welcome.body')}
        </Text>
        <Card tone="notice">
          <Text variant="label">{t('welcome.testTitle')}</Text>
          <Text variant="body" color="textSecondary">
            {t('welcome.testBody')}
          </Text>
        </Card>
      </ScreenGroup>
      <ScreenGroup>
        <Button
          label={t('welcome.cta')}
          onPress={() => router.push('/limit')}
          accessibilityHint={t('welcome.takes')}
        />
        <Text variant="caption" color="textMuted" style={styles.center}>
          {t('welcome.takes')}
        </Text>
      </ScreenGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: space[8] },
  center: { textAlign: 'center' },
});
