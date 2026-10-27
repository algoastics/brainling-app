import { jest } from '@jest/globals';
import { useEffect } from 'react';
import { Text } from 'react-native';

/** Stand-in for `expo-router`: records navigation calls and renders redirects as text. */
export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};

export const params: { current: Record<string, string> } = { current: {} };

export const routerModule = {
  router,
  useLocalSearchParams: () => params.current,
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(cb, []);
  },
  Redirect: ({ href }: { href: unknown }) => (
    <Text testID="redirect">{typeof href === 'string' ? href : JSON.stringify(href)}</Text>
  ),
};

export function resetRouter() {
  router.push.mockReset();
  router.replace.mockReset();
  router.back.mockReset();
  router.canGoBack.mockReset();
  router.canGoBack.mockReturnValue(true);
  params.current = {};
}
