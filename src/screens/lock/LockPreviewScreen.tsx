import { router } from 'expo-router';
import { useState } from 'react';

import { useDailyLimit, useDayStart } from '@/detection';
import { DEFAULT_LIMIT } from '@/limit/limitRule';
import { DEFAULT_DAY_START_MINUTES, lockedUntilLabel } from '@/lock/lockTime';

import { LockView } from './LockView';

/**
 * Dev-only preview of the lock overlay copy with the real budget and "Locked until HH:MM" from
 * the day-start setting. Not reachable in release builds; the shipped overlay is native (M4).
 */
export function LockPreviewScreen() {
  const { limit } = useDailyLimit();
  const { minutes } = useDayStart();
  const [now] = useState(() => Date.now());
  const budget = limit?.effective ?? DEFAULT_LIMIT;
  const until = lockedUntilLabel(now, minutes ?? DEFAULT_DAY_START_MINUTES);
  return (
    <LockView
      limit={budget}
      until={until}
      today={budget}
      onLeave={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
