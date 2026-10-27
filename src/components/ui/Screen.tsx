import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { space, useTheme } from '@/theme';

export type ScreenProps = {
  children: ReactNode;
  /** Fixed content above the scrolling body (a TopBar). */
  header?: ReactNode;
  /** Safe-area edges to pad; tab screens pass only `top` because the tab bar covers the bottom. */
  edges?: readonly Edge[];
  /** Fill the height and spread the top and bottom groups apart (onboarding steps). */
  spread?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  testID?: string;
};

/**
 * Themed, safe-area aware scrolling screen: 24dp gutters, 12dp top, 16dp between blocks (Figma
 * 360x800 frames). `spread` lets the last child group sit at the bottom on tall phones.
 */
export function Screen({
  children,
  header,
  edges = ['top', 'bottom'],
  spread = false,
  onRefresh,
  refreshing = false,
  testID,
}: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      testID={testID}
      edges={edges}
      style={[styles.root, { backgroundColor: colors.bgScreen }]}
    >
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, spread && styles.spread]}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** A group of stacked blocks inside a `spread` screen. */
export function ScreenGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: space[24],
    paddingTop: space[12],
    paddingBottom: space[24],
    gap: space[16],
  },
  spread: { flexGrow: 1, justifyContent: 'space-between' },
  group: { gap: space[16] },
});
