import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { sizes, space, useTheme } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

export type TopBarProps = {
  title: string;
  /** Back variant (title H3, back arrow). Omit for the root variant (title H2, optional action). */
  onBack?: () => void;
  backLabel?: string;
  /** Root variant trailing action, e.g. the bell. Defaults to nothing. */
  action?: { icon: ReactNode; label: string; onPress: () => void };
};

/** TopBar (Figma "Top bar": 56 high; root = H2 + action, back = arrow + H3). */
export function TopBar({ title, onBack, backLabel, action }: TopBarProps) {
  const { colors } = useTheme();
  const t = useT();
  const isBack = onBack !== undefined;
  return (
    <View
      style={[styles.bar, { backgroundColor: colors.bgScreen }, isBack ? styles.back : styles.root]}
    >
      {isBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel ?? t('common.back')}
          onPress={onBack}
          style={styles.touch}
        >
          <Icon name="back" />
        </Pressable>
      ) : null}
      <Text
        variant={isBack ? 'h3' : 'h2'}
        accessibilityRole="header"
        numberOfLines={1}
        style={styles.title}
      >
        {title}
      </Text>
      {!isBack && action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={styles.touch}
        >
          {action.icon}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: sizes.topBarHeight, flexDirection: 'row', alignItems: 'center' },
  root: { gap: space[8], paddingLeft: space[20], paddingRight: space[4] },
  back: { gap: space[4], paddingLeft: space[4], paddingRight: space[16] },
  title: { flex: 1 },
  touch: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
