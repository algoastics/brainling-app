import { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { bezier, haptics, useReducedMotion } from '@/motion';
import { motion, radius, sizes, useTheme } from '@/theme';

import { useGetter } from './useGetter';
import { positionOfValue, snapToStep, valueAtPosition } from './sliderMath';

export type SliderProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  testID?: string;
};

const GRAB_EASING = bezier(motion.easing.decelerate);
const TICK_GAP_MS = 30;
const clockMs = () => Date.now();

/**
 * Slider (Figma "Slider": 8 dp track, 28 dp thumb, 48 dp touch height, A57). Follows the finger
 * and snaps to steps, with a selection tick per step crossed (at most one per 30 ms) and a light
 * impact at either end. The thumb grows to 1.15 on grab. Values outside the range pin to an end.
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  accessibilityLabel,
  testID,
}: SliderProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const grab = useSharedValue(1);
  const lastTick = useSharedValue(0);
  const getProps = useGetter({ width, min, max, step, onChange, value });

  const pan = useMemo(() => {
    const moveTo = (x: number) => {
      const { width: w, min: lo, max: hi, step: s, onChange: emit, value: now } = getProps();
      const next = valueAtPosition(x, w, lo, hi, s);
      if (next === snapToStep(now, lo, hi, s)) return;
      const time = clockMs();
      if (next === lo || next === hi) haptics.light();
      else if (time - lastTick.get() >= TICK_GAP_MS) haptics.selection();
      lastTick.set(time);
      emit(next);
    };
    const release = () => grab.set(withTiming(1, { duration: reduced ? 0 : 100 }));
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        grab.set(withTiming(1.15, { duration: reduced ? 0 : 100, easing: GRAB_EASING }));
        moveTo(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e) => moveTo(e.nativeEvent.locationX),
      onPanResponderRelease: release,
      onPanResponderTerminate: release,
    });
  }, [grab, reduced, getProps, lastTick]);

  const fraction = positionOfValue(value, min, max);
  const thumbX = fraction * Math.max(0, width - sizes.sliderThumb);
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ scale: grab.value }] }));

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: snapToStep(value, min, max, step) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const dir = e.nativeEvent.actionName === 'increment' ? 1 : -1;
        onChange(snapToStep(value + dir * step, min, max, step));
      }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.root}
      {...pan.panHandlers}
    >
      <View style={[styles.track, { backgroundColor: colors.borderStrong }]} pointerEvents="none">
        <View
          style={[
            styles.active,
            { width: thumbX + sizes.sliderThumb / 2, backgroundColor: colors.brandPrimary },
          ]}
        />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          { left: thumbX, backgroundColor: colors.brandPrimary, borderColor: colors.bgSurface },
          thumbStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: sizes.touchMin, justifyContent: 'center', width: '100%' },
  track: { height: sizes.sliderTrack, borderRadius: radius.pill, overflow: 'hidden' },
  active: { height: sizes.sliderTrack, borderRadius: radius.pill },
  thumb: {
    position: 'absolute',
    width: sizes.sliderThumb,
    height: sizes.sliderThumb,
    borderRadius: sizes.sliderThumb / 2,
    borderWidth: 3,
  },
});
