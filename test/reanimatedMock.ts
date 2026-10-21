/**
 * Minimal Reanimated test double. Reanimated 4.7's own `react-native-reanimated/mock` still boots
 * JSReanimated, which throws `setCSSEventHandler is not available` under Jest (SDK 58). Animations
 * resolve to their target value immediately; components render with final styles.
 */
import type { ComponentType } from 'react';
import { View } from 'react-native';

type Shared<T> = { value: T; get: () => T; set: (v: T) => void };

function useSharedValue<T>(initial: T): Shared<T> {
  const box: Shared<T> = {
    value: initial,
    get: () => box.value,
    set: (v: T) => {
      box.value = v;
    },
  };
  return box;
}

const identity = <T>(value: T) => value;
const lastOf = <T>(...values: T[]) => values[values.length - 1];
const animation = { duration: () => animation };

const reanimated = {
  __esModule: true,
  default: {
    View,
    createAnimatedComponent: <P extends object>(component: ComponentType<P>) => component,
  },
  createAnimatedComponent: <P extends object>(component: ComponentType<P>) => component,
  useSharedValue,
  useAnimatedStyle: (fn: () => object) => fn(),
  useAnimatedProps: (fn: () => object) => fn(),
  useReducedMotion: () => false,
  withTiming: identity,
  withSpring: identity,
  withDelay: (_delay: number, value: unknown) => value,
  withSequence: lastOf,
  Easing: { bezier: () => identity },
  FadeIn: animation,
  FadeOut: animation,
  SlideInDown: animation,
  SlideOutDown: animation,
};

export default reanimated;
