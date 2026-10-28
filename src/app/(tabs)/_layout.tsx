import { Tabs } from 'expo-router';

import { HomeTabIcon, Icon, SettingsTabIcon, TabBar } from '@/components/ui';
import { useT } from '@/i18n';

const ICONS = { index: 'home', settings: 'settings' } as const;

/** Phase 0 tab bar: Home and Settings only (the limit lives in Settings). */
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
            icon: ({ color, focused, active }) => {
              if (!focused) {
                return (
                  <Icon
                    name={ICONS[route.name as keyof typeof ICONS] ?? 'home'}
                    size={24}
                    color={color}
                  />
                );
              }
              return route.name === 'settings' ? (
                <SettingsTabIcon color={color} active={active} />
              ) : (
                <HomeTabIcon color={color} active={active} />
              );
            },
          }))}
          activeKey={state.routes[state.index]?.key ?? ''}
          onSelect={navigateToTab}
          bottomInset={insets.bottom}
        />
      )}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings') }} />
    </Tabs>
  );
}
