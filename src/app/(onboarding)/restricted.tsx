import { Redirect, router } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { Icon, OnboardingHeader, OnboardingLayout, StepCard, Title } from '@/onboarding/components';
import { ONBOARDING_ROUTES } from '@/onboarding/flow';
import { openAppInfo } from '@/onboarding/settings';
import { useDisclosureAccepted } from '@/onboarding/useDisclosureGuard';
import { space, useTheme } from '@/theme';

const STEPS = ['appInfo', 'menu', 'allow', 'back'] as const;

/**
 * S07-restricted — Android 13+ blocks Accessibility for sideloaded apps until "Allow restricted
 * settings" is ticked in App info → ⋮. Shown after S06 on API 33+, and from S07's "Need help?".
 */
export default function RestrictedScreen() {
  const t = useT();
  const { colors } = useTheme();
  const accepted = useDisclosureAccepted();
  const open = useCallback(() => void openAppInfo(), []);
  const next = useCallback(() => router.push(ONBOARDING_ROUTES.accessibility), []);

  if (!accepted) return <Redirect href={ONBOARDING_ROUTES.disclosure} />;

  return (
    <OnboardingLayout
      header={<OnboardingHeader step={1} total={4} onBack={router.back} />}
      footer={
        <>
          <Button
            label={t('onboarding.restricted.open')}
            iconRight={<Icon name="next" size={20} color={colors.onPrimary} strokeWidth={2.6} />}
            accessibilityHint={t('onboarding.restricted.openHint')}
            onPress={open}
          />
          <Button kind="text" label={t('onboarding.restricted.done')} onPress={next} />
        </>
      }
    >
      <Title>{t('onboarding.restricted.title')}</Title>
      <Text color="ink2" style={styles.subtitle}>
        {t('onboarding.restricted.subtitle')}
      </Text>
      <View style={styles.steps}>
        {STEPS.map((s, i) => (
          <StepCard key={s} index={i + 1} text={t(`onboarding.restricted.steps.${s}`)} />
        ))}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: space[12], fontSize: 14 },
  steps: { gap: space[12], marginTop: space[24] },
});
