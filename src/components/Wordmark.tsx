import { StyleSheet, Text } from 'react-native';

import { fonts, useTheme } from '@/theme';

/** The "thumbwell" wordmark: "thumb" in ink, "well" in brand violet (Nunito Black). */
export function Wordmark({ size = 48 }: { size?: number }) {
  const { colors } = useTheme();
  const base = {
    fontFamily: fonts.nunito.black,
    fontSize: size,
    lineHeight: Math.round(size * 1.08),
  };
  return (
    <Text accessibilityRole="header" accessibilityLabel="Thumbwell" style={[styles.row, base]}>
      <Text style={{ color: colors.textPrimary }}>thumb</Text>
      <Text style={{ color: colors.brandPrimary }}>well</Text>
    </Text>
  );
}

const styles = StyleSheet.create({ row: { letterSpacing: -1, textAlign: 'center' } });
