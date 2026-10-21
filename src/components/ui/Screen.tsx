import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, space, useTheme } from '@/theme';

export type ScreenProps = { children: ReactNode };

/** Themed, safe-area aware scrolling screen container with the standard gutter. */
export function Screen({ children }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: layout.gutter, gap: space[16] },
});
