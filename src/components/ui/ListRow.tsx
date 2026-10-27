import { Children, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Leading 40dp tile icon (Figma: soft violet tile, radius 12). */
  icon?: IconName;
  /** Trailing value text, in the accent colour. */
  value?: string;
  /** Trailing glyph: a chevron (opens a screen) or the external-link mark (leaves the app). */
  trailing?: 'chevron' | 'external';
  danger?: boolean;
  onPress?: () => void;
  testID?: string;
};

/** List row (Figma "List row"): optional icon tile, title and subtitle, value, chevron. */
export function ListRow({
  title,
  subtitle,
  icon,
  value,
  trailing,
  danger = false,
  onPress,
  testID,
}: ListRowProps) {
  const { colors } = useTheme();
  const ink = danger ? 'statusDangerStrong' : 'textPrimary';
  const content = (
    <>
      {icon ? (
        <View style={[styles.tile, { backgroundColor: colors.bgPrimarySoft }]}>
          <Icon name={icon} size={20} color={danger ? 'statusDangerStrong' : 'brandAccentText'} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="body" color={ink}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="label" color="brandAccentText">
          {value}
        </Text>
      ) : null}
      {trailing ? (
        <Icon name={trailing === 'external' ? 'external' : 'chevron'} size={20} color="textMuted" />
      ) : null}
    </>
  );
  if (!onPress) {
    return (
      <View testID={testID} style={styles.row}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
      onPress={onPress}
      style={styles.row}
    >
      {content}
    </Pressable>
  );
}

/** A white group of rows with hairline dividers (Figma "Settings group": radius 20, 1.5dp border). */
export function ListGroup({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const rows = Children.toArray(children);
  return (
    <View
      style={[
        styles.group,
        { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault },
      ]}
    >
      {rows.map((row, i) => (
        <View
          key={i}
          style={
            i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderDefault }
          }
        >
          {row}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: radius.lg, borderWidth: 1.5, overflow: 'hidden' },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingHorizontal: space[16],
    paddingVertical: space[12],
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: space[2] },
});
