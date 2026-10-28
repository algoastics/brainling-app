import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { bezier, haptics, useReducedMotion } from '@/motion';
import { elevationStyle, elevations, motion, radius, sizes, useTheme } from '@/theme';

import {
  grabAtTouch,
  markCenter,
  offsetAtFinger,
  offsetForTap,
  offsetOfValue,
  snapToStep,
  thumbTravel,
  valueAtOffset,
} from './sliderMath';
import { useGetter } from './useGetter';

export type SliderProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  /** Snap marks drawn on the track (Figma "Snap 30 / 60 / 100 / 150"). */
  marks?: readonly number[];
  testID?: string;
};

/** Figma pressed state: 32 dp thumb on a 52 dp halo, against 28 dp at rest. */
const PRESSED_THUMB = 32;
const HALO = 52;
const MARK_SIZE = 4;
const TICK_GAP_MS = 30;
const SETTLE_EASING = bezier(motion.easing.decelerate);
const THUMB = sizes.sliderThumb;

function Mark({
  center,
  offset,
  onFill,
  rest,
}: {
  center: number;
  offset: SharedValue<number>;
  onFill: string;
  rest: string;
}) {
  const style = useAnimatedStyle(() => ({
    backgroundColor: center <= offset.get() + THUMB / 2 ? onFill : rest,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.mark, { left: center - MARK_SIZE / 2 }, style]}
    />
  );
}

function applyFinger(
  x: number,
  grab: number,
  travel: number,
  min: number,
  max: number,
  step: number,
  offset: SharedValue<number>,
  stepped: SharedValue<number>,
  commit: (next: number) => void,
): void {
  'worklet';
  const next = offsetAtFinger(x, grab, travel, THUMB);
  offset.set(next);
  const v = valueAtOffset(next, travel, min, max, step);
  if (v !== stepped.get()) {
    stepped.set(v);
    scheduleOnRN(commit, v);
  }
}

