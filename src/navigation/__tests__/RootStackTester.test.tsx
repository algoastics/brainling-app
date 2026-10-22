import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Stack } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { useAppStore } from '@/state/appStore';

import { RootStack } from '../RootStack';

jest.mock('@/config/tester', () => ({ TESTER_MODE: true, TESTER_SETUP_ROUTE: '/tester-setup' }));
jest.mock('@/storage', () => jest.requireActual('../../../test/memoryStorage'));

const routes = {
  _layout: RootStack,
  '(tabs)/index': () => <Text>home</Text>,
  '(onboarding)/_layout': {
    default: () => <Stack screenOptions={{ headerShown: false }} />,
    unstable_settings: { initialRouteName: 'welcome' },
  },
  '(onboarding)/welcome': () => <Text>welcome</Text>,
  'tester-setup': () => <Text>tester</Text>,
  'design-system': () => null,
  'detection-debug': () => null,
};

beforeEach(() => {
  useAppStore.setState({ onboardingCompleted: false, testerSetupDone: false });
});

describe('RootStack (tester mode)', () => {
  it('bypasses onboarding for Tester Setup on first launch', async () => {
    const r = await renderRouter(routes);
    expect(r.getPathname()).toBe('/tester-setup');
    expect(screen.queryByText('welcome')).toBeNull();
  });

  it('goes Home once setup is done', async () => {
    const r = await renderRouter(routes);
    await act(() => {
      useAppStore.getState().completeTesterSetup();
    });
    expect(r.getPathname()).toBe('/');
    expect(screen.getByText('home')).toBeTruthy();
  });
});
