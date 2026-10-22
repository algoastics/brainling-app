import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Mascot } from '@/components/mascot';
import { BottomSheet, Button, Card, ProTag, Text } from '@/components/ui';
import { useT } from '@/i18n';
import {
  AppTile,
  Icon,
  OnboardingHeader,
  OnboardingLayout,
  Title,
  easeStandard,
} from '@/onboarding/components';
import {
  BUDGET,
  budgetMascotState,
  budgetMinutes,
  ONBOARDING_ROUTES,
  stepBudget,
} from '@/onboarding/flow';
import { useOnboardingStore } from '@/onboarding/store';
import { fonts, layout, radius, space, useTheme } from '@/theme';

type StepButtonProps = {
  kind: 'minus' | 'plus';
  label: string;
  disabled: boolean;
  onPress: () => void;
};

const StepButton = memo(function StepButton({ kind, label, disabled, onPress }: StepButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepBtn,
        { backgroundColor: colors.primarySoft, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      <Icon name={kind} size={24} color={colors.primary} strokeWidth={3} />
    </Pressable>
  );
});

/** A05 number tick: the value slides 8 dp in the direction of change (80 ms per digit). */
const BudgetValue = memo(function BudgetValue({
  value,
  direction,
}: {
  value: number;
  direction: 1 | -1;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    const duration = 80 * String(value).length;
    y.set(8 * direction);
    opacity.set(0.4);
    y.set(withTiming(0, { duration, easing: easeStandard }));
    opacity.set(withTiming(1, { duration, easing: easeStandard }));
  }, [direction, opacity, reduceMotion, value, y]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: y.get() }],
  }));
  return (
    <Animated.Text
      style={[styles.value, { color: colors.ink }, style]}
      importantForAccessibility="no"
    >
      {value}
    </Animated.Text>
  );
});

