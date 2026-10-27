import { Redirect } from 'expo-router';

import { LockPreviewScreen } from '@/screens/lock/LockPreviewScreen';

/** Dev-only: the route is also guarded in the root stack. */
export default function LockPreviewRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <LockPreviewScreen />;
}
