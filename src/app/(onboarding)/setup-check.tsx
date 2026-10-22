import BrainlingCore from 'brainling-core';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Card, Text } from '@/components/ui';
import { useServiceStatus } from '@/detection';
import { useT } from '@/i18n';
import { Confetti, Icon, OnboardingLayout, Title } from '@/onboarding/components';
import {
  evaluateSelfTest,
  ONBOARDING_ROUTES,
  reelsSince,
  SELF_TEST_REELS,
  type CountSnapshot,
  type SelfTestOutcome,
} from '@/onboarding/flow';
import { detectOem, needsAutostart } from '@/onboarding/oem';
import { useOnboardingStore, type StepStatus } from '@/onboarding/store';
import { useAppStore } from '@/state/appStore';
import { fonts, palette, radius, space, useTheme } from '@/theme';

type RowState = 'ok' | 'off' | 'skipped' | 'notNeeded';

const RowStatus = memo(function RowStatus({ state }: { state: RowState }) {
  const t = useT();
  const { colors } = useTheme();
  if (state === 'ok') {
    return (
      <View style={[styles.tick, { backgroundColor: colors.good }]}>
        <Icon name="check" size={16} color={palette.white} strokeWidth={3} />
      </View>
    );
  }
  const color = state === 'off' ? colors.bad : state === 'skipped' ? palette.sun700 : colors.muted;
  return (
    <Text variant="caption" style={[styles.status, { color }]}>
      {t(`onboarding.setupCheck.status.${state}`)}
    </Text>
  );
});

type RowProps = { label: string; state: RowState; onPress?: () => void };

const Row = memo(function Row({ label, state, onPress }: RowProps) {
  const t = useT();
  const body = (
    <Card elevated style={styles.row}>
      <Text variant="body.md" style={styles.rowLabel}>
        {label}
      </Text>
      <RowStatus state={state} />
    </Card>
  );
  const a11y = `${label}: ${t(`onboarding.setupCheck.status.${state}`)}`;
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress}>
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={a11y}>
      {body}
    </View>
  );
});

const stepState = (s: StepStatus): RowState => (s === 'done' ? 'ok' : 'skipped');

async function snapshot(): Promise<CountSnapshot> {
  const { date, total } = await BrainlingCore.getTodayCounts();
  return { date, total };
}

/** Live self-test: counts reels since "Run test"; a failure is decided only back in the app. */
function useSelfTest() {
  const [baseline, setBaseline] = useState<CountSnapshot | null>(null);
  const [seen, setSeen] = useState(0);
  const [returned, setReturned] = useState(false);

  useEffect(() => {
    if (!baseline) return;
    const update = (c: CountSnapshot) => setSeen(reelsSince(baseline, c));
    const counts = BrainlingCore.addListener('onCountChange', update);
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void snapshot().then((c) => {
          update(c);
          setReturned(true);
        });
      } else {
        setReturned(false);
      }
    });
    return () => {
      counts.remove();
      app.remove();
    };
  }, [baseline]);

  const start = useCallback(() => {
    setSeen(0);
    setReturned(false);
    void snapshot().then(setBaseline);
  }, []);

  const outcome: SelfTestOutcome | 'idle' = baseline ? evaluateSelfTest(seen, returned) : 'idle';
  return { outcome, seen, start };
}

