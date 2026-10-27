import ThumbwellCore from 'thumbwell-core';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet } from 'react-native';

import { Dialog, ListGroup, ListRow, Screen, Text, TopBar } from '@/components/ui';
import { appConfig } from '@/config/appConfig';
import { resetAppIconCache, useCountingStatus, useDailyLimit, useDayStart } from '@/detection';
import { useT } from '@/i18n';
import { DEFAULT_LIMIT } from '@/limit/limitRule';
import { DEFAULT_DAY_START_MINUTES, formatDayStart } from '@/lock/lockTime';
import { useAppStore } from '@/state/appStore';
import { getStorage } from '@/storage';
import { buildFeedbackMailto } from '@/support/feedback';
import { space } from '@/theme';

import { DayStartDialog, LimitDialog } from './settings/dialogs';

type Editing = 'limit' | 'dayStart' | 'delete' | null;

/** S43-P0 Settings: limit, counting status, day start, privacy, feedback, about, delete data. */
export function SettingsScreen() {
  const t = useT();
  const { status, refresh: refreshStatus } = useCountingStatus();
  const { limit, refresh: refreshLimit } = useDailyLimit();
  const { minutes, refresh: refreshDayStart } = useDayStart();
  const resetApp = useAppStore((s) => s.resetApp);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshStatus();
      void refreshLimit();
      void refreshDayStart();
    }, [refreshStatus, refreshLimit, refreshDayStart]),
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
      setEditing(null);
      router.replace('/');
    } catch {
      setDeleteFailed(true);
    }
  };

  const paused = status?.paused === true;
  const countingValue =
    status === null ? '' : paused ? t('settings.countingPaused') : t('settings.countingOn');

  return (
    <Screen testID="settings" edges={['top']} header={<TopBar title={t('settings.title')} />}>
      <ListGroup>
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
          onPress={() => limit && setEditing('limit')}
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
          icon="clock"
          title={t('settings.dayStart')}
          value={formatDayStart(dayStart)}
          onPress={() => setEditing('dayStart')}
        />
        <ListRow
          testID="row-disclosure"
          icon="shield"
          title={t('settings.disclosure')}
          trailing="chevron"
          onPress={() => router.push({ pathname: '/disclosure', params: { from: 'settings' } })}
        />
      </ListGroup>
      <ListGroup>
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
          testID="row-delete"
          icon="trash"
          title={t('settings.delete')}
          danger
          onPress={() => setEditing('delete')}
        />
        <ListRow
          testID="row-version"
          title={t('settings.version')}
          value={`${version} (${build})`}
        />
      </ListGroup>
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

      {editing === 'limit' && limit ? (
        <LimitDialog
          limit={limit}
          dayStartMinutes={dayStart}
          onClose={() => setEditing(null)}
          onSaved={() => void refreshLimit()}
        />
      ) : null}
      {editing === 'dayStart' ? (
        <DayStartDialog
          minutes={dayStart}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void refreshDayStart();
            void refreshLimit();
          }}
        />
      ) : null}
      <Dialog
        visible={editing === 'delete'}
        onDismiss={() => setEditing(null)}
        title={t('settings.deleteDialog.title')}
        body={deleteFailed ? t('settings.deleteDialog.error') : t('settings.deleteDialog.body')}
        actions={[
          { label: t('settings.deleteDialog.confirm'), onPress: deleteData, kind: 'danger' },
          { label: t('common.cancel'), onPress: () => setEditing(null), kind: 'text' },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  disclaimer: { textAlign: 'center', paddingHorizontal: space[8] },
});
