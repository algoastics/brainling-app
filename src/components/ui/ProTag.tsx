import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { palette, radius, useTheme } from '@/theme';

import { Text } from './Text';

/** PRO tag for Pro-only features (handoff §4); the feature itself routes to the paywall. */
export function ProTag() {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View
      accessibilityLabel={t('common.proFeature')}
      style={[styles.tag, { backgroundColor: colors.coin }]}
    >
      <Text variant="caption" style={{ color: palette.ink900 }}>
        {t('common.pro')}
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
