import * as Haptics from 'expo-haptics';
import { memo, useCallback, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { Mascot } from '@/components/mascot';
import { Text } from '@/components/ui';
import { palette, radius, useTheme } from '@/theme';

import { guessMascotState, snap } from '../flow';

export type GuessSliderProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  valueText: string;
  minLabel: string;
  maxLabel: string;
};

const THUMB = 28;
const MASCOT = 84;

/**
 * S03 "Guess your daily reels" slider: 10dp track, white thumb with a primary ring and the mascot
 * riding under it. Re-renders only when the snapped value changes; TalkBack uses adjustable actions.
 */
export const GuessSlider = memo(function GuessSlider({
  value,
  min,
  max,
  step,
  onChange,
  accessibilityLabel,
  valueText,
  minLabel,
  maxLabel,
}: GuessSliderProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const track = useRef<ComponentRef<typeof View>>(null);
  const originX = useRef(0);
  const latest = useRef({ value, width, onChange });
  latest.current = { value, width, onChange };

  const update = useCallback(
    (pageX: number) => {
      const { width: w, value: v, onChange: emit } = latest.current;
      if (w <= 0) return;
      const ratio = Math.min(1, Math.max(0, (pageX - originX.current) / w));
      const next = snap(min + ratio * (max - min), min, max, step);
      if (next === v) return;
      if (next % 50 === 0) Haptics.selectionAsync();
      latest.current.value = next;
      emit(next);
    },
    [max, min, step],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          track.current?.measureInWindow((x) => {
            originX.current = x;
            update(e.nativeEvent.pageX);
          });
        },
        onPanResponderMove: (e) => update(e.nativeEvent.pageX),
      }),
    [update],
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
    track.current?.measureInWindow((x) => {
      originX.current = x;
    });
  }, []);

  const onAction = useCallback(
    (e: AccessibilityActionEvent) => {
      const dir = e.nativeEvent.actionName === 'increment' ? 1 : -1;
      onChange(snap(value + dir * step, min, max, step));
    },
    [max, min, onChange, step, value],
  );

  const ratio = (value - min) / (max - min);
  const x = ratio * width;

  return (
    <View>
      <View
        ref={track}
        onLayout={onLayout}
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min, max, now: value, text: valueText }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction}
        hitSlop={{ top: 16, bottom: 16 }}
        style={styles.hit}
      >
        <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
          <View
            style={[styles.fill, { width: Math.max(10, x), backgroundColor: colors.primary }]}
          />
        </View>
        <View
          style={[
            styles.thumb,
            { left: x - THUMB / 2, borderColor: colors.primary, backgroundColor: palette.white },
          ]}
        />
      </View>
      <View style={styles.below} importantForAccessibility="no-hide-descendants">
        <View
          style={[
            styles.mascot,
            { left: Math.min(Math.max(x - MASCOT / 2, 0), Math.max(0, width - MASCOT)) },
          ]}
        >
          <Mascot state={guessMascotState(value)} size={MASCOT} />
        </View>
        <Text variant="caption" color="muted" style={styles.min}>
          {minLabel}
        </Text>
        <Text variant="caption" color="muted" style={styles.max}>
          {maxLabel}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  hit: { height: THUMB, justifyContent: 'center' },
  track: { height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 10, borderRadius: radius.pill },
  thumb: {
    position: 'absolute',
    top: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
  },
  below: { height: MASCOT + 8 },
  mascot: { position: 'absolute', top: 4 },
  min: { position: 'absolute', left: 0, bottom: 0 },
  max: { position: 'absolute', right: 0, bottom: 0 },
});
