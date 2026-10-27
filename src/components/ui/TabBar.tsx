import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, sizes, space, useTheme } from '@/theme';

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

/**
 * Tab bar (Figma "Tab bar": 72 high, surface, 1dp top border; the active tab gets a 56x32 soft
 * violet pill behind its icon and an accent label). Figma lists Home, Limits, Settings.
 */
export function TabBar({ items, activeKey, onSelect, bottomInset = 0 }: TabBarProps) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: colors.bgSurface,
          borderTopColor: colors.borderDefault,
          height: sizes.tabBarHeight + bottomInset,
          paddingBottom: bottomInset,
        },
      ]}
    >
      {items.map((item) => {
        const focused = item.key === activeKey;
        const color = focused ? colors.brandAccentText : colors.textMuted;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: focused }}
            onPress={() => onSelect(item.key)}
            style={styles.tab}
          >
            <View style={[styles.pill, focused && { backgroundColor: colors.bgPrimarySoft }]}>
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
  bar: { flexDirection: 'row', borderTopWidth: 1 },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    paddingVertical: space[8],
  },
  pill: {
    width: 56,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
