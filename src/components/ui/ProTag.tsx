import { StyleSheet, View } from 'react-native';

import { palette, radius, useTheme } from '@/theme';

import { Text } from './Text';

/** PRO tag for Pro-only features (handoff §4); the feature itself routes to the paywall. */
export function ProTag() {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel="Pro feature" style={[styles.tag, { backgroundColor: colors.coin }]}>
      <Text variant="caption" style={{ color: palette.ink900 }}>
        PRO
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
});
