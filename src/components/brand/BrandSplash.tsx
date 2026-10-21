import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Button, Text } from '@/components/ui';
import { motion, palette, space } from '@/theme';

import { Logomark } from './Logomark';

const POP_MS = 400;
const BLINK_MS = 180;
const REDUCED_FADE_MS = 150;

export type BrandSplashError = {
  message: string;
  retryLabel: string;
  onRetry: () => void;
};

export type BrandSplashProps = {
  /** Called once the A01 intro has played. */
  onIntroFinished?: () => void;
  /** S01-error: shown instead of the intro when local storage cannot be opened. */
  error?: BrandSplashError;
};

/**
 * S01 splash, drawn over the app after the native splash hides. The splash is fixed brand
 * violet in both themes. A01: logomark springs 0.6 → 1.0, then the mascot blinks.
 */
export function BrandSplash({ onIntroFinished, error }: BrandSplashProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(reduceMotion || error ? 1 : 0.6);
  const opacity = useSharedValue(reduceMotion && !error ? 0 : 1);
  const eyelid = useSharedValue(0);

  useEffect(() => {
    if (error) return;
    const finish = () => onIntroFinished?.();
    if (reduceMotion) {
      opacity.set(
        withTiming(1, { duration: REDUCED_FADE_MS }, (done) => {
          if (done) scheduleOnRN(finish);
        }),
      );
      return;
    }
    scale.set(withSpring(1, motion.spring));
    eyelid.set(
      withDelay(
        POP_MS,
        withSequence(
          withTiming(1, { duration: BLINK_MS / 2 }),
          withTiming(0, { duration: BLINK_MS / 2 }, (done) => {
            if (done) scheduleOnRN(finish);
          }),
        ),
      ),
    );
  }, [error, reduceMotion, onIntroFinished, scale, opacity, eyelid]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }));

  return (
    <Animated.View
      exiting={FadeOut.duration(motion.duration.quick)}
      style={[StyleSheet.absoluteFill, styles.root]}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="splashGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.violet600} />
            <Stop offset="1" stopColor={palette.violet900} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#splashGradient)" />
      </Svg>
      <Animated.View style={logoStyle}>
        <Logomark size={200} eyelid={eyelid} />
      </Animated.View>
      <Text variant="display.lg" accessibilityRole="header" style={styles.title}>
        Brainling
      </Text>
      <Text variant="body.lg" style={styles.tagline}>
        Count less. Live more.
      </Text>
      {error ? (
        <View style={styles.error} accessibilityLiveRegion="assertive">
          <Text variant="body.lg" style={styles.errorText}>
            {error.message}
          </Text>
          <Button label={error.retryLabel} onPress={error.onRetry} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', padding: space[24] },
  title: { color: palette.white, marginTop: space[8] },
  tagline: { color: palette.pink300 },
  error: {
    position: 'absolute',
    left: space[24],
    right: space[24],
    bottom: space[64],
    gap: space[16],
  },
  errorText: { color: palette.white, textAlign: 'center' },
});
