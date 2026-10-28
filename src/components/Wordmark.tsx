import { StyleSheet, Text } from 'react-native';

import { fonts, tracking, useTheme } from '@/theme';

/**
 * The "thumbwell" wordmark: "thumb" in ink, "well" in the wordmark accent (Nunito Black,
 * -2% tracking, natural line height as in Figma).
 */
export function Wordmark({ size = 48 }: { size?: number }) {
  const { colors } = useTheme();
  const base = {
    fontFamily: fonts.nunito.black,
    fontSize: size,
    letterSpacing: tracking(-2, size),
  };
  return (
    <Text accessibilityRole="header" accessibilityLabel="Thumbwell" style={[styles.row, base]}>
      <Text style={{ color: colors.textPrimary }}>thumb</Text>
      <Text style={{ color: colors.brandWordmarkAccent }}>well</Text>
    </Text>
  );
}

const styles = StyleSheet.create({ row: { textAlign: 'center' } });
