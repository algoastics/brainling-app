import { Tabs } from 'expo-router';

import { TabBar } from '@/components/ui';

export default function TabsLayout() {
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
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
      <Tabs.Screen name="me" options={{ title: 'Me' }} />
    </Tabs>
  );
}
