import * as Device from 'expo-device';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useT } from '@/i18n';
import {
  DesignDots,
  Icon,
  OnboardingHeader,
  OnboardingLayout,
  StatusBanner,
  StepCard,
  Title,
} from '@/onboarding/components';
import { ONBOARDING_ROUTES } from '@/onboarding/flow';
import { detectOem, guideOrder, OEM_STEP_COUNT, OEM_TARGETS, type OemKey } from '@/onboarding/oem';
import { openOemTargets } from '@/onboarding/settings';
import { useOnboardingStore } from '@/onboarding/store';
import { layout, radius, space, useTheme } from '@/theme';

const PhoneHint = memo(function PhoneHint() {
  const { colors } = useTheme();
  return (
    <View style={[styles.phone, { backgroundColor: colors.surface2 }]}>
      <Icon name="phone" size={20} color={colors.muted} />
    </View>
  );
});

const Guide = memo(function Guide({ oem }: { oem: OemKey }) {
  const t = useT();
  const steps = t(`onboarding.oem.${oem}.steps`, { returnObjects: true });
  return (
    <View style={styles.steps}>
      {steps.slice(0, OEM_STEP_COUNT[oem]).map((text, i) => (
        <StepCard key={text} index={i + 1} text={text} trailing={<PhoneHint />} />
      ))}
    </View>
  );
});

/**
 * S10 (+samsung, oppo, vivo, oneplus, pixel, intentfail) — phone-maker background guides. The
 * detected maker comes first, otherwise Samsung. "Open the setting" only launches explicit
 * components or App info; if none resolves, S10-intentfail shows the manual path.
 */
export default function OemScreen() {
  const t = useT();
  const { colors } = useTheme();
  const setStep = useOnboardingStore((s) => s.setStep);
  const detected = useMemo(() => detectOem(Device.manufacturer, Device.brand), []);
  const order = useMemo(() => guideOrder(detected), [detected]);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const oem = order[index] ?? 'samsung';

  const show = useCallback(
    (i: number) => {
      setIndex((i + order.length) % order.length);
      setFailed(false);
    },
    [order.length],
  );
  const open = useCallback(async () => {
    const ok = await openOemTargets(OEM_TARGETS[oem]);
    setFailed(!ok);
  }, [oem]);
  const finish = useCallback(
    (status: 'done' | 'skipped') => {
      setStep('autostart', status);
      router.push(ONBOARDING_ROUTES.setupCheck);
    },
    [setStep],
  );

  const name = t(`onboarding.oem.${oem}.name`);
  return (
    <OnboardingLayout
      header={<OnboardingHeader step={4} total={4} onBack={router.back} />}
      footer={
        <>
          <Button
            label={t('onboarding.oem.open')}
            iconRight={<Icon name="next" size={20} color={colors.onPrimary} strokeWidth={2.6} />}
            onPress={() => void open()}
          />
          <View style={styles.links}>
            <Button kind="text" label={t('onboarding.skip')} onPress={() => finish('skipped')} />
            <Button kind="text" label={t('onboarding.oem.didIt')} onPress={() => finish('done')} />
          </View>
        </>
      }
    >
      <Text variant="body.sm" color="primary">
        {t(oem === detected ? 'onboarding.oem.detected' : 'onboarding.oem.guideFor', { name })}
      </Text>
      <Title style={styles.title}>{t('onboarding.oem.title')}</Title>
      <Text color="ink2" style={styles.subtitle}>
        {t('onboarding.oem.subtitle', { maker: t(`onboarding.oem.${oem}.maker`) })}
      </Text>
      {failed ? (
        <View style={styles.banner}>
          <StatusBanner tone="warn" icon="alert" text={t('onboarding.oem.failed')} />
        </View>
      ) : null}
      <Guide oem={oem} />
      <Text variant="caption" color="muted" style={styles.vary}>
        {t('onboarding.oem.vary')}
      </Text>
      <View style={styles.pager}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.oem.previous')}
          onPress={() => show(index - 1)}
          style={styles.arrow}
        >
          <Icon name="back" size={20} color={colors.muted} />
        </Pressable>
        <View
          accessible
          accessibilityLabel={t('onboarding.oem.position', {
            name,
            index: index + 1,
            total: order.length,
          })}
        >
          <DesignDots count={order.length} index={index} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.oem.next')}
          onPress={() => show(index + 1)}
          style={styles.arrow}
        >
          <Icon name="next" size={20} color={colors.muted} />
        </Pressable>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space[8] },
  subtitle: { marginTop: space[12], fontSize: 14 },
  banner: { marginTop: space[16] },
  steps: { gap: space[12], marginTop: space[24] },
  phone: {
    width: 36,
    height: 40,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vary: { marginTop: space[16] },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
    marginTop: space[24],
  },
  arrow: {
    width: layout.minTouch,
    height: layout.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
});
