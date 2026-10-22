import BrainlingCore from 'brainling-core';
import { router } from 'expo-router';
import { useCallback } from 'react';

import { Button, Card, ListRow, Screen, Text } from '@/components/ui';
import { useServiceStatus } from '@/detection';
import { useT } from '@/i18n';
import {
  DISCLOSURE_PARAGRAPHS,
  DISCLOSURE_POINTS,
  disclosureParagraphKey,
  disclosurePointKey,
} from '@/onboarding/disclosure';
import { useAppStore } from '@/state/appStore';

const STEPS = ['step1', 'step2', 'step3', 'step4'] as const;

/**
 * Tester builds only (see `TESTER_MODE`): replaces onboarding with one screen. Shows the
 * required accessibility prominent disclosure before the settings button, step-by-step
 * instructions, and a live service status re-read on mount and on each return to the app.
 */
export default function TesterSetupScreen() {
  const t = useT();
  const { enabled } = useServiceStatus();
  const complete = useAppStore((s) => s.completeTesterSetup);
  const openSettings = useCallback(() => void BrainlingCore.openAccessibilitySettings(), []);
  const finish = useCallback(() => {
    complete();
    router.replace('/');
  }, [complete]);

  const status =
    enabled == null
      ? t('tester.statusChecking')
      : enabled
        ? t('tester.statusOn')
        : t('tester.statusOff');

  return (
    <Screen>
      <Text variant="heading.h2" accessibilityRole="header">
        {t('tester.title')}
      </Text>
      <Text variant="body.lg">{t('tester.intro')}</Text>
      <Text variant="heading.h3">{t('tester.disclosureHeading')}</Text>
      <Card>
        {DISCLOSURE_POINTS.map((p) => (
          <Text key={p.key}>{t(disclosurePointKey(p.key))}</Text>
        ))}
      </Card>
      {DISCLOSURE_PARAGRAPHS.map((k) => (
        <Text key={k} variant="body.sm" color="ink2">
          {t(disclosureParagraphKey(k))}
        </Text>
      ))}
      <Text variant="heading.h3">{t('tester.stepsHeading')}</Text>
      {STEPS.map((k) => (
        <Text key={k} color="ink2">
          {t(`tester.${k}`)}
        </Text>
      ))}
      <Text variant="body.sm" color="ink2">
        {t('tester.playProtect')}
      </Text>
      <Card>
        <ListRow title={t('tester.statusLabel')} value={status} />
      </Card>
      {enabled ? (
        <>
          <Text variant="body.sm" color="ink2">
            {t('tester.badgeNote')}
          </Text>
          <Button label={t('tester.continue')} onPress={finish} />
        </>
      ) : (
        <Button
          label={t('tester.cta')}
          accessibilityHint={t('tester.ctaHint')}
          onPress={openSettings}
        />
      )}
    </Screen>
  );
}
