import { jest } from '@jest/globals';
import 'react-native-gesture-handler/jestSetup';

// Screens render outside the app's GestureHandlerRootView in tests; treat every tree as inside one.
for (const path of [
  'react-native-gesture-handler/src/GestureHandlerRootViewContext',
  'react-native-gesture-handler/lib/module/GestureHandlerRootViewContext',
]) {
  jest.doMock(path, () => ({
    __esModule: true,
    default: (jest.requireActual('react') as typeof import('react')).createContext(true),
  }));
}

jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));
jest.mock(
  'react-native-reanimated',
  () => (jest.requireActual('./test/reanimatedMock') as { default: object }).default,
);
jest.mock(
  'react-native-safe-area-context',
  () =>
    (jest.requireActual('react-native-safe-area-context/jest/mock') as { default: object }).default,
);
jest.mock('@/storage', () => jest.requireActual('./test/memoryStorage'));
