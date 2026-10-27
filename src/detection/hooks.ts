import ThumbwellCore, {
  type BadgeSettings,
  type CountingStatus,
  type DailyLimit,
  type DayCounts,
} from 'thumbwell-core';
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

/** Calls `fn` every `ms` while mounted; `null` switches it off. For cheap native reads. */
export function useInterval(fn: () => unknown, ms: number | null) {
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => void fn(), ms);
    return () => clearInterval(id);
  }, [fn, ms]);
}

/**
 * Today's per-app reel counts. Read on mount and when the app comes back to the
 * foreground, and pushed by the native `onCountChange` event in between.
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

/** The daily limit (`effective` and any `pending` raise). `null` until the first read. */
export function useDailyLimit(): { limit: DailyLimit | null; refresh: () => Promise<void> } {
  const [limit, setLimit] = useState<DailyLimit | null>(null);
  const { read } = useLatest(setLimit);
  const refresh = useCallback(() => read(() => ThumbwellCore.getDailyLimit()), [read]);
  useOnMountAndForeground(refresh);
  return { limit, refresh };
}

/** The floating badge switches (S43-P0). `null` until the first read; `update` saves a change. */
export function useBadgeSettings(): {
  settings: BadgeSettings | null;
  refresh: () => Promise<void>;
  update: (patch: Partial<BadgeSettings>) => Promise<void>;
} {
  const [settings, setSettings] = useState<BadgeSettings | null>(null);
  const { read } = useLatest(setSettings);
  const refresh = useCallback(() => read(() => ThumbwellCore.getBadgeSettings()), [read]);
  const update = useCallback(
    async (patch: Partial<BadgeSettings>) => {
      setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
      try {
        setSettings(await ThumbwellCore.setBadgeSettings(patch));
      } catch {
        await refresh();
      }
    },
    [refresh],
  );
  useOnMountAndForeground(refresh);
  return { settings, refresh, update };
}

/** Minutes after midnight at which the logical day starts. `null` until the first read. */
export function useDayStart(): { minutes: number | null; refresh: () => Promise<void> } {
  const [minutes, setMinutes] = useState<number | null>(null);
  const { read } = useLatest(setMinutes);
  const refresh = useCallback(() => read(() => ThumbwellCore.getDayStartMinutes()), [read]);
  useOnMountAndForeground(refresh);
  return { minutes, refresh };
}

const iconCache = new Map<string, string | null>();

/** Forgets the loaded launcher icons (tests, and after the user deletes their data). */
export function resetAppIconCache() {
  iconCache.clear();
}

/**
 * The launcher icon of the first installed package, as a base64 PNG, loaded at runtime from the
 * installed app (never bundled). `undefined` while loading, `null` when none is installed.
 */
export function useAppIcon(packages: readonly string[]): string | null | undefined {
  const cacheKey = packages.join('|');
  const [icon, setIcon] = useState<string | null | undefined>(iconCache.get(cacheKey));
  useEffect(() => {
    if (iconCache.has(cacheKey)) return;
    let live = true;
    void (async () => {
      let found: string | null = null;
      for (const pkg of cacheKey.split('|')) {
        try {
          found = await ThumbwellCore.getAppIcon(pkg);
        } catch {
          found = null;
        }
        if (found) break;
      }
      if (found) iconCache.set(cacheKey, found);
      if (live) setIcon(found);
    })();
    return () => {
      live = false;
    };
  }, [cacheKey]);
  return icon;
}
