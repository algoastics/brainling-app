import ThumbwellCore from 'thumbwell-core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppRow } from '@/components/AppRow';
import { Thumb } from '@/components/mascot';
import { Banner, ProgressBar, Screen, Text, TopBar } from '@/components/ui';
import { SUPPORTED_APPS, countFor, type SupportedApp } from '@/apps/supportedApps';
import {
  useAppIcon,
  useCountingStatus,
  useDailyLimit,
  useInterval,
  useOverlayPermission,
  useTodayCounts,
} from '@/detection';
import { useT } from '@/i18n';
import { DEFAULT_LIMIT } from '@/limit/limitRule';
import { overlayNoticeVisible } from '@/lock/overlayPermission';
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
 * Phase 0 shows ONE fixed Thumb, the "Thumb happy" instance drawn in the Figma S14-P0 frames
 * (light and dark). The count-based health bands are Phase 1 (see `thumbState.ts`).
 */
export const HOME_THUMB_POSE = 'happy' as const;

/** S14-P0 Home: total vs limit, Thumb, per-app counts and the counting-paused banner. */
export function HomeScreen() {
  const t = useT();
  const { colors } = useTheme();
  const { counts, refresh: refreshCounts } = useTodayCounts();
  const { status, refresh: refreshStatus } = useCountingStatus();
  const { limit, refresh: refreshLimit } = useDailyLimit();
  const { granted: overlayGranted, refresh: refreshOverlay } = useOverlayPermission();
  const [refreshing, setRefreshing] = useState(false);

  const refreshAll = useCallback(
    () =>
      Promise.all([refreshCounts(), refreshStatus(), refreshLimit(), refreshOverlay()]).then(
        () => undefined,
      ),
    [refreshCounts, refreshStatus, refreshLimit, refreshOverlay],
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
      {overlayNoticeVisible(overlayGranted) ? (
        <Banner
          testID="overlay-notice"
          tone="info"
          title={t('home.overlayNoticeTitle')}
          body={t('home.overlayNotice')}
          actions={[
            {
              label: t('home.overlayNoticeAction'),
              kind: 'secondary',
              onPress: () => void ThumbwellCore.openOverlaySettings(),
            },
          ]}
        />
      ) : null}
      <View style={styles.hero}>
        <Thumb pose={HOME_THUMB_POSE} width={156} />
        <View style={styles.count}>
          <Text
            variant="counterXl"
            testID="total-count"
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={t('home.progress', { count: total, limit: budget })}
          >
            {String(total)}
          </Text>
          <Text variant="body" color="textSecondary">
            {t('home.ofLimit', { count: budget })}
          </Text>
        </View>
      </View>
      <ProgressBar
        value={ratio}
        tone={tone}
        accessibilityLabel={t('home.progress', { count: total, limit: budget })}
      />
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
  hero: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  count: { flex: 1, alignItems: 'flex-start' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  apps: { gap: space[12] },
  note: { textAlign: 'center' },
});
