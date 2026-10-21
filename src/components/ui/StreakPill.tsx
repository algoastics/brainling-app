import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { palette, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

export type StreakTier = 'broken' | 'orange' | 'blue' | 'purple' | 'rainbow';

export type StreakPillProps = { days: number; frozen?: boolean };

/** Flame tiers (A17): orange 1–6, blue 7–29, purple 30–99, rainbow 100+, grey when broken. */
export function streakTier(days: number): StreakTier {
  if (days <= 0) return 'broken';
  if (days < 7) return 'orange';
  if (days < 30) return 'blue';
  if (days < 100) return 'purple';
  return 'rainbow';
}

const tierColor: Record<Exclude<StreakTier, 'rainbow'>, string> = {
  broken: palette.ink300,
  orange: palette.ember500,
  blue: palette.ice700,
  purple: palette.violet600,
};

const FLAME =
  'M12 2c1 3.5 5 5.8 5 10.5A5 5 0 0 1 7 12.5c0-1.6.7-2.9 1.6-3.8.2 1.4 1 2.4 2 2.7-.6-3.4.4-6.6 1.4-9.4Z';

function Flame({ tier }: { tier: StreakTier }) {
  return (
    <Svg width={18} height={20} viewBox="5 1 14 18">
      {tier === 'rainbow' ? (
        <Defs>
          <LinearGradient id="streakRainbow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.pink500} />
            <Stop offset="0.35" stopColor={palette.sun500} />
            <Stop offset="0.7" stopColor={palette.mint500} />
            <Stop offset="1" stopColor={palette.violet500} />
          </LinearGradient>
        </Defs>
      ) : null}
      <Path d={FLAME} fill={tier === 'rainbow' ? 'url(#streakRainbow)' : tierColor[tier]} />
    </Svg>
  );
}

/** C05 — StreakPill. A frozen streak shows the ice tone. */
export function StreakPill({ days, frozen = false }: StreakPillProps) {
  const { colors } = useTheme();
  const tier = streakTier(days);
  return (
    <View
      accessible
      accessibilityLabel={`${days} day streak${frozen ? ', frozen' : ''}`}
      style={[styles.pill, { backgroundColor: frozen ? colors.infoSoft : colors.surface2 }]}
    >
      <Flame tier={tier} />
      <Text variant="body.lg" style={[styles.tabular, { color: colors.ink }]}>
        {days}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingVertical: 6,
    paddingHorizontal: space[12],
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  tabular: { fontVariant: ['tabular-nums'] },
});
