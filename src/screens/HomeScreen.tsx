import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { AppRow } from '@/components/AppRow';
import { AliveThumb } from '@/components/mascot';
import { Banner, OdometerNumber, ProgressRing, Screen, Text, TopBar } from '@/components/ui';
import { SUPPORTED_APPS, countFor, type SupportedApp } from '@/apps/supportedApps';
import {
  useAppIcon,
  useCountingStatus,
  useDailyLimit,
  useInterval,
  useTodayCounts,
} from '@/detection';
import { useT } from '@/i18n';
import { DEFAULT_LIMIT } from '@/limit/limitRule';
import { space, useTheme } from '@/theme';

/** How often Home re-reads the native counter, status and limit while it is on screen. */
export const HOME_REFRESH_MS = 5000;

function HomeAppRow({ app, count }: { app: SupportedApp; count: number }) {
  const t = useT();
  const icon = useAppIcon(app.packages);
  return (
    <AppRow
      testID={`app-${app.key}`}
      name={t(`home.apps.${app.key}.name`)}
      detail={icon === null ? t('home.notInstalled') : t(`home.apps.${app.key}.unit`)}
      count={count}
      icon={icon}
    />
  );
}

/**
 * Phase 0 Home keeps the happy Thumb and lets it breathe and blink (A59). Count-based health
 * bands stay Phase 1 (see `thumbState.ts`).
 */
export const HOME_THUMB_POSE = 'happy' as const;

/** Soft violet glow behind the ring (Figma "Hero glow": 190 dp circle, 20% violet, blur 48). */
function HeroGlow({ color }: { color: string }) {
  return (
    <View style={styles.glow} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <Svg width={236} height={236} viewBox="0 0 236 236">
        <Defs>
          <RadialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0.55" stopColor={color} stopOpacity={0.2} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={118} cy={118} r={118} fill="url(#heroGlow)" />
      </Svg>
    </View>
  );
}

/** S14-P0 Home: total vs limit, Thumb, per-app counts and the counting-paused banner. */
export function HomeScreen() {
  const t = useT();
  const { colors } = useTheme();
  const { counts, refresh: refreshCounts } = useTodayCounts();
  const { status, refresh: refreshStatus } = useCountingStatus();
  const { limit, refresh: refreshLimit } = useDailyLimit();
  const [refreshing, setRefreshing] = useState(false);

  const refreshAll = useCallback(
    () => Promise.all([refreshCounts(), refreshStatus(), refreshLimit()]).then(() => undefined),
    [refreshCounts, refreshStatus, refreshLimit],
  );
  useFocusEffect(
    useCallback(() => {
      void refreshAll();
    }, [refreshAll]),
  );
  useInterval(refreshAll, HOME_REFRESH_MS);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAll]);

  const total = counts?.total ?? 0;
  const budget = limit?.effective ?? DEFAULT_LIMIT;
  const remaining = budget - total;
  const ratio = budget > 0 ? total / budget : 1;
  const tone = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'brand';
  const summary =
    total === 0
      ? t('home.none')
      : remaining >= 0
        ? t('home.left', { count: remaining })
        : t('home.over', { count: -remaining });

  return (
    <Screen
      testID="home"
      edges={['top']}
      header={<TopBar title={t('home.title')} />}
      onRefresh={onRefresh}
      refreshing={refreshing}
    >
      {status?.paused ? (
        <Banner
          testID="paused-banner"
          tone="warn"
          title={t('home.pausedTitle')}
          body={t(`home.paused.${status.pausedReason ?? 'service_disabled'}`)}
          actions={[
            {
              label: t('home.turnOn'),
              kind: 'primary',
              onPress: () => router.push({ pathname: '/disclosure', params: { from: 'home' } }),
            },
          ]}
        />
      ) : null}
      <View style={styles.hero}>
        <View>
          <HeroGlow color={colors.brandPrimary} />
          <ProgressRing value={ratio} tone={tone}>
            <OdometerNumber
              testID="total-count"
              value={total}
              size="counterL"
              label={t('home.ofLimit', { count: budget })}
            />
          </ProgressRing>
        </View>
        <AliveThumb pose={HOME_THUMB_POSE} width={144} />
      </View>
      <View style={styles.summaryRow}>
        <Text variant="caption" color="textMuted" testID="summary">
          {summary}
        </Text>
        {status && !status.paused ? (
          <View style={styles.status}>
            <View style={[styles.dot, { backgroundColor: colors.statusGood }]} />
            <Text variant="caption" color="textMuted">
              {t('home.countingOn')}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.apps}>
        {SUPPORTED_APPS.map((app) => (
          <HomeAppRow key={app.key} app={app} count={countFor(counts, app)} />
        ))}
      </View>
      <Text variant="caption" color="textMuted" style={styles.note}>
        {t('home.iconNote')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 176,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[16],
  },
  glow: { position: 'absolute', left: -34, top: -34 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  apps: { gap: space[8] },
  note: { textAlign: 'center' },
});
