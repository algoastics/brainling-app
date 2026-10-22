import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Card, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { OnboardingHeader, OnboardingLayout, Title } from '@/onboarding/components';
import { ONBOARDING_ROUTES } from '@/onboarding/flow';
import { useOnboardingStore } from '@/onboarding/store';
import { radius, space, useTheme } from '@/theme';

const PREVIEWS = [
  { key: 'limit', when: 'now', inset: 0 },
  { key: 'streak', when: 'twoMin', inset: 6 },
  { key: 'stopped', when: 'oneHour', inset: 12 },
] as const;

type PreviewProps = { title: string; body: string; meta: string; inset: number };

const Preview = memo(function Preview({ title, body, meta, inset }: PreviewProps) {
  const { colors } = useTheme();
  return (
    <View style={{ marginHorizontal: inset }}>
      <Card elevated>
        <View style={styles.meta}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Mascot state="happy" size={24} />
          </View>
          <Text variant="caption" color="muted">
            {meta}
          </Text>
        </View>
        <Text variant="body.md" style={styles.previewTitle}>
          {title}
        </Text>
        <Text variant="body.sm" color="muted">
          {body}
        </Text>
      </Card>
    </View>
  );
});

/** S08 — notification permission primer, then the system POST_NOTIFICATIONS prompt. */
export default function NotificationsScreen() {
  const t = useT();
  const name = useOnboardingStore((s) => s.mascotName) || t('onboarding.notifications.defaultName');
  const setStep = useOnboardingStore((s) => s.setStep);
  const [busy, setBusy] = useState(false);

  const allow = useCallback(async () => {
    setBusy(true);
    try {
      const { granted } = await Notifications.requestPermissionsAsync();
      setStep('notifications', granted ? 'done' : 'skipped');
    } catch {
      setStep('notifications', 'skipped');
    } finally {
      setBusy(false);
    }
    router.push(ONBOARDING_ROUTES.battery);
  }, [setStep]);
  const skip = useCallback(() => {
    setStep('notifications', 'skipped');
    router.push(ONBOARDING_ROUTES.battery);
  }, [setStep]);

  return (
    <OnboardingLayout
      header={<OnboardingHeader step={2} total={4} onBack={router.back} />}
      footer={
        <>
          <Button
            label={t('onboarding.notifications.allow')}
            loading={busy}
            onPress={() => void allow()}
          />
          <Button kind="text" label={t('onboarding.skip')} onPress={skip} />
        </>
      }
    >
      <Title>{t('onboarding.notifications.title')}</Title>
      <Text color="ink2" style={styles.subtitle}>
        {t('onboarding.notifications.subtitle')}
      </Text>
      <View
        style={styles.previews}
        accessible
        accessibilityLabel={t('onboarding.notifications.examplesLabel')}
      >
        {PREVIEWS.map((p) => (
          <Preview
            key={p.key}
            inset={p.inset}
            meta={t(`onboarding.notifications.when.${p.when}`)}
            title={t(`onboarding.notifications.examples.${p.key}.title`)}
            body={t(`onboarding.notifications.examples.${p.key}.body`, { name })}
          />
        ))}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: space[12], fontSize: 14 },
  previews: { gap: space[16], marginTop: space[32] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space[8], marginBottom: space[4] },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewTitle: { marginTop: space[4] },
});