/**
 * Slider (Figma "Slider", 328 x 48: 8 dp track, 28 dp white thumb with a 4 dp brand ring, snap
 * marks, pressed state with a 52 dp halo; A57). The thumb is driven from the finger's absolute
 * `x` on the track (Gesture Handler pan, Reanimated shared values): a grab captured at
 * touch-down keeps the thumb from jumping, then every update is that `x` plus the grab, clamped
 * to the track, so the thumb cannot run ahead of the finger. React state changes only when the
 * stepped value changes, with a selection tick per step (at most one per 30 ms) and a light
 * impact at either end. A tap on the track moves the thumb there. On release the thumb settles
 * on the step. The vertical scroll of a parent still wins when the first move is mostly vertical.
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  accessibilityLabel,
  marks,
  testID,
}: SliderProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const offset = useSharedValue(0);
  const travel = useSharedValue(0);
  const touchGrab = useSharedValue(0);
  const stepped = useSharedValue(snapToStep(value, min, max, step));
  const dragging = useSharedValue(false);
  const press = useSharedValue(0);
  const getProps = useGetter({ onChange, reduced });
  const settleMs = reduced ? 0 : motion.duration.fast;

  // React side of a step change: haptic tick, then the new value.
  const lastTick = useSharedValue(0);
  const commit = useCallback(
    (next: number) => {
      const now = Date.now();
      if (next === min || next === max) haptics.light();
      else if (now - lastTick.get() >= TICK_GAP_MS) haptics.selection();
      lastTick.set(now);
      getProps().onChange(next);
    },
    [getProps, lastTick, min, max],
  );

  // Measured width, then a value change from outside (steppers, presets): move the thumb unless
  // the finger is on it.
  useEffect(() => {
    const t = thumbTravel(width, THUMB);
    const first = travel.get() === 0 && t > 0;
    travel.set(t);
    // While the finger is down the UI thread owns both the offset and the stepped value; React's
    // copy of the value only catches up, so it must not overwrite them.
    if (dragging.get()) return;
    stepped.set(snapToStep(value, min, max, step));
    const target = offsetOfValue(value, min, max, t);
    offset.set(first || getProps().reduced ? target : withTiming(target, { duration: settleMs }));
  }, [width, value, min, max, step, travel, stepped, dragging, offset, getProps, settleMs]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .maxPointers(1)
      .activeOffsetX([-4, 4])
      .failOffsetY([-16, 16])
      .onBegin((e) => {
        'worklet';
        cancelAnimation(offset);
        touchGrab.set(grabAtTouch(offset.get(), e.x, THUMB));
      })
      .onStart((e) => {
        'worklet';
        dragging.set(true);
        press.set(withTiming(1, { duration: settleMs, easing: SETTLE_EASING }));
        applyFinger(e.x, touchGrab.get(), travel.get(), min, max, step, offset, stepped, commit);
      })
      .onUpdate((e) => {
        'worklet';
        applyFinger(e.x, touchGrab.get(), travel.get(), min, max, step, offset, stepped, commit);
      })
      .onFinalize(() => {
        'worklet';
        if (!dragging.get()) return;
        dragging.set(false);
        press.set(withTiming(0, { duration: settleMs }));
        offset.set(
          withTiming(offsetOfValue(stepped.get(), min, max, travel.get()), { duration: settleMs }),
        );
      });
    const tap = Gesture.Tap()
      .maxDistance(8)
      .onEnd((e, success) => {
        'worklet';
        if (!success) return;
        const to = offsetForTap(e.x, travel.get(), THUMB);
        const v = valueAtOffset(to, travel.get(), min, max, step);
        offset.set(withTiming(offsetOfValue(v, min, max, travel.get()), { duration: settleMs }));
        if (v !== stepped.get()) {
          stepped.set(v);
          scheduleOnRN(commit, v);
        }
      });
    return Gesture.Race(pan, tap);
  }, [offset, travel, touchGrab, stepped, dragging, press, settleMs, commit, min, max, step]);

  const fillStyle = useAnimatedStyle(() => ({ width: offset.get() + THUMB / 2 }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.get() },
      { scale: 1 + press.get() * (PRESSED_THUMB / THUMB - 1) },
    ],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: press.get(),
    transform: [
      { translateX: offset.get() - (HALO - THUMB) / 2 },
      { scale: 0.5 + press.get() * 0.5 },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
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
      >
        <View
          style={[
            styles.track,
            { backgroundColor: colors.bgPrimarySoft, borderColor: colors.borderDefault },
          ]}
          pointerEvents="none"
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.fill, { backgroundColor: colors.brandPrimary }, fillStyle]}
        />
        {width > 0
          ? (marks ?? []).map((m) => (
              <Mark
                key={m}
                center={markCenter(m, min, max, width, THUMB)}
                offset={offset}
                onFill={colors.brandOnPrimary}
                rest={colors.textMuted}
              />
            ))
          : null}
        <Animated.View
          pointerEvents="none"
          style={[styles.halo, { backgroundColor: colors.brandPrimary }, haloStyle]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            elevationStyle(elevations.card),
            { backgroundColor: '#FFFFFF', borderColor: colors.brandPrimary },
            thumbStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { height: sizes.touchMin, justifyContent: 'center', width: '100%' },
  track: { height: sizes.sliderTrack, borderRadius: radius.pill, borderWidth: 1 },
  fill: {
    position: 'absolute',
    left: 0,
    top: (sizes.touchMin - sizes.sliderTrack) / 2,
    height: sizes.sliderTrack,
    borderRadius: radius.pill,
  },
  mark: {
    position: 'absolute',
    top: (sizes.touchMin - MARK_SIZE) / 2,
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
  },
  halo: {
    position: 'absolute',
    left: 0,
    top: (sizes.touchMin - HALO) / 2,
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: (sizes.touchMin - sizes.sliderThumb) / 2,
    width: sizes.sliderThumb,
    height: sizes.sliderThumb,
    borderRadius: sizes.sliderThumb / 2,
    borderWidth: 4,
  },
});
