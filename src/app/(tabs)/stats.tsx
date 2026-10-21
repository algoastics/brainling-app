import { Screen, Text } from '@/components/ui';
import { useT } from '@/i18n';

export default function StatsScreen() {
  const t = useT();
  return (
    <Screen>
      <Text variant="heading.h1" accessibilityRole="header">
        {t('tabs.stats')}
      </Text>
    </Screen>
  );
}
