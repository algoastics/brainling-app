import * as Application from 'expo-application';
import { ActivityAction, startActivityAsync } from 'expo-intent-launcher';

const packageUri = () => `package:${Application.applicationId ?? 'com.algoastics.thumbwell'}`;

/**
 * System "App info" page for Thumbwell. On Android 13+ side-loaded builds this is where the
 * three-dot menu offers "Allow restricted settings".
 */
export async function openAppInfo(): Promise<boolean> {
  try {
    await startActivityAsync(ActivityAction.APPLICATION_DETAILS_SETTINGS, { data: packageUri() });
    return true;
  } catch {
    return false;
  }
}
