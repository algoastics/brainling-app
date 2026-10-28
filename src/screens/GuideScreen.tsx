import ThumbwellCore from 'thumbwell-core';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';

import { Button, Card, Icon, Screen, ScreenGroup, Text } from '@/components/ui';
import { useCountingStatus, useInterval } from '@/detection';
import { afterAccessibility } from '@/lock/overlayPermission';
import { useT } from '@/i18n';
import { useReducedMotion } from '@/motion';
import { useOverlayStage } from '@/onboarding/overlayStage';
import { useAppStore } from '@/state/appStore';
import { openAppInfo } from '@/system/settings';

import { OverlayPermissionStep } from './OverlayPermissionStep';
import { motion, radius, sizes, space, useTheme } from '@/theme';

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
      <View style={styles.panelHead}>
        <Icon name="back" size={20} color="textMuted" />
        <Text variant="label">{t('guide.panelTitle')}</Text>
      </View>
      {rows.map((row, i) => {
        const hot = row === t('guide.rowThumbwell');
        return (
          <View
            key={row}
            style={[
              styles.panelRow,
              { borderBottomColor: colors.borderDefault },
              i < rows.length - 1 && styles.panelRowDivider,
              hot && { backgroundColor: colors.bgPrimarySoft },
            ]}
          >
            {hot ? (
              <View style={[styles.rowTile, { backgroundColor: colors.bgPrimarySoft }]}>
                <Icon name="accessibility" size={24} color="brandAccentText" />
              </View>
            ) : null}
            <Text variant="body" style={styles.flex}>
              {row}
            </Text>
            {hot ? (
              <View style={[styles.switch, { backgroundColor: colors.brandPrimary }]}>
                <View style={[styles.knob, { backgroundColor: colors.brandOnPrimary }]} />
              </View>
            ) : (
              <Icon name="chevron" size={24} color="textMuted" />
            )}
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
  const reduced = useReducedMotion();
  const setOverlayStage = useOverlayStage((s) => s.set);

  // The onboarding header (a layout above this screen) shows step 4 while the stage is up.
  useEffect(() => {
    setOverlayStage(overlayStep);
    return () => setOverlayStage(false);
  }, [overlayStep, setOverlayStage]);

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

  if (overlayStep) {
    return (
      <Animated.View
        style={styles.flex}
        entering={reduced ? undefined : SlideInRight.duration(motion.duration.base)}
      >
        <OverlayPermissionStep onDone={toHome} />
      </Animated.View>
    );
  }

  if (on) {
    return (
      <Screen spread edges={['bottom']} testID="guide-success">
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
    <Screen spread edges={['bottom']} testID="guide">
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
            <Text variant="h3" accessibilityLiveRegion="polite">
              {t('guide.stillOff')}
            </Text>
            <Text variant="body" color="textSecondary">
              {t('guide.stillOffBody')}
            </Text>
          </Card>
        ) : (
          <Card tone="notice">
            <Text variant="h3">{t('guide.headsUpTitle')}</Text>
            <Text variant="body" color="textSecondary">
              {t('guide.headsUp')}
            </Text>
          </Card>
        )}
        {(help || stillOff) && restricted ? (
          <Card tone="tint">
            <Text variant="h3">{t('guide.restrictedTitle')}</Text>
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
            <Text variant="h3">{t('guide.helpTitle')}</Text>
            <Text variant="body" color="textSecondary">
              {t('guide.helpBody')}
            </Text>
          </Card>
        ) : null}
      </ScreenGroup>
      <ScreenGroup gap={space[8]}>
        <Button label={t('guide.open')} onPress={openSettings} />
        <Button kind="ghost" size="sm" label={t('guide.help')} onPress={() => setHelp((v) => !v)} />
      </ScreenGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cardAction: { marginTop: space[8], alignItems: 'flex-start' },
  panel: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    paddingHorizontal: space[16],
    paddingTop: space[12],
    paddingBottom: space[8],
  },
  panelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[16],
    paddingHorizontal: space[16],
    paddingVertical: space[8],
  },
  panelRowDivider: { borderBottomWidth: 1 },
  rowTile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switch: {
    width: sizes.switchWidth,
    height: sizes.switchHeight,
    borderRadius: radius.pill,
    padding: space[4],
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  knob: { width: sizes.switchThumb, height: sizes.switchThumb, borderRadius: radius.pill },
});
