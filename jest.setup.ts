import { jest } from '@jest/globals';

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
