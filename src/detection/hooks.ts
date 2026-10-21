import BrainlingCore, { type DayCounts } from 'brainling-core';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Calls `fn` on mount and whenever the app returns to the foreground. */
function useOnMountAndForeground(fn: () => void) {
  useEffect(() => {
    fn();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') fn();
    });
    return () => sub.remove();
  }, [fn]);
}

/**
 * Today's per-app reel counts. Read on mount and when the app comes back to the
 * foreground, and pushed by the native `onCountChange` event in between. No polling.
 */
export function useTodayCounts(): { counts: DayCounts | null; refresh: () => void } {
  const [counts, setCounts] = useState<DayCounts | null>(null);
  const refresh = useCallback(() => setCounts(BrainlingCore.getTodayCounts()), []);

  useEffect(() => {
    const sub = BrainlingCore.addListener('onCountChange', setCounts);
    return () => sub.remove();
  }, []);
  useOnMountAndForeground(refresh);

  return { counts, refresh };
}

/**
 * Whether the Brainling accessibility service is enabled in system settings. Re-read when
 * the app returns to the foreground (e.g. back from the accessibility settings screen).
 * `null` until the first read.
 */
export function useServiceStatus(): { enabled: boolean | null; refresh: () => void } {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const refresh = useCallback(() => setEnabled(BrainlingCore.isServiceEnabled()), []);
  useOnMountAndForeground(refresh);
  return { enabled, refresh };
}
