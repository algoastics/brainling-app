import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

export type TabBarItem = {
  key: string;
  label: string;
  icon?: (props: { focused: boolean; color: string }) => ReactNode;
};

export type TabBarProps = {
  items: readonly TabBarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  bottomInset?: number;
};

/** C09 — bottom TabBar. */
export function TabBar({ items, activeKey, onSelect, bottomInset = 0 }: TabBarProps) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        { backgroundColor: colors.nav, borderTopColor: colors.line, paddingBottom: bottomInset },
      ]}
    >
      {items.map((item) => {
        const focused = item.key === activeKey;
        const color = focused ? colors.primary : colors.muted;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: focused }}
            onPress={() => onSelect(item.key)}
            style={styles.tab}
          >
            <View style={[styles.pill, focused && { backgroundColor: colors.primarySoft }]}>
              {item.icon?.({ focused, color })}
            </View>
            <Text variant="caption" style={{ color }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: space[8] },
  tab: {
    flex: 1,
    minHeight: layout.minTouch + 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pill: {
    minWidth: 56,
    minHeight: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
