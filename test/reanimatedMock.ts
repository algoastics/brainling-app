/**
 * Minimal Reanimated test double. Reanimated 4.7's own `react-native-reanimated/mock` still boots
 * JSReanimated, which throws `setCSSEventHandler is not available` under Jest (SDK 58). Animations
 * resolve to their target value immediately; components render with final styles.
 */
import type { ComponentType } from 'react';
import { Text, View } from 'react-native';

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
type Builder = { duration: () => Builder; delay: () => Builder };
const animation: Builder = { duration: () => animation, delay: () => animation };

/** Piecewise-linear interpolation with clamped ends (Reanimated `interpolate`). */
function interpolate(value: number, input: number[], output: number[]): number {
  const last = input.length - 1;
  if (value <= (input[0] ?? 0)) return output[0] ?? 0;
  for (let i = 1; i <= last; i++) {
    const hi = input[i] ?? 0;
    if (value <= hi) {
      const lo = input[i - 1] ?? 0;
      const from = output[i - 1] ?? 0;
      return from + ((value - lo) / (hi - lo)) * ((output[i] ?? from) - from);
    }
  }
  return output[last] ?? 0;
}

/** Colour interpolation reduced to the nearest stop (enough for rendered final styles). */
function interpolateColor(value: number, input: number[], output: string[]): string {
  let nearest = 0;
  input.forEach((stop, i) => {
    if (Math.abs(stop - value) < Math.abs((input[nearest] ?? 0) - value)) nearest = i;
  });
  return output[nearest] ?? '';
}

const reanimated = {
  __esModule: true,
  default: {
    View,
    Text,
    createAnimatedComponent: <P extends object>(component: ComponentType<P>) => component,
  },
  createAnimatedComponent: <P extends object>(component: ComponentType<P>) => component,
  useSharedValue,
  useAnimatedStyle: (fn: () => object) => fn(),
  useAnimatedProps: (fn: () => object) => fn(),
  useReducedMotion: () => false,
  // Gesture Handler's worklet bridge looks these up; tests never deliver gesture events through it.
  useHandler: () => ({ context: {}, doDependenciesDiffer: false }),
  useEvent: () => () => undefined,
  withTiming: identity,
  withSpring: identity,
  withDelay: (_delay: number, value: unknown) => value,
  withSequence: lastOf,
  withRepeat: identity,
  cancelAnimation: () => undefined,
  interpolate,
  interpolateColor,
  Extrapolation: { CLAMP: 'clamp' },
  Easing: { bezier: () => identity, linear: identity, sin: identity, inOut: () => identity },
  FadeIn: animation,
  FadeOut: animation,
  SlideInDown: animation,
  SlideInRight: animation,
  SlideOutDown: animation,
};

export default reanimated;
