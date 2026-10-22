import BrainlingCore from 'brainling-core';
import { router } from 'expo-router';
import { useCallback } from 'react';

import { AppBar, Button, Card, Screen, Text } from '@/components/ui';
import { useServiceStatus } from '@/detection';
import { useT } from '@/i18n';

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Target of the watchdog's "service turned off" notification (`brainling://reenable`). Explains
 * why the AccessibilityService is needed before offering the settings link, so no system
 * settings deep-link happens without the disclosure. Re-checks the service on foreground.
 */
export default function ReenableScreen() {
  const t = useT();
  const { enabled } = useServiceStatus();
  const openSettings = useCallback(() => void BrainlingCore.openAccessibilitySettings(), []);

  return (
    <Screen>
      <AppBar title={t('reenable.title')} onBack={leave} />
      {enabled ? (
        <>
          <Text variant="body.lg" accessibilityRole="header">
            {t('reenable.done')}
          </Text>
          <Button label={t('reenable.home')} onPress={leave} />
        </>
      ) : (
        <>
          <Text variant="body.lg">{t('reenable.body')}</Text>
          <Card>
            <Text>{t('reenable.why')}</Text>
          </Card>
          <Text color="ink2">{t('reenable.steps')}</Text>
          <Button
            label={t('reenable.cta')}
            accessibilityHint={t('reenable.ctaHint')}
            onPress={openSettings}
          />
          <Button kind="text" label={t('reenable.later')} onPress={leave} />
        </>
      )}
    </Screen>
  );
}
