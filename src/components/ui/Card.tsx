import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, space, useTheme, type ColorTokens } from '@/theme';

export type CardTone =
  'default' | 'tint' | 'notice' | 'primary' | 'accent' | 'good' | 'warn' | 'bad' | 'info';

export type CardProps = {
  children: ReactNode;
  /** @deprecated Cards prefer a border over a shadow; kept for old screens, ignored. */
  elevated?: boolean;
  tone?: CardTone;
  style?: ViewStyle;
};

const toneBg: Record<CardTone, keyof ColorTokens> = {
  default: 'bgSurface',
  tint: 'bgPrimarySoft',
  notice: 'bgSurface',
  primary: 'bgPrimarySoft',
  accent: 'bgPrimarySoft',
  good: 'goodSoft',
  warn: 'warnSoft',
  bad: 'badSoft',
  info: 'infoSoft',
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
          backgroundColor: colors[toneBg[tone]],
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
  card: { borderRadius: radius.lg, padding: space[20] },
});
