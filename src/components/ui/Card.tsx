import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { elevation, radius, space, useTheme, type ColorTokens } from '@/theme';

export type CardTone = 'default' | 'primary' | 'accent' | 'good' | 'warn' | 'bad' | 'info';

export type CardProps = {
  children: ReactNode;
  elevated?: boolean;
  tone?: CardTone;
  style?: ViewStyle;
};

const toneBg: Record<CardTone, keyof ColorTokens> = {
  default: 'surface',
  primary: 'primarySoft',
  accent: 'accentSoft',
  good: 'goodSoft',
  warn: 'warnSoft',
  bad: 'badSoft',
  info: 'infoSoft',
};

/** C03 — Card. Radius 20; `elevated` adds the 3dp offset shadow with no blur. */
export function Card({ children, elevated = false, tone = 'default', style }: CardProps) {
  const { colors } = useTheme();
  return (
    <View style={elevated ? { paddingBottom: elevation.offsetY } : undefined}>
      {elevated ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.shade,
            { backgroundColor: colors.shadow, top: elevation.offsetY },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors[toneBg[tone]],
            borderColor: tone === 'default' ? colors.line : 'transparent',
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shade: { borderRadius: radius.lg, opacity: elevation.opacity },
  card: { borderRadius: radius.lg, borderWidth: 1.5, padding: space[16] },
});
