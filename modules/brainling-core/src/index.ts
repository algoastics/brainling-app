import { NativeModule, requireNativeModule } from 'expo';

export type DayCounts = {
  /** Local date, yyyy-MM-dd. */
  date: string;
  total: number;
  /** Count per app rule key, e.g. `instagram`, `youtube`. */
  apps: Record<string, number>;
};

/** Structural info about the last detection (debug builds only; never screen text). */
export type DetectionInfo = {
  packageName: string;
  surfaceId: string | null;
  className: string | null;
  bounds: string | null;
  itemIndex: number | null;
  keyPrefix: string | null;
  counted: boolean;
  atMs: number;
};

export type DebugState = {
  serviceConnected: boolean;
  last: DetectionInfo | null;
};

type BrainlingCoreEvents = {
  onCountChange: (counts: DayCounts) => void;
};

declare class BrainlingCoreModule extends NativeModule<BrainlingCoreEvents> {
  isServiceEnabled(): boolean;
  openAccessibilitySettings(): void;
  getTodayCounts(): DayCounts;
  /** Null in release builds. */
  getDebugState(): DebugState | null;
}

/** Native Kotlin core (Android only): reel detection service, counts and settings shortcuts. */
const BrainlingCore = requireNativeModule<BrainlingCoreModule>('BrainlingCore');

export default BrainlingCore;
