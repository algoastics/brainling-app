import { NativeModule, requireNativeModule } from 'expo';

export type DayCounts = {
  /** Brainling day (04:00 to 04:00 local), yyyy-MM-dd. */
  date: string;
  total: number;
  /** Count per app rule key, e.g. `instagram`, `youtube`, `tiktok_lite`. */
  apps: Record<string, number>;
  /** Epoch ms of the 04:00 local day close that ends this day. */
  nextCloseAtMs: number;
  /** IANA time zone the day was computed in. */
  timeZone: string;
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
  nodes: number;
  atMs: number;
};

export type DebugState = {
  serviceConnected: boolean;
  last: DetectionInfo | null;
  captureArmed: boolean;
  lastCapture: LayoutCapture | null;
};

type BrainlingCoreEvents = {
  onCountChange: (counts: DayCounts) => void;
  onHealthChange: (status: HealthStatus) => void;
};

declare class BrainlingCoreModule extends NativeModule<BrainlingCoreEvents> {
  isServiceEnabled(): Promise<boolean>;
  /** Opens the system accessibility settings (started on the main thread). */
  openAccessibilitySettings(): Promise<void>;
  getTodayCounts(): Promise<DayCounts>;
  getHealth(): Promise<HealthStatus>;
  getRulesStatus(): Promise<RulesStatus>;
  /** Null in release builds. */
  getDebugState(): Promise<DebugState | null>;
  /**
   * Debug builds: dumps the node tree of the next target-app window the service sees to a file
   * (see `DebugState.lastCapture`). Resolves false in release builds.
   */
  captureLayout(): Promise<boolean>;
}

/** Native Kotlin core (Android only): reel detection service, counts and settings shortcuts. */
const BrainlingCore = requireNativeModule<BrainlingCoreModule>('BrainlingCore');

export default BrainlingCore;
