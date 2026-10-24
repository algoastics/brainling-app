import { View, StyleSheet } from 'react-native';

import { PLATFORMS, platformCount, PlatformMascot } from '@/components/mascot';
import { Card, Screen, Text } from '@/components/ui';
import { useTodayCounts } from '@/detection';
import { useT } from '@/i18n';
import { space } from '@/theme';

export default function HomeScreen() {
  const t = useT();
  const { counts } = useTodayCounts();
  return (
    <Screen>
      <Text variant="heading.h1" accessibilityRole="header">
        {t('tabs.home')}
      </Text>
      <Text variant="heading.h3">{t('platforms.title')}</Text>
      <Text variant="body.sm" color="ink2">
        {t('platforms.subtitle')}
      </Text>
      <Card>
        <View style={styles.grid}>
          {PLATFORMS.map((p) => (
            <PlatformMascot
              key={p.key}
              name={t(`platforms.name.${p.key}`)}
              count={platformCount(counts, p.ruleKeys)}
            />
          ))}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    rowGap: space[16],
  },
});