/** M22 — soft paywall for per-app limits. "See Pro" arrives with the paywall (M8). */
function ProSheet({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const t = useT();
  const { colors } = useTheme();
  const bars = [
    ['instagram', 0.7, colors.good],
    ['youtube', 0.4, colors.warn],
    ['tiktok', 0.9, colors.bad],
  ] as const;
  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      title={t('onboarding.m22.title')}
      body={t('onboarding.m22.body')}
      actions={[{ label: t('onboarding.m22.notNow'), onPress: onDismiss, kind: 'text' }]}
    >
      <ProTag />
      <View
        style={[styles.example, { backgroundColor: colors.surface2 }]}
        importantForAccessibility="no-hide-descendants"
      >
        {bars.map(([app, f, c]) => (
          <View key={app} style={styles.exampleCol}>
            <AppTile app={app} size={40} />
            <View style={[styles.exampleBar, { backgroundColor: colors.surface }]}>
              <View
                style={{
                  width: `${f * 100}%`,
                  height: 8,
                  borderRadius: radius.pill,
                  backgroundColor: c,
                }}
              />
            </View>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

/** S04 — daily reel budget (default 60, 10–300 in steps of 10) with the M22 Pro hint. */
export default function BudgetScreen() {
  const t = useT();
  const { colors } = useTheme();
  const budget = useOnboardingStore((s) => s.budget);
  const setBudget = useOnboardingStore((s) => s.setBudget);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [proOpen, setProOpen] = useState(false);

  const change = useCallback(
    (dir: 1 | -1) => {
      const next = stepBudget(budget, dir);
      if (next === budget) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setDirection(dir);
      setBudget(next);
    },
    [budget, setBudget],
  );
  const dec = useCallback(() => change(-1), [change]);
  const inc = useCallback(() => change(1), [change]);
  const openPro = useCallback(() => setProOpen(true), []);
  const closePro = useCallback(() => setProOpen(false), []);
  const next = useCallback(() => router.push(ONBOARDING_ROUTES.hatch), []);

  const lower = budget - BUDGET.step;
  const higher = budget + BUDGET.step;

  return (
    <OnboardingLayout
      header={<OnboardingHeader step={2} total={3} onBack={router.back} />}
      footer={
        <Button
          label={t('onboarding.continue')}
          iconRight={<Icon name="next" size={20} color={colors.onPrimary} strokeWidth={2.6} />}
          onPress={next}
        />
      }
    >
      <Title>{t('onboarding.budget.title')}</Title>
      <Text color="muted" style={styles.subtitle}>
        {t('onboarding.budget.subtitle')}
      </Text>
      <View style={styles.mascot}>
        <Mascot state={budgetMascotState(budget)} size={180} />
      </View>

      <Card elevated style={styles.stepper}>
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={t('onboarding.budget.value', { count: budget })}
          style={styles.neighbours}
        >
          <Text style={[styles.neighbour, { color: colors.muted }]} importantForAccessibility="no">
            {lower >= BUDGET.min ? lower : ' '}
          </Text>
          <Text style={[styles.neighbour, { color: colors.muted }]} importantForAccessibility="no">
            {higher <= BUDGET.max ? higher : ' '}
          </Text>
        </View>
        <View style={styles.row}>
          <StepButton
            kind="minus"
            label={t('onboarding.budget.decrease')}
            disabled={budget <= BUDGET.min}
            onPress={dec}
          />
          <View style={styles.center}>
            <View style={styles.valueClip}>
              <BudgetValue value={budget} direction={direction} />
            </View>
            <Text color="muted" variant="body.md" style={styles.perDay}>
              {t('onboarding.budget.perDay')}
            </Text>
          </View>
          <StepButton
            kind="plus"
            label={t('onboarding.budget.increase')}
            disabled={budget >= BUDGET.max}
            onPress={inc}
          />
        </View>
      </Card>

      <View style={[styles.estimate, { backgroundColor: colors.surface2 }]}>
        <Icon name="info" size={22} color={colors.muted} />
        <Text variant="body.sm" color="ink2" style={styles.flex}>
          {t('onboarding.budget.estimate', { count: budget, minutes: budgetMinutes(budget) })}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('onboarding.budget.proTitle')}. ${t('common.proFeature')}`}
        accessibilityHint={t('onboarding.budget.proHint')}
        onPress={openPro}
      >
        <Card elevated style={styles.pro}>
          <View style={styles.flex}>
            <Text variant="body.md" style={styles.bold}>
              {t('onboarding.budget.proTitle')}
            </Text>
            <Text variant="caption" color="muted">
              {t('onboarding.budget.proSubtitle')}
            </Text>
          </View>
          <View style={[styles.lockedToggle, { backgroundColor: colors.surface2 }]}>
            <View style={[styles.knob, { backgroundColor: colors.surface }]} />
            <Icon name="lock" size={14} color={colors.muted} />
          </View>
        </Card>
      </Pressable>
      <ProSheet visible={proOpen} onDismiss={closePro} />
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: space[8], fontSize: 14 },
  mascot: { alignItems: 'center', marginVertical: space[8] },
  stepper: { borderRadius: radius.sheet, paddingVertical: space[16] },
  neighbours: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 92,
  },
  neighbour: { fontFamily: fonts.display.semibold, fontSize: 24, lineHeight: 28, opacity: 0.35 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: layout.minTouch,
  },
  center: { alignItems: 'center' },
  valueClip: { height: 92, overflow: 'hidden', justifyContent: 'center' },
  value: {
    fontFamily: fonts.display.bold,
    fontSize: 80,
    lineHeight: 92,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  perDay: { fontFamily: fonts.body.bold, marginTop: -4 },
  estimate: {
    flexDirection: 'row',
    gap: space[12],
    alignItems: 'center',
    borderRadius: 18,
    padding: space[16],
    marginTop: space[16],
  },
  pro: { flexDirection: 'row', alignItems: 'center', gap: space[12], marginTop: space[16] },
  bold: { fontFamily: fonts.body.bold },
  flex: { flex: 1 },
  lockedToggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    justifyContent: 'space-between',
  },
  knob: { width: 22, height: 22, borderRadius: 11 },
  example: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    padding: space[20],
  },
  exampleCol: { gap: space[12] },
  exampleBar: { width: 90, height: 8, borderRadius: radius.pill, overflow: 'hidden' },
});
