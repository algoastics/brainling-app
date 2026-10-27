import ThumbwellCore from 'thumbwell-core';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Screen, ScreenGroup, Text } from '@/components/ui';
import { useInterval, useOverlayPermission } from '@/detection';
import { useT } from '@/i18n';
import { radius, useTheme } from '@/theme';

/**
 * Onboarding step after Accessibility: "Display over other apps". Explains it, opens the system
 * page for Thumbwell, re-checks when the user comes back, and can be skipped (the lock then uses
 * a fallback window and notifications may be hidden while it is up). `onDone` leaves the step.
 */
export function OverlayPermissionStep({ onDone }: { onDone: () => void }) {
  const t = useT();
  const { colors } = useTheme();
  const { granted, refresh } = useOverlayPermission();
  const [opened, setOpened] = useState(false);
  const [returned, setReturned] = useState(false);
  const openedRef = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && openedRef.current) void refresh().then(() => setReturned(true));
    });
    return () => sub.remove();
  }, [refresh]);
  // While the user is on the system page, keep looking so success shows the moment they return.
  useInterval(refresh, opened ? 1500 : null);

  const openSettings = () => {
    openedRef.current = true;
    setOpened(true);
    setReturned(false);
    void ThumbwellCore.openOverlaySettings();
  };

  if (granted === true) {
    return (
      <Screen spread testID="overlay-granted">
        <ScreenGroup>
          <Text variant="h1" accessibilityRole="header" accessibilityLiveRegion="polite">
            {t('overlay.doneTitle')}
          </Text>
          <Text variant="body" color="textSecondary">
            {t('overlay.doneBody')}
          </Text>
        </ScreenGroup>
        <ScreenGroup>
          <Button label={t('overlay.continue')} onPress={onDone} />
        </ScreenGroup>
      </Screen>
    );
  }

  const stillOff = returned && granted === false;
  return (
    <Screen spread testID="overlay-permission">
      <ScreenGroup>
        <View style={[styles.tile, { backgroundColor: colors.bgPrimarySoft }]}>
          <Icon name="bell" size={24} color="brandAccentText" />
        </View>
        <Text variant="h1" accessibilityRole="header">
          {t('overlay.title')}
        </Text>
        <Text variant="body" color="textSecondary">
          {t('overlay.body')}
        </Text>
        <Text variant="caption" color="textMuted">
          {t('overlay.path')}
        </Text>
        {stillOff ? (
          <View testID="overlay-still-off">
            <Card tone="notice">
              <Text variant="label" accessibilityLiveRegion="polite">
                {t('overlay.stillOff')}
              </Text>
              <Text variant="body" color="textSecondary">
                {t('overlay.stillOffBody')}
              </Text>
            </Card>
          </View>
        ) : null}
        <Card tone="tint">
          <Text variant="label">{t('overlay.whyTitle')}</Text>
          <Text variant="body" color="textSecondary">
            {t('overlay.why')}
          </Text>
        </Card>
        <Card>
          <Text variant="label">{t('overlay.skipTitle')}</Text>
          <Text variant="body" color="textSecondary">
            {t('overlay.skipBody')}
          </Text>
        </Card>
      </ScreenGroup>
      <ScreenGroup>
        <Button label={t('overlay.allow')} onPress={openSettings} />
        <Button kind="ghost" label={t('overlay.skip')} onPress={onDone} />
      </ScreenGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
