import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';
import type { Action } from './types';

export type BannerTone = 'info' | 'warn';

export type BannerProps = {
  title: string;
  body?: string;
  tone?: BannerTone;
  actions?: readonly Action[];
  testID?: string;
};

/** Inline status banner (counting paused, etc.): notice-card look, warm border for `warn`. */
export function Banner({ title, body, tone = 'info', actions = [], testID }: BannerProps) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      style={[
        styles.banner,
        {
          backgroundColor: tone === 'warn' ? colors.bgSurface : colors.bgPrimarySoft,
          borderColor: tone === 'warn' ? colors.statusWarn : 'transparent',
        },
      ]}
    >
      <Text variant="h3">{title}</Text>
      {body ? (
        <Text variant="body" color="textSecondary">
          {body}
        </Text>
      ) : null}
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
  banner: { borderRadius: radius.lg, borderWidth: 2, padding: space[16], gap: space[4] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[8], marginTop: space[8] },
});
