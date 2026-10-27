import ThumbwellCore from 'thumbwell-core';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Screen, ScreenGroup, Text } from '@/components/ui';
import { useCountingStatus, useInterval } from '@/detection';
import { afterAccessibility } from '@/lock/overlayPermission';
import { useT } from '@/i18n';
import { useAppStore } from '@/state/appStore';
import { openAppInfo } from '@/system/settings';

import { OverlayPermissionStep } from './OverlayPermissionStep';
import { radius, space, useTheme } from '@/theme';

/** Android 13 (API 33) and newer block Accessibility for apps installed outside the store. */
const RESTRICTED_SETTINGS_API = 33;

/** The little Accessibility panel from Figma S07 (a picture, hidden from screen readers). */
function PanelIllustration() {
  const t = useT();
  const { colors } = useTheme();
  const rows = [
    t('guide.rowInstalled'),
    t('guide.rowTalkback'),
    t('guide.rowThumbwell'),
    t('guide.rowSpeak'),
  ];
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.panel,
        { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault },
      ]}
    >
      <View style={[styles.panelHead, { borderBottomColor: colors.borderDefault }]}>
        <Icon name="back" size={18} color="textMuted" />
        <Text variant="label">{t('guide.panelTitle')}</Text>
      </View>
      {rows.map((row) => {
        const hot = row === t('guide.rowThumbwell');
        return (
          <View
            key={row}
            style={[styles.panelRow, hot && { backgroundColor: colors.bgPrimarySoft }]}
          >
            <Text
              variant="label"
              color={hot ? 'brandAccentText' : 'textSecondary'}
              style={styles.flex}
            >
              {row}
            </Text>
            {hot ? (
              <View style={[styles.switch, { backgroundColor: colors.brandPrimary }]}>
                <View style={[styles.knob, { backgroundColor: colors.brandOnPrimary }]} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * S07 Accessibility guide. Only reachable after consent: without a logged consent it hands back to
 * S06. Opens the system settings, re-checks when the app returns, and shows success or
 * "Still off, try again" (plus the Android 13 "Allow restricted settings" help). After success the
 * "Display over other apps" step follows (skippable), then Home.
 */
export function GuideScreen() {
  const t = useT();
  const { status, refresh } = useCountingStatus();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [opened, setOpened] = useState(false);
  const [returned, setReturned] = useState(false);
  const [help, setHelp] = useState(false);
  const [overlayStep, setOverlayStep] = useState(false);
  const openedRef = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && openedRef.current) void refresh().then(() => setReturned(true));
    });
    return () => sub.remove();
  }, [refresh]);
  // While the user is in Settings, keep looking so success shows the moment they return.
  useInterval(refresh, opened ? 1500 : null);

  if (status !== null && !status.consentLogged) {
    return <Redirect href={{ pathname: '/disclosure', params: { from: 'guide' } }} />;
  }

  const on = status !== null && status.serviceEnabled;
  const stillOff = !on && returned;
  const restricted =
    Platform.OS === 'android' && Number(Platform.Version) >= RESTRICTED_SETTINGS_API;

  const openSettings = () => {
    openedRef.current = true;
    setOpened(true);
    setReturned(false);
    void ThumbwellCore.openAccessibilitySettings();
  };
  const toHome = () => router.replace('/(tabs)');
  // Onboarding is done once Accessibility is on. The overlay permission step follows unless it is
  // already granted; skipping it is fine (the lock uses a fallback window).
  const next = async () => {
    completeOnboarding();
    let granted = false;
    try {
      granted = await ThumbwellCore.canDrawOverlays();
    } catch {
      granted = false;
    }
    if (afterAccessibility(granted) === 'home') toHome();
    else setOverlayStep(true);
  };

  if (overlayStep) return <OverlayPermissionStep onDone={toHome} />;

  if (on) {
    return (
      <Screen spread testID="guide-success">
        <ScreenGroup>
          <Text variant="h1" accessibilityRole="header" accessibilityLiveRegion="polite">
            {t('guide.successTitle')}
          </Text>
          <Text variant="body" color="textSecondary">
            {t('guide.successBody')}
          </Text>
        </ScreenGroup>
        <ScreenGroup>
          <Button label={t('guide.next')} onPress={() => void next()} />
        </ScreenGroup>
      </Screen>
    );
  }

  return (
    <Screen spread testID="guide">
      <ScreenGroup>
        <Text variant="h1" accessibilityRole="header">
          {t('guide.title')}
        </Text>
        <Text variant="caption" color="textMuted">
          {t('guide.path')}
        </Text>
        <PanelIllustration />
        {stillOff ? (
          <Card tone="notice">
            <Text variant="label" accessibilityLiveRegion="polite">
              {t('guide.stillOff')}
            </Text>
            <Text variant="body" color="textSecondary">
              {t('guide.stillOffBody')}
            </Text>
          </Card>
        ) : (
          <Card tone="notice">
            <Text variant="label">{t('guide.headsUpTitle')}</Text>
            <Text variant="body" color="textSecondary">
              {t('guide.headsUp')}
            </Text>
          </Card>
        )}
        {(help || stillOff) && restricted ? (
          <Card tone="tint">
            <Text variant="label">{t('guide.restrictedTitle')}</Text>
            <Text variant="body" color="textSecondary">
              {t('guide.restrictedBody')}
            </Text>
            <View style={styles.cardAction}>
              <Button
                kind="secondary"
                size="sm"
                label={t('guide.openAppInfo')}
                onPress={() => void openAppInfo()}
              />
            </View>
          </Card>
        ) : null}
        {help ? (
          <Card>
            <Text variant="label">{t('guide.helpTitle')}</Text>
            <Text variant="body" color="textSecondary">
              {t('guide.helpBody')}
            </Text>
          </Card>
        ) : null}
      </ScreenGroup>
      <ScreenGroup>
        <Button label={t('guide.open')} onPress={openSettings} />
        <View style={styles.center}>
          <Button
            kind="ghost"
            size="sm"
            label={t('guide.help')}
            onPress={() => setHelp((v) => !v)}
          />
        </View>
      </ScreenGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  cardAction: { marginTop: space[8], alignItems: 'flex-start' },
  panel: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    paddingHorizontal: space[16],
    paddingVertical: space[12],
    borderBottomWidth: 1,
  },
  panelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[16],
    height: 44,
  },
  switch: { width: 40, height: 24, borderRadius: 12, padding: 2, alignItems: 'flex-end' },
  knob: { width: 20, height: 20, borderRadius: 10 },
});
