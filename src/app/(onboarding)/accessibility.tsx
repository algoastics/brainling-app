import ThumbwellCore from 'thumbwell-core';
import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Mascot } from '@/components/mascot';
import { Button, Text } from '@/components/ui';
import { useServiceStatus } from '@/detection';
import { useT } from '@/i18n';
import {
  Icon,
  OnboardingHeader,
  OnboardingLayout,
  PhoneMock,
  StatusBanner,
  SuccessTick,
  TapPulse,
  Title,
} from '@/onboarding/components';
import { ONBOARDING_ROUTES } from '@/onboarding/flow';
import { useDisclosureAccepted } from '@/onboarding/useDisclosureGuard';
import { palette, radius, space, useTheme } from '@/theme';

const MOCK_ROWS = ['Accessibility', 'Installed apps', 'TalkBack', 'Thumbwell', 'Select to Speak'];
const MOCK_W = 280;

/**
 * S07 / S07-error / S07-success — opens Android accessibility settings and re-checks
 * `isServiceEnabled` each time the app returns to the foreground. Reachable only after S06.
 */
export default function AccessibilityScreen() {
  const t = useT();
  const { colors } = useTheme();
  const accepted = useDisclosureAccepted();
  const { enabled } = useServiceStatus();
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [enabled]);

  const open = useCallback(() => {
    setAttempted(true);
    void ThumbwellCore.openAccessibilitySettings();
  }, []);
  const help = useCallback(() => router.push(ONBOARDING_ROUTES.restricted), []);
  const next = useCallback(() => router.push(ONBOARDING_ROUTES.notifications), []);

  if (!accepted) return <Redirect href={ONBOARDING_ROUTES.disclosure} />;

  if (enabled) {
    return (
      <OnboardingLayout
        centered
        footer={
          <Button
            label={t('onboarding.continue')}
            iconRight={<Icon name="next" size={20} color={colors.onPrimary} strokeWidth={2.6} />}
            onPress={next}
          />
        }
      >
        <SuccessTick size={150} />
        <Title style={styles.center}>{t('onboarding.accessibility.successTitle')}</Title>
        <Text color="ink2" style={styles.center}>
          {t('onboarding.accessibility.successBody')}
        </Text>
        <Animated.View entering={FadeIn.delay(500).duration(250)} style={styles.successMascot}>
          <Mascot state="glowing" size={120} />
        </Animated.View>
      </OnboardingLayout>
    );
  }

  const stillOff = attempted && enabled === false;
  return (
    <OnboardingLayout
      header={<OnboardingHeader step={1} total={4} onBack={router.back} />}
      footer={
        <>
          <Button
            label={t('onboarding.accessibility.open')}
            iconRight={<Icon name="next" size={20} color={colors.onPrimary} strokeWidth={2.6} />}
            accessibilityHint={t('onboarding.accessibility.openHint')}
            onPress={open}
          />
          <Button kind="text" label={t('onboarding.accessibility.help')} onPress={help} />
        </>
      }
    >
      <Title>{t('onboarding.accessibility.title')}</Title>
      <Text variant="body.sm" color="primary" style={styles.path}>
        {t('onboarding.accessibility.path')}
      </Text>
      <View style={styles.mock}>
        <PhoneMock rows={MOCK_ROWS} highlight={3} width={MOCK_W} />
        <View style={styles.pulse}>
          <TapPulse />
        </View>
      </View>
      {stillOff ? (
        <View style={styles.banner}>
          <StatusBanner
            tone="bad"
            icon="alert"
            text={t('onboarding.accessibility.stillOff')}
            action={{ label: t('onboarding.accessibility.help'), onPress: help }}
          />
        </View>
      ) : null}
      <View style={[styles.note, { backgroundColor: colors.warnSoft }]}>
        <Icon name="alert" size={22} color={palette.sun700} />
        <Text variant="body.sm" style={styles.flex}>
          {t('onboarding.accessibility.warning')}
        </Text>
      </View>
      <View style={[styles.note, { backgroundColor: colors.surface2 }]}>
        <Icon name="info" size={22} color={colors.muted} />
        <Text variant="body.sm" color="ink2" style={styles.flex}>
          {t('onboarding.accessibility.banking')}
        </Text>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center', marginTop: space[16] },
  successMascot: { marginTop: space[24] },
  path: { marginTop: space[12] },
  mock: { alignItems: 'center', marginTop: space[24] },
  pulse: { position: 'absolute', top: 108, right: 34 },
  banner: { marginTop: space[16] },
  note: {
    flexDirection: 'row',
    gap: space[12],
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: space[16],
    marginTop: space[16],
  },
  flex: { flex: 1 },
});
