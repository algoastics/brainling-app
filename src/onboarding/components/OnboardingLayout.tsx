import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { space, useTheme } from '@/theme';

export type OnboardingLayoutProps = {
  header?: ReactNode;
  children: ReactNode;
  /** Pinned bottom actions (kit: primary button at y 836 + text links). */
  footer?: ReactNode;
  /** Centred, non-scrolling body (success / result states). */
  centered?: boolean;
  testID?: string;
};

/** Shared onboarding frame: safe areas, 24dp gutters, scrollable body (font scale 1.3×) and footer. */
export function OnboardingLayout({
  header,
  children,
  footer,
  centered = false,
  testID,
}: OnboardingLayoutProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      testID={testID}
      edges={['top', 'bottom']}
      style={[styles.root, { backgroundColor: colors.bg }]}
    >
      {header}
      {centered ? (
        <View style={[styles.content, styles.centered]}>{children}</View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: space[24], paddingTop: space[16], paddingBottom: space[24] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: {
    paddingHorizontal: space[24],
    paddingTop: space[8],
    paddingBottom: space[12],
    gap: space[4],
  },
});
