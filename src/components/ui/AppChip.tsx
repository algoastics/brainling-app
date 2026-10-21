import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

export type AppChipProps = {
  /** Display name of the tracked app. */
  app: string;
  /** Launcher icon from the device (PackageManager), never a bundled trademark logo. */
  icon?: ImageSourcePropType;
  count: number;
  /** Per-app limit (Pro). */
  limit?: number;
};

/** C04 — AppChip: tracked app with today's count and optional per-app limit. */
export function AppChip({ app, icon, count, limit }: AppChipProps) {
  const { colors } = useTheme();
  const over = limit !== undefined && count >= limit;
  const label = limit !== undefined ? `${count}/${limit}` : `${count}`;
  return (
    <View
      accessible
      accessibilityLabel={`${app}: ${label}`}
      style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.line }]}
    >
      {icon ? <Image source={icon} style={styles.icon} /> : null}
      <Text variant="body.sm" numberOfLines={1} style={styles.name}>
        {app}
      </Text>
      <Text variant="body.sm" style={{ color: over ? colors.bad : colors.ink2 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    paddingVertical: space[8],
    paddingHorizontal: space[12],
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  icon: { width: 20, height: 20, borderRadius: radius.xs - 2 },
  name: { flexShrink: 1 },
});
