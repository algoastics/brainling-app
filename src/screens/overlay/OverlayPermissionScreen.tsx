import ThumbwellCore from 'thumbwell-core';
import { router } from 'expo-router';

import { Screen, TopBar } from '@/components/ui';
import { useOverlayPermission } from '@/detection';
import { useT } from '@/i18n';

import { OverlayPermissionView } from './OverlayPermissionView';

/**
 * "Display over other apps" opened from the Settings row (Figma S11-P0 "from Settings"). Shows the
 * current state, re-read each time the app is foregrounded, and opens the Android page; there is no
 * ask state here because the user already chose to come.
 */
export function OverlayPermissionScreen() {
  const t = useT();
  const { granted } = useOverlayPermission();
  const back = () => router.back();
  if (granted === null) {
    return (
      <Screen
        testID="overlay-settings"
        header={<TopBar title={t('overlay.settings.screenTitle')} onBack={back} />}
      >
        {null}
      </Screen>
    );
  }
  return (
    <OverlayPermissionView
      variant="settings"
      state={granted ? 'granted' : 'notGranted'}
      onPrimary={() => void ThumbwellCore.openOverlaySettings()}
      onSecondary={granted ? undefined : back}
      onBack={back}
    />
  );
}
