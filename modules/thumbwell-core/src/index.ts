import { NativeModule, requireNativeModule } from 'expo';

/** How long the floating Thumb stays awake after a counted reel before it rests. */
export type BadgeDisplayTime = '1s' | '2s' | '3s' | 'always';

/** Floating Thumb badge settings (S43-P0), stored natively. Defaults: on, '2s', false. */
export type BadgeSettings = {
  /** The "Floating badge" switch. */
  enabled: boolean;
  /** "Badge display time". */
  displayTime: BadgeDisplayTime;
  /** "Hide completely when resting": remove the Thumb between counts instead of tucking it. */
  hideWhenResting: boolean;
};

export type DayCounts = {
  /** Thumbwell day (04:00 to 04:00 local), yyyy-MM-dd. */
  date: string;
  total: number;
  /** Count per app rule key, e.g. `instagram`, `youtube`, `tiktok_lite`. */
  apps: Record<string, number>;
  /**
   * Sponsored reels seen per app today. They are excluded from `apps` and `total`; stored for
   * a later "Ads seen" row and not shown in Phase 0.
   */
  ads: Record<string, number>;
  /** Epoch ms of the 04:00 local day close that ends this day. */
  nextCloseAtMs: number;
  /** IANA time zone the day was computed in. */
  timeZone: string;
};

/** One past (or current) Thumbwell day, from `getDailyCounts`. */
export type DailyCounts = {
  date: string;
  total: number;
  apps: Record<string, number>;
  ads: Record<string, number>;
};

/** Why counting is paused; `null` in `CountingStatus.pausedReason` while it is running. */
export type PausedReason =
  'service_disabled' | 'service_not_running' | 'consent_missing' | 'no_rules';

/** The accessibility disclosure consent kept by the native side. */
export type ConsentRecord = {
  /** Epoch ms the consent was logged. */
  atMs: number;
  /** Disclosure version the user accepted. */
  version: string;
};

/** Everything the UI needs for the "counting paused" state. */
export type CountingStatus = {
  paused: boolean;
  pausedReason: PausedReason | null;
  serviceEnabled: boolean;
  serviceRunning: boolean;
  /** True when consent is logged for `disclosureVersion`. Nothing is counted without it. */
  consentLogged: boolean;
  consent: ConsentRecord | null;
  /** The disclosure version this build requires. */
  disclosureVersion: string;
  /** Per app rule key; `false` for apps switched off in this build (Facebook, Snapchat). */
  apps: Record<string, { enabled: boolean }>;
  /** Minutes after local midnight at which the Thumbwell day starts (default 240 = 04:00). */
  dayStartMinutes: number;
  flags: { facebook: boolean; snapchat: boolean; countBadge: boolean };
};

/**
 * The daily limit (F06). Lowering applies at once; raising applies from the next logical day and
 * shows up as `pending` until then. The very first choice (onboarding) applies at once.
 */
export type DailyLimit = {
  /** The limit in force today. */
  effective: number;
  /** A higher limit waiting for `pendingFromDay`, or null. */
  pending: number | null;
  /** First logical day (yyyy-MM-dd) the pending limit applies, or null. */
  pendingFromDay: string | null;
};

/**
 * The limit lock (F06, S22-P0), computed natively next to the accessibility service. `locked` is
 * true once today's total reaches the effective limit (a limit of 0 is locked from the start) and
 * until the next day start; `lockedUntilMs` is that moment, or null while not locked.
 */
export type LockState = {
  locked: boolean;
  limit: number;
  total: number;
  lockedUntilMs: number | null;
};

export type ServiceState = 'ok' | 'disabled' | 'not_running';

export type HealthStatus = {
  state: ServiceState;
  serviceEnabled: boolean;
  serviceRunning: boolean;
  lastConnectedAtMs: number | null;
  lastHeartbeatAtMs: number | null;
  lastCheckAtMs: number;
};

export type RulesStatus = {
  version: number;
  source: 'bundled' | 'remote';
  expiresAtMs: number;
  remoteConfigured: boolean;
  lastResult: string | null;
  lastCheckAtMs: number | null;
  apps: { key: string; packageNames: string[]; enabled: boolean }[];
};

