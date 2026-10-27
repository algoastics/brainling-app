import ThumbwellCore, { type DebugState } from 'thumbwell-core';
import { Redirect, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { AppBar, Button, Card, ListRow, Screen, Text } from '@/components/ui';
import { useServiceStatus, useTodayCounts } from '@/detection';
import { space } from '@/theme';

/**
 * Dev-only screen: service status, today's counts, the last detected node (no text) and the
 * capture-layout tool that dumps the next reels-app window's node tree to a shareable file.
 */
function DetectionDebugScreen() {
  const { enabled, refresh: refreshStatus } = useServiceStatus();
  const { counts, refresh: refreshCounts } = useTodayCounts();
  const [debug, setDebug] = useState<DebugState | null>(null);

  const refreshDebug = useCallback(async () => {
    const state = await ThumbwellCore.getDebugState();
    setDebug(state);
  }, []);
  const refresh = useCallback(async () => {
    await Promise.all([refreshStatus(), refreshCounts(), refreshDebug()]);
  }, [refreshStatus, refreshCounts, refreshDebug]);

  const armCapture = useCallback(async () => {
    await ThumbwellCore.captureLayout();
    await refreshDebug();
  }, [refreshDebug]);

  const stopCapture = useCallback(async () => {
    await ThumbwellCore.stopCapture();
    await refreshDebug();
  }, [refreshDebug]);

  const capture = debug?.lastCapture;
  const shareCapture = useCallback(async () => {
    if (!capture) return;
    await Sharing.shareAsync(`file://${capture.path}`, {
      mimeType: 'text/plain',
      dialogTitle: `Layout ${capture.packageName}`,
    });
  }, [capture]);

  // Debug state isn't pushed by native: re-read it on each count change and on foreground.
  useEffect(() => {
    const countSub = ThumbwellCore.addListener('onCountChange', () => void refreshDebug());
    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshDebug();
    });
    const initial = requestAnimationFrame(() => void refreshDebug());
    return () => {
      countSub.remove();
      appStateSub.remove();
      cancelAnimationFrame(initial);
    };
  }, [refreshDebug]);

  const last = debug?.last;

  return (
    <Screen>
      <AppBar title="Detection debug" onBack={() => router.back()} />
      <Card>
        <ListRow
          title="Accessibility service"
          value={enabled == null ? '—' : enabled ? 'Enabled' : 'Off'}
        />
        <ListRow title="Service connected" value={debug?.serviceConnected ? 'Yes' : 'No'} />
        <Button
          kind="secondary"
          label="Open accessibility settings"
          onPress={() => void ThumbwellCore.openAccessibilitySettings()}
        />
        <Button kind="ghost" label="Refresh" onPress={() => void refresh()} />
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
            <ListRow title="Signal" subtitle={last.surfaceId ?? '—'} />
            <ListRow title="Class" subtitle={last.className ?? '—'} />
            <ListRow title="Bounds" subtitle={last.bounds ?? '—'} />
            <ListRow
              title="Page index"
              value={
                last.itemIndex == null
                  ? '—'
                  : `${last.itemIndex}${last.indexSource ? ` (${last.indexSource})` : ''}`
              }
            />
            <ListRow title="Key" value={last.keyPrefix ?? '—'} />
            <ListRow title="Session" value={String(last.sessionId)} />
            <ListRow title="Counted" value={last.counted ? 'Yes' : 'No'} />
            <ListRow title="DM reel (excluded)" value={last.dmExcluded ? 'Yes' : 'No'} />
            <ListRow title="At" value={new Date(last.atMs).toLocaleTimeString()} />
          </View>
        ) : (
          <Text color="muted">No reels surface seen yet.</Text>
        )}
      </Card>
      <Card>
        <Text variant="heading.h3">Capture layout</Text>
        <Text color="muted">
          {debug?.captureArmed
            ? 'Recording: open a reels app and swipe. Every event and a tree per count/page is logged.'
            : 'Logs events plus view ids, classes, bounds and flags of a reels-app session. No text.'}
        </Text>
        {debug?.captureArmed ? (
          <Button kind="secondary" label="Stop capture" onPress={() => void stopCapture()} />
        ) : (
          <Button
            kind="secondary"
            label="Start session capture"
            onPress={() => void armCapture()}
          />
        )}
        {capture ? (
          <View style={styles.rows}>
            <ListRow title="Package" subtitle={capture.packageName} />
            <ListRow title="Nodes" value={String(capture.nodes)} />
            <ListRow title="Events" value={String(capture.events ?? 0)} />
            <ListRow title="Trees" value={String(capture.trees ?? 1)} />
            <ListRow title="At" value={new Date(capture.atMs).toLocaleTimeString()} />
            <Button kind="ghost" label="Share capture" onPress={() => void shareCapture()} />
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}

export default function DetectionDebugRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DetectionDebugScreen />;
}

const styles = StyleSheet.create({ rows: { gap: space[4] } });
