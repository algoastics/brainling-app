import ThumbwellCore from 'thumbwell-core';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LimitPicker } from '@/components/LimitPicker';
import { LimitThumb } from '@/components/mascot';
import { Button, Card, Screen, ScreenGroup, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { DEFAULT_LIMIT, estimateMinutes } from '@/limit/limitRule';
import { space } from '@/theme';

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
        <View style={styles.thumb}>
          <LimitThumb value={value} />
        </View>
        <View style={styles.picker}>
          <LimitPicker value={value} onChange={setValue} />
        </View>
        <Text variant="caption" color="textMuted" style={styles.center}>
          {t('limit.estimate', { count: value, minutes: estimateMinutes(value) })}
        </Text>
        <Card tone="tint">
          <Text variant="label">{t('limit.cardTitle')}</Text>
          <Text variant="body" color="textSecondary">
            {t('limit.cardBody')}
          </Text>
        </Card>
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

const styles = StyleSheet.create({
  thumb: { alignItems: 'center' },
  picker: { paddingVertical: space[8] },
  center: { textAlign: 'center' },
});
