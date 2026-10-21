import { StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useReducedMotion,
} from 'react-native-reanimated';

import { motion, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

export type ToastTone = 'neutral' | 'good' | 'bad';

export type ToastProps = {
  visible: boolean;
  message: string;
  tone?: ToastTone;
};

/** C10 — Toast. Slides up from the bottom (fades under reduced motion) and is announced politely. */
export function Toast({ visible, message, tone = 'neutral' }: ToastProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  if (!visible) return null;

  const bg = tone === 'good' ? colors.goodSoft : tone === 'bad' ? colors.badSoft : colors.ink;
  const fg = tone === 'neutral' ? colors.bg : colors.ink;
  const entering = reduceMotion
    ? FadeIn.duration(150)
    : SlideInDown.duration(motion.duration.quick + 20);
  const exiting = reduceMotion
    ? FadeOut.duration(150)
    : SlideOutDown.duration(motion.duration.quick);

  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.toast, { backgroundColor: bg }]}
    >
      <Text variant="body.md" style={{ color: fg }}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: space[20],
    right: space[20],
    bottom: space[24],
    borderRadius: radius.md,
    paddingVertical: space[12],
    paddingHorizontal: space[16],
  },
});
