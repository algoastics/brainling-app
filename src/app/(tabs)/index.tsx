import { Screen, Text } from '@/components/ui';
import { useT } from '@/i18n';

export default function HomeScreen() {
  const t = useT();
  return (
    <Screen>
      <Text variant="heading.h1" accessibilityRole="header">
        {t('tabs.home')}
      </Text>
    </Screen>
  );
}
