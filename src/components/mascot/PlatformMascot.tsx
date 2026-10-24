import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { useT } from '@/i18n';

import { Mascot } from './Mascot';
import { moodForCount } from './platformMood';

export type PlatformMascotProps = {
  /** Platform label, already translated (e.g. "Instagram"). */
  name: string;
  count: number;
  size?: number;
};

/**
 * Internal placeholder (real design later): the Brainling mascot whose mood follows a platform's
 * reel count. Idle breathing loop, a pop when the count rises, a wobble when the mood changes.
 */
export function PlatformMascot({ name, count, size = 88 }: PlatformMascotProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const mood = moodForCount(count);
  const bob = useSharedValue(0);
  const pop = useSharedValue(1);
  const wobble = useSharedValue(0);
  const previous = useRef({ count, mood });

  useEffect(() => {
    if (reduceMotion) return;
    bob.set(
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(bob);
  }, [reduceMotion, bob]);

  useEffect(() => {
    const before = previous.current;
    previous.current = { count, mood };
    if (reduceMotion) return;
    if (count > before.count) {
      pop.set(withSequence(withTiming(1.25, { duration: 90 }), withTiming(1, { duration: 160 })));
    }
    if (mood !== before.mood) {
      wobble.set(
        withSequence(
          withTiming(-12, { duration: 80 }),
          withTiming(12, { duration: 120 }),
          withTiming(-6, { duration: 100 }),
          withTiming(0, { duration: 80 }),
        ),
      );
    }
  }, [count, mood, reduceMotion, pop, wobble]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.get() }, { scale: pop.get() }, { rotate: `${wobble.get()}deg` }],
  }));

  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel={`${name}: ${t('platforms.count', { count })}`}
    >
      <Animated.View style={style}>
        <Mascot state={mood} size={size} />
      </Animated.View>
      <Text variant="heading.h3">{name}</Text>
      <Text variant="body.sm" color="ink2">
        {t('platforms.count', { count })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', minWidth: 96 },
});