/** S13 / S13-pass / S13-fail — setup summary and live self-test. S11 (overlay) is not in the MVP. */
export default function SetupCheckScreen() {
  const t = useT();
  const { colors } = useTheme();
  const { enabled } = useServiceStatus();
  const notifications = useOnboardingStore((s) => s.notifications);
  const battery = useOnboardingStore((s) => s.battery);
  const autostart = useOnboardingStore((s) => s.autostart);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const oem = useMemo(() => detectOem(Device.manufacturer, Device.brand), []);
  const { outcome, seen, start } = useSelfTest();

  useEffect(() => {
    if (outcome === 'pass')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [outcome]);

  const toAccessibility = useCallback(() => router.push(ONBOARDING_ROUTES.accessibility), []);
  const toOem = useCallback(() => router.push(ONBOARDING_ROUTES.oem), []);
  const finishIcon = <Icon name="next" size={20} color={colors.onPrimary} strokeWidth={2.6} />;

  if (outcome === 'pass') {
    return (
      <OnboardingLayout
        centered
        footer={
          <Button
            label={t('onboarding.setupCheck.finish')}
            iconRight={finishIcon}
            onPress={completeOnboarding}
          />
        }
      >
        <View style={[styles.halo, { backgroundColor: colors.goodSoft }]}>
          <Confetti burst count={48} spread={190} />
          <Mascot state="glowing" size={190} />
        </View>
        <Title style={styles.center} accessibilityLiveRegion="polite">
          {t('onboarding.setupCheck.passTitle', { count: seen })}
        </Title>
        <Text color="muted" style={styles.center}>
          {t('onboarding.setupCheck.passBody')}
        </Text>
      </OnboardingLayout>
    );
  }

  if (outcome === 'fail') {
    return (
      <OnboardingLayout
        centered
        footer={
          <>
            <Button
              label={t('onboarding.setupCheck.retry')}
              icon={<Icon name="refresh" size={20} color={colors.onPrimary} strokeWidth={2.6} />}
              onPress={start}
            />
            <Button
              kind="secondary"
              label={t('onboarding.setupCheck.checkPhone')}
              onPress={toOem}
            />
            <Button
              kind="text"
              label={t('onboarding.setupCheck.finishAnyway')}
              onPress={completeOnboarding}
            />
          </>
        }
      >
        <View style={[styles.halo, { backgroundColor: colors.badSoft }]}>
          <Mascot state="meh" size={190} />
        </View>
        <Title style={styles.center} accessibilityLiveRegion="polite">
          {t('onboarding.setupCheck.failTitle')}
        </Title>
        <Text color="muted" style={styles.center}>
          {t('onboarding.setupCheck.failBody', { count: seen })}
        </Text>
      </OnboardingLayout>
    );
  }

  const running = outcome === 'running';
  return (
    <OnboardingLayout
      footer={
        <>
          <Button
            kind="secondary"
            label={t(running ? 'onboarding.setupCheck.restart' : 'onboarding.setupCheck.run')}
            icon={<Icon name="play" size={18} color={colors.primary} />}
            disabled={enabled === false}
            onPress={start}
          />
          <Button
            label={t('onboarding.setupCheck.finish')}
            iconRight={finishIcon}
            onPress={completeOnboarding}
          />
        </>
      }
    >
      <Title style={styles.title}>{t('onboarding.setupCheck.title')}</Title>
      <View style={styles.rows}>
        <Row
          label={t('onboarding.setupCheck.rows.accessibility')}
          state={enabled ? 'ok' : 'off'}
          onPress={enabled ? undefined : toAccessibility}
        />
        <Row
          label={t('onboarding.setupCheck.rows.notifications')}
          state={stepState(notifications)}
        />
        <Row label={t('onboarding.setupCheck.rows.battery')} state={stepState(battery)} />
        {needsAutostart(oem) ? (
          <Row
            label={t('onboarding.setupCheck.rows.autostart', {
              maker: t(`onboarding.oem.${oem}.maker`),
            })}
            state={stepState(autostart)}
            onPress={autostart === 'done' ? undefined : toOem}
          />
        ) : null}
        <Row label={t('onboarding.setupCheck.rows.overlay')} state="notNeeded" />
      </View>
      <View style={[styles.test, { backgroundColor: colors.primarySoft }]}>
        <Text variant="body.lg" style={styles.testTitle}>
          {t('onboarding.setupCheck.testTitle')}
        </Text>
        <Text variant="body.sm" color="ink2">
          {t('onboarding.setupCheck.testBody', { count: SELF_TEST_REELS })}
        </Text>
        <View style={styles.testRow}>
          <Text
            style={[styles.big, { color: colors.primary }]}
            accessibilityLabel={t('onboarding.setupCheck.progress', {
              seen,
              total: SELF_TEST_REELS,
            })}
            accessibilityLiveRegion="polite"
          >
            {`${seen} → ${SELF_TEST_REELS}`}
          </Text>
          <Mascot state="happy" size={64} />
        </View>
        {enabled === false ? (
          <Text variant="caption" color="bad">
            {t('onboarding.setupCheck.needsAccessibility')}
          </Text>
        ) : null}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space[24] },
  rows: { gap: space[8], marginTop: space[16] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[12],
  },
  rowLabel: { fontFamily: fonts.body.bold },
  tick: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { fontFamily: fonts.body.bold },
  test: { borderRadius: radius.xl, padding: space[20], marginTop: space[16], gap: space[4] },
  testTitle: { fontFamily: fonts.display.semibold, fontSize: 20 },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[48],
    marginTop: space[16],
  },
  big: { fontFamily: fonts.display.bold, fontSize: 56, lineHeight: 64 },
  halo: {
    width: 240,
    height: 240,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[24],
  },
  center: { textAlign: 'center', marginTop: space[8] },
});
