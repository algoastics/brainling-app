import { StyleSheet, type TextProps } from 'react-native';

import { Text } from '@/components/ui';
import { typography } from '@/theme';

/** Onboarding screen title (kit: Fredoka 600, 26–30dp). Announced as a header. */
export function Title({ style, ...rest }: TextProps) {
  return <Text {...rest} accessibilityRole="header" style={[styles.title, style]} />;
}

const styles = StyleSheet.create({
  title: { ...typography['heading.h1'], fontSize: 28, lineHeight: 34 },
});
