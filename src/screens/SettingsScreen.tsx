import ThumbwellCore from 'thumbwell-core';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet } from 'react-native';

import { Dialog, ListGroup, ListRow, ListSection, Screen, Text, TopBar } from '@/components/ui';
import { appConfig } from '@/config/appConfig';
import {
  resetAppIconCache,
  useBadgeSettings,
  useCountingStatus,
  useDailyLimit,
  useDayStart,
  useOverlayPermission,
} from '@/detection';
import { useT } from '@/i18n';
import { DEFAULT_LIMIT } from '@/limit/limitRule';
import { DEFAULT_DAY_START_MINUTES, formatDayStart } from '@/lock/lockTime';
import { useAppStore } from '@/state/appStore';
import { getStorage } from '@/storage';
import { buildFeedbackMailto } from '@/support/feedback';
import { space, useThemePreference } from '@/theme';

import { BadgeTimeSheet, DayStartSheet, LimitSheet, ThemeSheet } from './settings/sheets';

type Editing = 'limit' | 'dayStart' | 'badgeTime' | 'theme' | 'delete' | null;

/** S43-P0 Settings: limit, counting status, day start, privacy, feedback, about, delete data. */
export function SettingsScreen() {
  const t = useT();
  const { status, refresh: refreshStatus } = useCountingStatus();
  const { limit, refresh: refreshLimit } = useDailyLimit();
  const { minutes, refresh: refreshDayStart } = useDayStart();
  const { settings: badge, refresh: refreshBadge, update: updateBadge } = useBadgeSettings();
  const { granted: overlayGranted, refresh: refreshOverlay } = useOverlayPermission();
  const resetApp = useAppStore((s) => s.resetApp);
  const [editing, setEditing] = useState<Editing>(null);
  const [sheetKey, setSheetKey] = useState(0);
  const [deleteFailed, setDeleteFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshStatus();
      void refreshLimit();
      void refreshDayStart();
      void refreshBadge();
      void refreshOverlay();
    }, [refreshStatus, refreshLimit, refreshDayStart, refreshBadge, refreshOverlay]),
  );

  const dayStart = minutes ?? DEFAULT_DAY_START_MINUTES;
  const version = Application.nativeApplicationVersion ?? '1.0.0';
  const build = Application.nativeBuildVersion ?? '1';

  const openPrivacy = () => void Linking.openURL(appConfig.privacyPolicyUrl).catch(() => undefined);
  const sendFeedback = () =>
    void Linking.openURL(
      buildFeedbackMailto({
        email: appConfig.supportEmail,
        subject: t('settings.feedbackSubject'),
        intro: t('settings.feedbackIntro'),
        appVersion: version,
        build,
        device: [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || 'unknown',
        os: Device.osVersion ?? 'unknown',
      }),
    ).catch(() => undefined);

  const deleteData = async () => {
    setDeleteFailed(false);
    try {
      await ThumbwellCore.clearAllData();
      getStorage().clearAll();
      resetAppIconCache();
      resetApp();
      close();
      router.replace('/');
    } catch {
      setDeleteFailed(true);
    }
  };

  const paused = status?.paused === true;
  const countingValue =
    status === null ? '' : paused ? t('settings.countingPaused') : t('settings.countingOn');

  const themePreference = useThemePreference((st) => st.preference);

  const open = (sheet: Exclude<Editing, null>) => {
    setSheetKey((k) => k + 1);
    setEditing(sheet);
  };
  const close = () => setEditing(null);

  return (
    <Screen testID="settings" edges={['top']} header={<TopBar title={t('settings.title')} />}>
      <ListSection title={t('settings.sections.counting')} footer={t('settings.footers.counting')}>
        <ListRow
          testID="row-limit"
          icon="lock"
          title={t('settings.limit')}
          subtitle={
            limit?.pending != null
              ? t('settings.limitPending', { count: limit.pending })
              : undefined
          }
          value={t('settings.limitValue', { count: limit?.effective ?? DEFAULT_LIMIT })}
          onPress={() => limit && open('limit')}
        />
        <ListRow
          testID="row-counting"
          icon="accessibility"
          title={t('settings.counting')}
          subtitle={
            paused ? t(`home.paused.${status?.pausedReason ?? 'service_disabled'}`) : undefined
          }
          value={countingValue}
          onPress={
            paused
              ? () => router.push({ pathname: '/disclosure', params: { from: 'settings' } })
              : undefined
          }
          trailing={paused ? 'chevron' : undefined}
        />
        <ListRow
          testID="row-day-start"
          icon="moon"
          title={t('settings.dayStart')}
          value={formatDayStart(dayStart)}
          onPress={() => open('dayStart')}
        />
        <ListRow
          testID="row-disclosure"
          icon="shield"
          title={t('settings.disclosure')}
          trailing="chevron"
          onPress={() => router.push({ pathname: '/disclosure', params: { from: 'settings' } })}
        />
        <ListRow
          testID="row-overlay"
          icon="lock"
          title={t('settings.overlay.title')}
          subtitle={overlayGranted === false ? t('settings.overlay.offHelp') : undefined}
          value={overlayGranted === true ? t('settings.overlay.on') : undefined}
          trailing="chevron"
          onPress={() => router.push('/overlay')}
        />
      </ListSection>
      {badge ? (
        <ListSection title={t('settings.sections.badge')} footer={t('settings.footers.badge')}>
          <ListRow
            testID="row-badge"
            icon="badge"
            title={t('settings.badge.floating')}
            subtitle={t('settings.badge.floatingHelp')}
            switchValue={badge.enabled}
            onSwitchChange={(enabled) => void updateBadge({ enabled })}
          />
          <ListRow
            testID="row-badge-time"
            icon="timer"
            title={t('settings.badge.time')}
            value={t(`settings.badge.timeValue_${badge.displayTime}`)}
            onPress={() => open('badgeTime')}
          />
          <ListRow
            testID="row-badge-hide"
            icon="eyeOff"
            title={t('settings.badge.hide')}
            subtitle={t('settings.badge.hideHelp')}
            switchValue={badge.hideWhenResting}
            switchDisabled={badge.displayTime === 'always'}
            onSwitchChange={(hideWhenResting) => void updateBadge({ hideWhenResting })}
          />
        </ListSection>
      ) : null}
      <ListSection
        title={t('settings.sections.appearance')}
        footer={t('settings.footers.appearance')}
      >
        <ListRow
          testID="row-theme"
          icon="contrast"
          title={t('settings.theme.title')}
          value={t(`settings.theme.${themePreference}`)}
          onPress={() => open('theme')}
        />
      </ListSection>
      <ListSection title={t('settings.sections.about')}>
        <ListRow
          testID="row-privacy"
          icon="info"
          title={t('settings.privacy')}
          trailing="external"
          onPress={openPrivacy}
        />
        <ListRow
          testID="row-feedback"
          icon="sparkles"
          title={t('settings.feedback')}
          trailing="chevron"
          onPress={sendFeedback}
        />
        <ListRow
          testID="row-about"
          icon="info"
          title={t('settings.about')}
          trailing="chevron"
          onPress={() => router.push('/about')}
        />
        <ListRow
          testID="row-version"
          title={t('settings.version')}
          value={`${version} (${build})`}
        />
      </ListSection>
      <ListSection title={t('settings.sections.data')} footer={t('settings.footers.data')}>
        <ListRow
          testID="row-delete"
          icon="trash"
          title={t('settings.delete')}
          danger
          onPress={() => open('delete')}
        />
      </ListSection>
      {__DEV__ ? (
        <ListGroup>
          <ListRow
            testID="row-lock-preview"
            title={t('settings.dev.lockPreview')}
            trailing="chevron"
            onPress={() => router.push('/lock-preview')}
          />
          <ListRow
            testID="row-debug"
            title={t('settings.dev.debug')}
            trailing="chevron"
            onPress={() => router.push('/detection-debug')}
          />
        </ListGroup>
      ) : null}
      <Text variant="caption" color="textMuted" style={styles.disclaimer} testID="disclaimer">
        {t('settings.disclaimer')}
      </Text>

      {limit ? (
        <LimitSheet
          key={`limit-${sheetKey}`}
          visible={editing === 'limit'}
          limit={limit}
          dayStartMinutes={dayStart}
          onClose={close}
          onSaved={() => void refreshLimit()}
        />
      ) : null}
      <DayStartSheet
        key={`day-${sheetKey}`}
        visible={editing === 'dayStart'}
        minutes={dayStart}
        onClose={close}
        onSaved={() => {
          void refreshDayStart();
          void refreshLimit();
        }}
      />
      {badge ? (
        <BadgeTimeSheet
          key={`badge-${sheetKey}`}
          visible={editing === 'badgeTime'}
          value={badge.displayTime}
          onSave={async (displayTime) => {
            await ThumbwellCore.setBadgeSettings({ displayTime });
            await refreshBadge();
          }}
          onClose={close}
        />
      ) : null}
      <ThemeSheet visible={editing === 'theme'} onClose={close} />
      <Dialog
        visible={editing === 'delete'}
        onDismiss={close}
        title={t('settings.deleteDialog.title')}
        body={deleteFailed ? t('settings.deleteDialog.error') : t('settings.deleteDialog.body')}
        actions={[
          { label: t('settings.deleteDialog.confirm'), onPress: deleteData, kind: 'danger' },
          { label: t('common.cancel'), onPress: close, kind: 'text' },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  disclaimer: { textAlign: 'center', paddingHorizontal: space[8] },
});
