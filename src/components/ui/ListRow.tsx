import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { space, useTheme } from '@/theme';

import { Text } from './Text';
import { Icon } from './Icon';
import { Toggle } from './Toggle';

export type ListRowToggle = { value: boolean; onChange: (value: boolean) => void };

export type ListRowProps = {
  title: string;
  icon?: ReactNode;
  subtitle?: string;
  value?: string;
  chevron?: boolean;
  toggle?: ListRowToggle;
  danger?: boolean;
  onPress?: () => void;
};

/** C03 — ListRow. Min height 56; trailing value, chevron or toggle. */
export function ListRow({
  title,
  icon,
  subtitle,
  value,
  chevron = false,
  toggle,
  danger = false,
  onPress,
}: ListRowProps) {
  const { colors } = useTheme();
  const content = (
    <>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.text}>
        <Text variant="body.lg" style={{ color: danger ? colors.bad : colors.ink }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body.sm" color="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="body.md" color="ink2">
          {value}
        </Text>
      ) : null}
      {toggle ? (
        <Toggle value={toggle.value} onChange={toggle.onChange} accessibilityLabel={title} />
      ) : null}
      {chevron ? <Icon name="chevron" color="textMuted" /> : null}
    </>
  );

  if (onPress && !toggle) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingHorizontal: space[16],
    paddingVertical: space[8],
  },
  icon: { width: 24, alignItems: 'center' },
  text: { flex: 1, gap: 2 },
  chevron: {
    width: 9,
    height: 9,
    borderTopWidth: 2,
    borderRightWidth: 2,
    transform: [{ rotate: '45deg' }],
    marginRight: 4,
  },
});
