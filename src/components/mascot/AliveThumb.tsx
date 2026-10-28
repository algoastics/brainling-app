import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/motion';
import { motion } from '@/theme';

import { Thumb, type ThumbPose } from './Thumb';

const BREATH_MS = motion.duration.breath / 2;
const BLINK_STEP_MS = 40;
const LID = '#C8B9FD';

/** Happy-pose eyes, as fractions of the 240×270 artwork (A59 blink covers these). */
const EYES = [
  { left: '36.5%', top: '48.7%', width: '5.5%', height: '6.5%' },
  { left: '52.3%', top: '48.7%', width: '5.5%', height: '6.5%' },
] as const;

/**
 * Home Thumb (A59). Breathes while Home is focused and the app is in the foreground, and blinks
 * every 3–5 s. Reduced motion, blur and background all leave it still with eyes open.
 */
export function AliveThumb({ pose = 'happy', width = 156 }: { pose?: ThumbPose; width?: number }) {
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [lid, setLid] = useState(0);
  const breath = useSharedValue(0);
  const alive = focused && appActive && !reduced;

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setAppActive(next === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!alive) {
      cancelAnimation(breath);
      breath.set(0);
      return;
    }
    breath.set(
      withRepeat(
        withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(breath);
  }, [alive, breath]);

  useEffect(() => {
    if (!alive) return;
    let cancelled = false;
    let stepTimer: ReturnType<typeof setTimeout> | undefined;
    let waitTimer: ReturnType<typeof setTimeout> | undefined;
    const steps = [0.5, 1, 0.5, 0];
    const blink = () => {
      if (cancelled) return;
      let i = 0;
      const next = () => {
        if (cancelled) return;
        const value = steps[i];
        if (value === undefined) {
          waitTimer = setTimeout(blink, 3000 + Math.random() * 2000);
          return;
        }
        setLid(value);
        i += 1;
        stepTimer = setTimeout(next, BLINK_STEP_MS);
      };
      next();
    };
    waitTimer = setTimeout(blink, 3000 + Math.random() * 2000);
    return () => {
      cancelled = true;
      clearTimeout(stepTimer);
      clearTimeout(waitTimer);
      setLid(0);
    };
  }, [alive]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: breath.get() * -2 }, { scaleY: 1 + breath.get() * 0.02 }],
  }));

  return (
    <Animated.View style={style}>
      <Thumb pose={pose} width={width} />
      {lid > 0 ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
          {EYES.map((eye) => (
            <View
              key={eye.left}
              style={[styles.lid, eye, { height: `${6.5 * lid}%`, backgroundColor: LID }]}
            />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lid: { position: 'absolute', borderRadius: 8 },
});
