import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Stack } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { useAppStore } from '@/state/appStore';

import { RootStack } from '../RootStack';

jest.mock('@/storage', () => jest.requireActual('../../../test/memoryStorage'));

const routes = {
  _layout: RootStack,
  '(tabs)/index': () => <Text>home</Text>,
  '(onboarding)/_layout': {
    default: () => <Stack screenOptions={{ headerShown: false }} />,
    unstable_settings: { initialRouteName: 'welcome' },
  },
  '(onboarding)/welcome': () => <Text>welcome</Text>,
  '(onboarding)/quiz': () => <Text>quiz</Text>,
  'design-system': () => null,
  'detection-debug': () => null,
};

beforeEach(() => {
  useAppStore.setState({ onboardingCompleted: false });
});

describe('RootStack', () => {
  it('sends first-launch users into onboarding', async () => {
    const r = await renderRouter(routes);
    expect(r.getPathname()).toBe('/welcome');
    expect(screen.getByText('welcome')).toBeTruthy();
  });

  it('lands returning users on Home', async () => {
    useAppStore.setState({ onboardingCompleted: true });
    const r = await renderRouter(routes);
    expect(r.getPathname()).toBe('/');
    expect(screen.getByText('home')).toBeTruthy();
  });

  it('redirects to Home as soon as onboarding completes', async () => {
    const r = await renderRouter(routes, { initialUrl: '/quiz' });
    expect(screen.getByText('quiz')).toBeTruthy();
    await act(() => {
      useAppStore.getState().completeOnboarding();
    });
    expect(r.getPathname()).toBe('/');
    expect(screen.queryByText('quiz')).toBeNull();
  });
});
