import BrainlingCore, { type DayCounts, type DebugState } from 'brainling-core';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { AppBar, Button, Card, ListRow, Screen, Text } from '@/components/ui';
import { space } from '@/theme';

/** Dev-only spike screen: service status, today's counts and the last detected node (no text). */
function DetectionDebugScreen() {
  const [enabled, setEnabled] = useState(false);
  const [counts, setCounts] = useState<DayCounts | null>(null);
  const [debug, setDebug] = useState<DebugState | null>(null);

  const refresh = useCallback(() => {
    setEnabled(BrainlingCore.isServiceEnabled());
    setCounts(BrainlingCore.getTodayCounts());
    setDebug(BrainlingCore.getDebugState());
  }, []);

  useEffect(() => {
    const countSub = BrainlingCore.addListener('onCountChange', setCounts);
    const appStateSub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const initial = requestAnimationFrame(refresh);
    return () => {
      countSub.remove();
      appStateSub.remove();
      cancelAnimationFrame(initial);
    };
  }, [refresh]);

  const last = debug?.last;

  return (
    <Screen>
      <AppBar title="Detection debug" onBack={() => router.back()} />
      <Card>
        <ListRow title="Accessibility service" value={enabled ? 'Enabled' : 'Off'} />
        <ListRow title="Service connected" value={debug?.serviceConnected ? 'Yes' : 'No'} />
        <Button
          kind="secondary"
          label="Open accessibility settings"
          onPress={() => requestAnimationFrame(() => BrainlingCore.openAccessibilitySettings())}
        />
        <Button kind="ghost" label="Refresh" onPress={refresh} />
      </Card>
      <Card>
        <Text variant="heading.h3">Today · {counts?.date ?? '—'}</Text>
        <Text variant="display.lg">{counts?.total ?? 0}</Text>
        {Object.entries(counts?.apps ?? {}).map(([app, n]) => (
          <ListRow key={app} title={app} value={String(n)} />
        ))}
      </Card>
      <Card>
        <Text variant="heading.h3">Last detection</Text>
        {last ? (
          <View style={styles.rows}>
            <ListRow title="Package" subtitle={last.packageName} />
            <ListRow title="Surface id" subtitle={last.surfaceId ?? '—'} />
            <ListRow title="Class" subtitle={last.className ?? '—'} />
            <ListRow title="Bounds" subtitle={last.bounds ?? '—'} />
            <ListRow title="Page index" value={last.itemIndex?.toString() ?? '—'} />
            <ListRow title="Key" value={last.keyPrefix ?? '—'} />
            <ListRow title="Counted" value={last.counted ? 'Yes' : 'No'} />
            <ListRow title="At" value={new Date(last.atMs).toLocaleTimeString()} />
          </View>
        ) : (
          <Text color="muted">No reels surface seen yet.</Text>
        )}
      </Card>
    </Screen>
  );
}

export default function DetectionDebugRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DetectionDebugScreen />;
}

const styles = StyleSheet.create({ rows: { gap: space[4] } });
