import type { DayCounts } from 'thumbwell-core';

/** An app Thumbwell counts in Phase 0. Rows follow the rule keys the native side reports. */
export type SupportedApp = {
  /** The key in `DayCounts.apps`. */
  key: 'instagram' | 'youtube' | 'tiktok';
  /** Launcher packages to ask for an icon, first installed one wins. */
  packages: readonly string[];
};

/** Instagram, YouTube and TikTok only (Phase 0). Facebook and Snapchat stay off. */
export const SUPPORTED_APPS: readonly SupportedApp[] = [
  { key: 'instagram', packages: ['com.instagram.android'] },
  { key: 'youtube', packages: ['com.google.android.youtube'] },
  { key: 'tiktok', packages: ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill'] },
];

/** Today's count for one supported app (0 when the day has none yet). */
export function countFor(counts: DayCounts | null, app: SupportedApp): number {
  return counts?.apps[app.key] ?? 0;
}
