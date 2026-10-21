import { router } from 'expo-router';

import { Button, Screen, Text } from '@/components/ui';
import { useT } from '@/i18n';

export default function MeScreen() {
  const t = useT();
  return (
    <Screen>
      <Text variant="heading.h1" accessibilityRole="header">
        {t('tabs.me')}
      </Text>
      {__DEV__ ? (
        <>
          <Button
            kind="secondary"
            label={t('me.designSystem')}
            onPress={() => router.push('/design-system')}
          />
          <Button
            kind="secondary"
            label={t('me.detectionDebug')}
            onPress={() => router.push('/detection-debug')}
          />
        </>
      ) : null}
    </Screen>
  );
}
