import { router } from 'expo-router';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Chip, Text } from '@/components/ui';
import { useT } from '@/i18n';
import {
  AppTile,
  GuessSlider,
  Icon,
  OnboardingHeader,
  OnboardingLayout,
  Title,
} from '@/onboarding/components';
import { GUESS, ONBOARDING_ROUTES } from '@/onboarding/flow';
import { GOALS, QUIZ_APPS, useOnboardingStore, type QuizApp } from '@/onboarding/store';
import { elevation, fonts, palette, radius, space, typography, useTheme } from '@/theme';

type AppCardProps = { app: QuizApp; selected: boolean; onToggle: (app: QuizApp) => void };

const AppCard = memo(function AppCard({ app, selected, onToggle }: AppCardProps) {
  const t = useT();
  const { colors } = useTheme();
  const label = t(`onboarding.quiz.apps.${app}`);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={() => onToggle(app)}
      style={styles.appCell}
    >
      <View style={[styles.appShade, { backgroundColor: colors.shadow }]} />
      <View
        style={[
          styles.appCard,
          {
            backgroundColor: selected ? colors.primarySoft : colors.surface,
            borderColor: selected ? colors.primary : colors.line,
          },
        ]}
      >
        <AppTile app={app} size={40} />
        <Text variant="body.md" style={styles.appName} numberOfLines={1}>
          {label}
        </Text>
        <View
          style={[
            styles.box,
            selected
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : { backgroundColor: colors.surface, borderColor: colors.muted },
          ]}
        >
          {selected ? <Icon name="check" size={18} color={palette.white} strokeWidth={3} /> : null}
        </View>
      </View>
    </Pressable>
  );
});

/**
 * S03 — quick quiz. Lists only the apps enabled in the signed ruleset (Instagram, YouTube).
 * S03-empty needs installed-app detection, which the native module does not offer yet.
 */
export default function QuizScreen() {
  const t = useT();
  const { colors } = useTheme();
  const apps = useOnboardingStore((s) => s.apps);
  const guess = useOnboardingStore((s) => s.guess);
  const goals = useOnboardingStore((s) => s.goals);
  const toggleApp = useOnboardingStore((s) => s.toggleApp);
  const setGuess = useOnboardingStore((s) => s.setGuess);
  const toggleGoal = useOnboardingStore((s) => s.toggleGoal);

  const next = useCallback(() => router.push(ONBOARDING_ROUTES.budget), []);
  const guessLabel = guess >= GUESS.max ? t('onboarding.quiz.guessMax') : String(guess);

  return (
    <OnboardingLayout
      header={<OnboardingHeader step={1} total={3} onBack={router.back} />}
      footer={
        <Button
          label={t('onboarding.continue')}
          iconRight={<Icon name="next" size={20} color={colors.onPrimary} strokeWidth={2.6} />}
          onPress={next}
        />
      }
    >
      <Title>{t('onboarding.quiz.title')}</Title>
      <Text color="muted" style={styles.subtitle}>
        {t('onboarding.quiz.subtitle')}
      </Text>
      <View style={styles.grid}>
        {QUIZ_APPS.map((app) => (
          <AppCard key={app} app={app} selected={apps.includes(app)} onToggle={toggleApp} />
        ))}
      </View>

      <View style={styles.guessHead}>
        <Text style={styles.section} accessibilityRole="header">
          {t('onboarding.quiz.guessTitle')}
        </Text>
        <Text style={[styles.section, { color: colors.primary }]} importantForAccessibility="no">
          {guessLabel}
        </Text>
      </View>
      <GuessSlider
        value={guess}
        min={GUESS.min}
        max={GUESS.max}
        step={GUESS.step}
        onChange={setGuess}
        accessibilityLabel={t('onboarding.quiz.guessLabel')}
        valueText={t('onboarding.quiz.guessValue', { count: guess })}
        minLabel={t('onboarding.quiz.guessMin')}
        maxLabel={t('onboarding.quiz.guessMax')}
      />

      <Text style={[styles.section, styles.goalsTitle]} accessibilityRole="header">
        {t('onboarding.quiz.goalsTitle')}
      </Text>
      <View style={styles.chips}>
        {GOALS.map((goal) => (
          <Chip
            key={goal}
            label={t(`onboarding.quiz.goals.${goal}`)}
            selected={goals.includes(goal)}
            onChange={() => toggleGoal(goal)}
            icon={
              goals.includes(goal) ? (
                <Icon name="check" size={16} color={colors.primary} strokeWidth={3} />
              ) : undefined
            }
          />
        ))}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: space[8], fontSize: 14.5 },
  grid: { flexDirection: 'row', gap: space[8], marginTop: space[20] },
  appCell: { flex: 1, paddingBottom: elevation.offsetY },
  appShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: elevation.offsetY,
    bottom: 0,
    borderRadius: radius.lg,
    opacity: elevation.opacity,
  },
  appCard: {
    minHeight: 74,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: space[12],
  },
  appName: { flex: 1, fontFamily: fonts.body.bold },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guessHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: space[32],
    marginBottom: space[12],
  },
  section: { ...typography['heading.h3'] },
  goalsTitle: { marginTop: space[24], marginBottom: space[12] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[8] },
});
