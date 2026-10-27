import * as Application from 'expo-application';
import { ActivityAction, startActivityAsync } from 'expo-intent-launcher';

import type { OemTarget } from './oem';

const packageUri = () => `package:${Application.applicationId ?? 'com.algoastics.thumbwell'}`;

/** System "App info" page for Thumbwell (S07-restricted, Samsung/OnePlus/Pixel guides). */
export async function openAppInfo(): Promise<boolean> {
  try {
    await startActivityAsync(ActivityAction.APPLICATION_DETAILS_SETTINGS, { data: packageUri() });
    return true;
  } catch {
    return false;
  }
}

/**
 * S09: the system battery-optimisation list. The direct "Allow?" dialog needs the
 * REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission, which the current build does not declare;
 * App info (Battery → Unrestricted) is the fallback.
 */
export async function openBatterySettings(): Promise<boolean> {
  try {
    await startActivityAsync(ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
    return true;
  } catch {
    return openAppInfo();
  }
}

/** Tries each OEM target in order (explicit components only); `false` means show S10-intentfail. */
export async function openOemTargets(targets: readonly OemTarget[]): Promise<boolean> {
  for (const target of targets) {
    if (target.kind === 'appInfo') {
      if (await openAppInfo()) return true;
      continue;
    }
    try {
      await startActivityAsync('android.intent.action.MAIN', {
        packageName: target.packageName,
        className: target.className,
      });
      return true;
    } catch {
      // Component missing on this OS version: try the next one.
    }
  }
  return false;
}
