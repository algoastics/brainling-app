import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { bezier, useReducedMotion } from '@/motion';
import { elevationStyle, elevations, motion, radius, sizes, space, useTheme } from '@/theme';

import { Text } from './Text';
import { shouldDismissSheet, sheetDragOffset } from './sheetMotion';
import { useGetter } from './useGetter';

export type BottomSheetProps = {
  visible: boolean;
  /** Called after the sheet has closed itself (scrim tap, Back, drag down). */
  onDismiss: () => void;
  title: string;
  body?: string;
  children?: ReactNode;
  /** Buttons under the content (Figma "Actions"). */
  actions?: ReactNode;
  testID?: string;
};

const OPEN_EASING = bezier(motion.easing.decelerate);
const CLOSE_EASING = bezier(motion.easing.accelerate);
/** Figma sheet bottom padding is 32 dp; never less than the bottom inset (A56 safe area). */
const MIN_BOTTOM = space[32];

/**
 * Bottom sheet (Figma "Bottom sheet", A56): slides up over a scrim, drags down to dismiss,
 * closes on Back and on a scrim tap. Reduced motion fades in 100 ms with no slide, and the drag
 * still works because it is direct manipulation. The drag is a Gesture Handler pan on the UI
 * thread. A Modal is its own native window, so its content gets its own GestureHandlerRootView
 * (the sliders and the drag need it).
 */
export function BottomSheet({
  visible,
  onDismiss,
  title,
  body,
  children,
  actions,
  testID,
}: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const sheetHeight = useSharedValue(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const getDismiss = useGetter(onDismiss);

  useEffect(() => {
    clearTimeout(closeTimer.current);
    if (visible) {
      drag.set(0);
      progress.set(
        withTiming(1, {
          duration: reduced ? motion.duration.reducedFade : motion.duration.sheetOpen,
          easing: OPEN_EASING,
        }),
      );
      return;
    }
    cancelAnimation(drag);
    const ms = reduced ? motion.duration.reducedFade : motion.duration.sheetDismiss;
    progress.set(withTiming(0, { duration: ms, easing: CLOSE_EASING }));
    closeTimer.current = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(closeTimer.current);
  }, [visible, reduced, progress, drag]);

  const close = useCallback(() => getDismiss()(), [getDismiss]);

  const pan = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetY([-4, 4])
      .onUpdate((e) => {
        'worklet';
        drag.set(sheetDragOffset(e.translationY));
      })
      .onEnd((e) => {
        'worklet';
        if (shouldDismissSheet(e.translationY, e.velocityY / 1000, sheetHeight.get())) {
          scheduleOnRN(close);
        } else {
          drag.set(withSpring(0, { stiffness: 400, damping: 28 }));
        }
      })
      .onFinalize((_e, success) => {
        'worklet';
        if (!success) drag.set(withSpring(0, { stiffness: 400, damping: 28 }));
      });
  }, [drag, close, sheetHeight]);

  const sheetStyle = useAnimatedStyle(() => {
    const travel = sheetHeight.value || windowHeight;
    return reduced
      ? { opacity: progress.value, transform: [{ translateY: drag.value }] }
      : { transform: [{ translateY: (1 - progress.value) * travel + drag.value }] };
  });
  const scrimStyle = useAnimatedStyle(() => {
    const travel = sheetHeight.value || windowHeight;
    const dragged = Math.min(1, Math.max(0, drag.value / travel));
    return { opacity: progress.value * (1 - dragged) };
  });

  if (!mounted) return null;
  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlayScrim }, scrimStyle]}
        >
          <Pressable
            testID={testID ? `${testID}-scrim` : undefined}
            accessibilityRole="button"
            accessibilityLabel={title}
            onPress={close}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          onLayout={(e) => {
            sheetHeight.set(e.nativeEvent.layout.height);
          }}
          style={[
            styles.sheet,
            elevationStyle(elevations.sheet),
            {
              backgroundColor: colors.bgOverlay,
              paddingBottom: Math.max(MIN_BOTTOM, insets.bottom),
              maxHeight: windowHeight * 0.92,
            },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={styles.dragZone}>
              <View style={styles.handleArea}>
                <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
              </View>
              <View style={styles.header}>
                <Text variant="h2" accessibilityRole="header">
                  {title}
                </Text>
                {body ? <Text color="textSecondary">{body}</Text> : null}
              </View>
            </View>
          </GestureDetector>
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {children}
          </ScrollView>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space[12],
    paddingHorizontal: space[16],
    gap: space[16],
  },
  dragZone: { gap: space[16] },
  handleArea: { alignItems: 'center', paddingBottom: space[4] },
  handle: { width: sizes.grabberWidth, height: 4, borderRadius: radius.pill },
  header: { gap: space[4], paddingHorizontal: space[8] },
  content: { flexGrow: 0, flexShrink: 1 },
  contentInner: { gap: space[16] },
  actions: { gap: space[8] },
});
