import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Text } from '@/components/ui';
import { useT } from '@/i18n';
import {
  BatteryFill,
  Icon,
  MascotProp,
  OnboardingHeader,
  OnboardingLayout,
  Title,
} from '@/onboarding/components';
import { ONBOARDING_ROUTES } from '@/onboarding/flow';
import { openBatterySettings } from '@/onboarding/settings';
import { useOnboardingStore } from '@/onboarding/store';
import { radius, space, useTheme } from '@/theme';

/** S09 — battery optimisation (A09 fill). Opens the system battery-optimisation list. */
export default function BatteryScreen() {
  const t = useT();
  const { colors } = useTheme();
  const setStep = useOnboardingStore((s) => s.setStep);
  const [busy, setBusy] = useState(false);

  const allow = useCallback(async () => {
    setBusy(true);
    const opened = await openBatterySettings();
    setBusy(false);
    setStep('battery', opened ? 'done' : 'skipped');
    router.push(ONBOARDING_ROUTES.oem);
  }, [setStep]);
  const skip = useCallback(() => {
    setStep('battery', 'skipped');
    router.push(ONBOARDING_ROUTES.oem);
  }, [setStep]);

  return (
    <OnboardingLayout
      header={<OnboardingHeader step={3} total={4} onBack={router.back} />}
      footer={
        <>
          <Button
            label={t('onboarding.battery.allow')}
            accessibilityHint={t('onboarding.battery.allowHint')}
            loading={busy}
            onPress={() => void allow()}
          />
          <Button kind="text" label={t('onboarding.skip')} onPress={skip} />
        </>
      }
    >
      <Title>{t('onboarding.battery.title')}</Title>
      <View style={styles.art} importantForAccessibility="no-hide-descendants">
        <BatteryFill />
        <View style={styles.mascot}>
          <Mascot state="happy" size={120} />
          <View style={styles.prop}>
            <MascotProp kind="battery" size={34} />
          </View>
        </View>
      </View>
      <Text variant="body.lg" style={styles.body}>
        {t('onboarding.battery.body')}
      </Text>
      <View style={[styles.note, { backgroundColor: colors.goodSoft }]}>
        <Icon name="shield" size={22} color={colors.good} />
        <Text variant="body.sm" style={styles.flex}>
          {t('onboarding.battery.usage')}
        </Text>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: 'center', marginTop: space[40], gap: space[32] },
  mascot: { width: 120 },
  prop: { position: 'absolute', right: -26, top: 36 },
  body: { marginTop: space[32] },
  note: {
    flexDirection: 'row',
    gap: space[12],
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: space[16],
    marginTop: space[24],
  },
  flex: { flex: 1 },
});
