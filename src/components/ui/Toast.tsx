import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useReducedMotion,
} from 'react-native-reanimated';

import { elevations, motion, radius, space, useTheme } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

export type ToastKind = 'message' | 'action' | 'error';
/** @deprecated Old tone names: neutral/good map to `message`, bad to `error`. */
export type ToastTone = 'neutral' | 'good' | 'bad';

export type ToastProps = {
  visible: boolean;
  message: string;
  kind?: ToastKind;
  tone?: ToastTone;
  /** Trailing action for `kind="action"` (e.g. Undo). */
  action?: { label: string; onPress: () => void };
};

/**
 * Toast (Figma "Toast": surface, 1.5dp strong border, radius 16, check or info icon, optional
 * accent action). Slides up from the bottom (fades under reduced motion); announced politely.
 */
export function Toast({ visible, message, kind, tone = 'neutral', action }: ToastProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  if (!visible) return null;

  const resolved: ToastKind = kind ?? (tone === 'bad' ? 'error' : action ? 'action' : 'message');
  const entering = reduceMotion
    ? FadeIn.duration(150)
    : SlideInDown.duration(motion.duration.quick + 20);
  const exiting = reduceMotion
    ? FadeOut.duration(150)
    : SlideOutDown.duration(motion.duration.quick);
  const shadow = elevations.toast;

  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.toast,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderStrong,
          shadowColor: shadow.color,
          shadowOpacity: shadow.opacity,
          shadowRadius: shadow.radius / 2,
          shadowOffset: { width: 0, height: shadow.offsetY },
        },
      ]}
    >
      <Icon
        name={resolved === 'error' ? 'info' : 'check'}
        color={resolved === 'error' ? 'statusDangerStrong' : 'statusGoodText'}
      />
      <Text variant="label" style={styles.message}>
        {message}
      </Text>
      {resolved === 'action' && action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={8}>
          <View>
            <Text variant="button" color="brandAccentText">
              {action.label}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: space[16],
    right: space[16],
    bottom: space[24],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingVertical: space[12],
    paddingHorizontal: space[16],
    elevation: 4,
  },
  message: { flex: 1 },
});
