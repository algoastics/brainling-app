import ThumbwellCore, { type CountingStatus, type DayCounts } from 'thumbwell-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/** Calls `fn` on mount and whenever the app returns to the foreground. */
function useOnMountAndForeground(fn: () => unknown) {
  useEffect(() => {
    void fn();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void fn();
    });
    return () => sub.remove();
  }, [fn]);
}

/**
 * Applies async native reads in order: a result is dropped if the component unmounted or a newer
 * read or pushed value arrived while it was in flight.
 */
function useLatest<T>(set: (value: T) => void) {
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const read = useCallback(
    async (load: () => Promise<T>) => {
      const mine = ++generation.current;
      const value = await load();
      if (mounted.current && mine === generation.current) set(value);
    },
    [set],
  );
  const push = useCallback(
    (value: T) => {
      generation.current++;
      if (mounted.current) set(value);
    },
    [set],
  );
  return { read, push };
}

/**
 * Today's per-app reel counts. Read on mount and when the app comes back to the
 * foreground, and pushed by the native `onCountChange` event in between. No polling.
 */
export function useTodayCounts(): { counts: DayCounts | null; refresh: () => Promise<void> } {
  const [counts, setCounts] = useState<DayCounts | null>(null);
  const { read, push } = useLatest(setCounts);
  const refresh = useCallback(() => read(() => ThumbwellCore.getTodayCounts()), [read]);

  useEffect(() => {
    const sub = ThumbwellCore.addListener('onCountChange', push);
    return () => sub.remove();
  }, [push]);
  useOnMountAndForeground(refresh);

  return { counts, refresh };
}

/**
 * Whether the Thumbwell accessibility service is enabled in system settings. Re-read when
 * the app returns to the foreground (e.g. back from the accessibility settings screen).
 * `null` until the first read.
 */
export function useServiceStatus(): { enabled: boolean | null; refresh: () => Promise<void> } {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const { read } = useLatest(setEnabled);
  const refresh = useCallback(() => read(() => ThumbwellCore.isServiceEnabled()), [read]);
  useOnMountAndForeground(refresh);
  return { enabled, refresh };
}

/**
 * Counting status for the "counting paused" state: service on, consent logged for the current
 * disclosure version, per-app enabled. Re-read on mount and when the app returns to the foreground.
 * `null` until the first read.
 */
export function useCountingStatus(): {
  status: CountingStatus | null;
  refresh: () => Promise<void>;
} {
  const [status, setStatus] = useState<CountingStatus | null>(null);
  const { read } = useLatest(setStatus);
  const refresh = useCallback(() => read(() => ThumbwellCore.getCountingStatus()), [read]);
  useOnMountAndForeground(refresh);
  return { status, refresh };
}
