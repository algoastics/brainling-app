import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme, type ColorTokens } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';
import type { Action } from './types';

export type BannerTone = 'info' | 'good' | 'warn' | 'bad';

export type BannerProps = {
  title: string;
  body?: string;
  tone?: BannerTone;
  actions?: readonly Action[];
};

const toneColors: Record<BannerTone, [keyof ColorTokens, keyof ColorTokens]> = {
  info: ['infoSoft', 'info'],
  good: ['goodSoft', 'good'],
  warn: ['warnSoft', 'warn'],
  bad: ['badSoft', 'bad'],
};

/** C10 — inline Banner for status messages (offline, service off, warnings). */
export function Banner({ title, body, tone = 'info', actions = [] }: BannerProps) {
  const { colors } = useTheme();
  const [bg, edge] = toneColors[tone];
  return (
    <View
      accessibilityRole="summary"
      style={[styles.banner, { backgroundColor: colors[bg], borderLeftColor: colors[edge] }]}
    >
      <Text variant="body.lg">{title}</Text>
      {body ? <Text color="ink2">{body}</Text> : null}
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((a) => (
            <Button
              key={a.label}
              label={a.label}
              onPress={a.onPress}
              kind={a.kind ?? 'secondary'}
              size="sm"
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: radius.md, borderLeftWidth: 4, padding: space[16], gap: space[4] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[8], marginTop: space[8] },
});
