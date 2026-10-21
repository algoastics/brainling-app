import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion, radius, useTheme } from '@/theme';

import { easeStandard } from './motion';

/** Kit `dots()`: 8dp dots, the active one stretches to 20dp. Decorative; screens announce position. */
const Dot = memo(function Dot({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const w = useSharedValue(active ? 20 : 8);
  useEffect(() => {
    w.set(
      withTiming(active ? 20 : 8, {
        duration: reduceMotion ? 0 : motion.duration.quick,
        easing: easeStandard,
      }),
    );
  }, [active, reduceMotion, w]);
  const style = useAnimatedStyle(() => ({ width: w.get() }));
  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: active ? colors.primary : colors.line }, style]}
    />
  );
});

export const DesignDots = memo(function DesignDots({
  count,
  index,
}: {
  count: number;
  index: number;
}) {
  return (
    <View style={styles.row} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} active={i === index} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center', alignItems: 'center', height: 8 },
  dot: { height: 8, borderRadius: radius.pill },
});
