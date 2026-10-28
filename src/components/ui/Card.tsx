import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, space, useTheme } from '@/theme';

/** default = white surface; tint = soft violet; notice = surface with a warm 2dp border. */
export type CardTone = 'default' | 'tint' | 'notice';

export type CardProps = {
  children: ReactNode;
  tone?: CardTone;
  style?: ViewStyle;
};

/** Card (Figma "Card": radius 20, 1.5dp border not shadow, padding 20; tint and notice kinds). */
export function Card({ children, tone = 'default', style }: CardProps) {
  const { colors } = useTheme();
  const border =
    tone === 'default'
      ? colors.borderDefault
      : tone === 'notice'
        ? colors.statusWarn
        : 'transparent';
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tone === 'tint' ? colors.bgPrimarySoft : colors.bgSurface,
          borderColor: border,
          borderWidth: tone === 'notice' ? 2 : 1.5,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space[20], gap: space[8] },
});
