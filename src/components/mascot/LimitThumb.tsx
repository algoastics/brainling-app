import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/motion';

import { Thumb } from './Thumb';
import { thumbPoseForLimit, type LimitThumbPose } from './thumbState';

const POSES = ['glowing', 'happy', 'meh'] as const satisfies readonly LimitThumbPose[];
/** A58 pop: stiffness 400, damping ratio 0.6. */
const POP_SPRING = { stiffness: 400, damping: 2 * 0.6 * Math.sqrt(400) };

/**
 * Daily-limit Thumb (A58). The pose follows the value being chosen: glowing through 40, happy
 * through 100, meh above that. A pose change cross-fades and pops; reduced motion swaps at once.
 */
export function LimitThumb({ value, width = 96 }: { value: number; width?: number }) {
  const reduced = useReducedMotion();
  const pose = thumbPoseForLimit(value);
  const glowing = useSharedValue(pose === 'glowing' ? 1 : 0);
  const happy = useSharedValue(pose === 'happy' ? 1 : 0);
  const meh = useSharedValue(pose === 'meh' ? 1 : 0);
  const scale = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    const duration = reduced ? 0 : 150;
    glowing.set(withTiming(pose === 'glowing' ? 1 : 0, { duration }));
    happy.set(withTiming(pose === 'happy' ? 1 : 0, { duration }));
    meh.set(withTiming(pose === 'meh' ? 1 : 0, { duration }));
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) {
      scale.set(1);
      return;
    }
    scale.set(withSequence(withTiming(1.06, { duration: 100 }), withSpring(1, POP_SPRING)));
  }, [pose, reduced, glowing, happy, meh, scale]);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const glowingStyle = useAnimatedStyle(() => ({ opacity: glowing.get() }));
  const happyStyle = useAnimatedStyle(() => ({ opacity: happy.get() }));
  const mehStyle = useAnimatedStyle(() => ({ opacity: meh.get() }));
  const layer = { glowing: glowingStyle, happy: happyStyle, meh: mehStyle };

  return (
    <Animated.View accessibilityElementsHidden importantForAccessibility="no" style={scaleStyle}>
      <View>
        {POSES.map((name) => (
          <Animated.View
            key={name}
            pointerEvents="none"
            style={[name === 'glowing' ? undefined : styles.stack, layer[name]]}
          >
            <Thumb pose={name} width={width} decorative />
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', left: 0, top: 0 },
});
