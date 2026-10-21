import { Tabs } from 'expo-router';

import { TabBar } from '@/components/ui';
import { useT } from '@/i18n';

export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, descriptors, navigateToTab, insets }) => (
        <TabBar
          items={state.routes.map((route) => ({
            key: route.key,
            label: descriptors[route.key]?.options.title ?? route.name,
          }))}
          activeKey={state.routes[state.index]?.key ?? ''}
          onSelect={navigateToTab}
          bottomInset={insets.bottom}
        />
      )}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="stats" options={{ title: t('tabs.stats') }} />
      <Tabs.Screen name="me" options={{ title: t('tabs.me') }} />
    </Tabs>
  );
}
