import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, space, useTheme } from '@/theme';

import { Text } from './Text';

export type AppBarProps = {
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
};

/** C09 — AppBar with optional back button and trailing slot. */
export function AppBar({ title, onBack, backLabel = 'Back', right }: AppBarProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            onPress={onBack}
            style={styles.back}
          >
            <View style={[styles.chevron, { borderColor: colors.ink }]} />
          </Pressable>
        ) : null}
      </View>
      {title ? (
        <Text
          variant="heading.h3"
          accessibilityRole="header"
          numberOfLines={1}
          style={styles.title}
        >
          {title}
        </Text>
      ) : (
        <View style={styles.title} />
      )}
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[8],
  },
  side: { minWidth: layout.minTouch },
  right: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
  back: {
    width: layout.minTouch,
    height: layout.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: 12,
    height: 12,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ translateX: 3 }, { rotate: '45deg' }],
  },
});
