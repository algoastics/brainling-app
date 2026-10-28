import ThumbwellCore from 'thumbwell-core';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useInterval, useOverlayPermission } from '@/detection';
import { haptics } from '@/motion';

import { OverlayPermissionView, type OverlayViewState } from './overlay/OverlayPermissionView';

/**
 * Onboarding step 4 of 4, "Display over other apps" (Figma S11-P0). Asks, opens the system page
 * for Thumbwell, re-checks when the user comes back and shows granted (Thumb happy) or not granted
 * (Thumb meh). Skippable at every state: the lock then uses the fallback overlay. `onDone` leaves
 * the step.
 */
export function OverlayPermissionStep({ onDone }: { onDone: () => void }) {
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
  useEffect(() => {
    if (granted === true && openedRef.current) haptics.success();
  }, [granted]);

  const openSettings = () => {
    openedRef.current = true;
    setOpened(true);
    setReturned(false);
    void ThumbwellCore.openOverlaySettings();
  };
  // "Try again" re-runs the check first: if it was switched on meanwhile, show that; otherwise ask again.
  const tryAgain = async () => {
    let ok = false;
    try {
      ok = await ThumbwellCore.canDrawOverlays();
    } catch {
      ok = false;
    }
    if (ok) await refresh();
    else openSettings();
  };

  const state: OverlayViewState =
    granted === true ? 'granted' : returned && granted === false ? 'notGranted' : 'ask';
  return (
    <OverlayPermissionView
      variant="onboarding"
      state={state}
      onPrimary={
        state === 'ask' ? openSettings : state === 'granted' ? onDone : () => void tryAgain()
      }
      onSecondary={state === 'granted' ? openSettings : onDone}
    />
  );
}
