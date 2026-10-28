import ThumbwellCore from 'thumbwell-core';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { LimitPicker } from '@/components/LimitPicker';
import { LimitThumb } from '@/components/mascot';
import { Button, Screen, ScreenGroup, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { DEFAULT_LIMIT, estimateMinutes } from '@/limit/limitRule';

/**
 * S04-P0 Daily limit (step 2 of 4). The first choice applies at once (native rule); changing it
 * later goes through Settings, where raising waits until tomorrow.
 */
export function LimitScreen() {
  const t = useT();
  const [value, setValue] = useState(DEFAULT_LIMIT);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Coming back to this step keeps what the user picked before.
  useEffect(() => {
    let live = true;
    void ThumbwellCore.getDailyLimit()
      .then((l) => live && setValue(l.pending ?? l.effective))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const onContinue = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await ThumbwellCore.setDailyLimit(value);
      router.push('/disclosure');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen spread edges={['bottom']} testID="limit">
      <ScreenGroup>
        <Text variant="h1" accessibilityRole="header">
          {t('limit.title')}
        </Text>
        <Text variant="body" color="textSecondary">
          {t('limit.body')}
        </Text>
        <LimitPicker
          value={value}
          onChange={setValue}
          hero={<LimitThumb value={value} width={132} />}
        />
        <Text variant="caption" color="textMuted">
          {t('limit.estimate', { count: value, minutes: estimateMinutes(value) })}
        </Text>
      </ScreenGroup>
      <ScreenGroup>
        {failed ? (
          <Text variant="label" color="statusDangerStrong" accessibilityLiveRegion="polite">
            {t('limit.saveError')}
          </Text>
        ) : null}
        <Button label={t('limit.cta')} onPress={onContinue} loading={busy} />
      </ScreenGroup>
    </Screen>
  );
}
