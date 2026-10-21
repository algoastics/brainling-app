import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

export type CoinPillProps = { amount: number };

/** C05 — CoinPill showing the coin balance. */
export function CoinPill({ amount }: CoinPillProps) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View
      accessible
      accessibilityLabel={t('a11y.coins', { count: amount })}
      style={[styles.pill, { backgroundColor: colors.warnSoft }]}
    >
      <View style={[styles.coin, { backgroundColor: colors.coin, borderColor: colors.coinInk }]} />
      <Text variant="body.lg" style={[styles.tabular, { color: colors.ink }]}>
        {amount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    paddingVertical: 6,
    paddingHorizontal: space[12],
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  coin: { width: 18, height: 18, borderRadius: radius.pill, borderWidth: 2.5 },
  tabular: { fontVariant: ['tabular-nums'] },
});
