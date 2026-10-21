import { memo, useEffect } from 'react';
import { StyleSheet, View, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui';

import { easeOut } from './motion';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

type ColumnProps = { digit: number; active: boolean; lineHeight: number; textStyle: TextStyle };

const DigitColumn = memo(function DigitColumn({
  digit,
  active,
  lineHeight,
  textStyle,
}: ColumnProps) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    const target = -digit * lineHeight;
    y.set(reduceMotion ? target : withTiming(target, { duration: 900, easing: easeOut }));
  }, [active, digit, lineHeight, reduceMotion, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <View style={{ height: lineHeight, overflow: 'hidden' }}>
      <Animated.View style={style}>
        {DIGITS.map((d) => (
          <Text key={d} style={[textStyle, styles.digit, { lineHeight, height: lineHeight }]}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
});

export type RollingNumberProps = {
  value: number;
  /** Starts the roll (A02 triggers when the card enters the viewport). */
  active: boolean;
  lineHeight: number;
  textStyle: TextStyle;
};

/** A02 counter roll: each digit column rolls 0 → N in 900 ms (ease-out), tabular numerals. */
export const RollingNumber = memo(function RollingNumber({
  value,
  active,
  lineHeight,
  textStyle,
}: RollingNumberProps) {
  const digits = String(Math.max(0, Math.round(value)))
    .split('')
    .map(Number);
  return (
    <View style={styles.row} accessible accessibilityLabel={String(value)}>
      {digits.map((d, i) => (
        <DigitColumn
          key={i}
          digit={d}
          active={active}
          lineHeight={lineHeight}
          textStyle={textStyle}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  digit: { fontVariant: ['tabular-nums'], textAlign: 'center' },
});