/** Structural info about the last detection (debug builds only; never screen text). */
export type DetectionInfo = {
  packageName: string;
  /** Matched signal: a view id, a component label, or `structure`. */
  surfaceId: string | null;
  className: string | null;
  bounds: string | null;
  sessionId: number;
  itemIndex: number | null;
  /** 'pager' = adapter position from scroll events, 'swipe' = counted settled swipes. */
  indexSource?: 'pager' | 'swipe' | null;
  keyPrefix: string | null;
  counted: boolean;
  dmExcluded: boolean;
  atMs: number;
};

export type LayoutCapture = {
  /** Absolute path of the dump in the app cache. */
  path: string;
  packageName: string;
  /** Tree nodes written so far (first window plus snapshots). */
  nodes: number;
  /** Accessibility events logged so far (debug session capture). */
  events?: number;
  /** Tree snapshots written so far. */
  trees?: number;
  /** True while the session capture is still recording. */
  recording?: boolean;
  atMs: number;
};

export type DebugState = {
  serviceConnected: boolean;
  last: DetectionInfo | null;
  captureArmed: boolean;
  lastCapture: LayoutCapture | null;
};

type ThumbwellCoreEvents = {
  onCountChange: (counts: DayCounts) => void;
  onHealthChange: (status: HealthStatus) => void;
  /** Fires when the lock state changes (limit reached, limit or day start changed, day rolled). */
  lockStateChanged: (state: LockState) => void;
};

declare class ThumbwellCoreModule extends NativeModule<ThumbwellCoreEvents> {
  isServiceEnabled(): Promise<boolean>;
  /** Opens the system accessibility settings (started on the main thread). */
  openAccessibilitySettings(): Promise<void>;
  getTodayCounts(): Promise<DayCounts>;
  /** Per-day counts and ads seen, newest first. `limit` defaults to 30 (max 400). */
  getDailyCounts(limit?: number): Promise<DailyCounts[]>;
  /** Service, consent and per-app state for the "counting paused" UI. */
  getCountingStatus(): Promise<CountingStatus>;
  /**
   * Logs the user's consent (timestamp = now) for a disclosure `version`. Call from S06 when the
   * user accepts; counting stays off until the version equals `CountingStatus.disclosureVersion`.
   */
  setConsent(version: string): Promise<ConsentRecord>;
  getConsent(): Promise<ConsentRecord | null>;
  /** Minutes after local midnight (0 to 1439) at which the day starts. Returns today's counts. */
  setDayStartMinutes(minutes: number): Promise<DayCounts>;
  getDayStartMinutes(): Promise<number>;
  /** The floating badge switches; the badge position is stored natively and not exposed. */
  getBadgeSettings(): Promise<BadgeSettings>;
  /** Merges `patch` into the saved settings and returns them. Rejects on an unknown displayTime. */
  setBadgeSettings(patch: Partial<BadgeSettings>): Promise<BadgeSettings>;
  /**
   * The installed app's own launcher icon as a base64 PNG (`sizePx` default 96), or null when it
   * is not installed. Only Instagram, YouTube and TikTok packages can be asked for.
   */
  getAppIcon(packageName: string, sizePx?: number): Promise<string | null>;
  getDailyLimit(): Promise<DailyLimit>;
  /** Sets the limit (0 to 1000) with the lower-now, raise-tomorrow rule; returns the new state. */
  setDailyLimit(value: number): Promise<DailyLimit>;
  /** The limit lock state, recomputed from Room and the limit rule at call time. */
  getLockState(): Promise<LockState>;
  /** Deletes all counts, events, seen state, consent, limit and day start. */
  clearAllData(): Promise<void>;
  getHealth(): Promise<HealthStatus>;
  getRulesStatus(): Promise<RulesStatus>;
  /** Null in release builds. */
  getDebugState(): Promise<DebugState | null>;
  /**
   * Debug builds: dumps the node tree of the next target-app window the service sees to a file
   * (see `DebugState.lastCapture`). Resolves false in release builds.
   */
  captureLayout(): Promise<boolean>;
  /** Debug builds: stops the running session capture and flushes it. False in release builds. */
  stopCapture(): Promise<boolean>;
}

/** Native Kotlin core (Android only): reel detection service, counts and settings shortcuts. */
const ThumbwellCore = requireNativeModule<ThumbwellCoreModule>('ThumbwellCore');

export default ThumbwellCore;
