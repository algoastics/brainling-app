import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { bezier, haptics, useReducedMotion } from '@/motion';
import { elevationStyle, elevations, motion, radius, sizes, space, type, useTheme } from '@/theme';

export type TabBarItem = {
  key: string;
  label: string;
  /** Renders the icon. `focused` selects the filled variant (A55 cross-fades outline to filled). */
  icon?: (props: { focused: boolean; color: string }) => ReactNode;
};

export type TabBarProps = {
  items: readonly TabBarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  bottomInset?: number;
};

const PILL_IN = bezier(motion.easing.decelerate);
const PILL_OUT = bezier(motion.easing.accelerate);
/** Icon bounce spring: stiffness 400, damping ratio 0.55 (critical damping = 2 * sqrt(400)). */
const BOUNCE = { stiffness: 400, damping: 2 * 0.55 * Math.sqrt(400) };

function TabItem({
  item,
  focused,
  onSelect,
}: {
  item: TabBarItem;
  focused: boolean;
  onSelect: (key: string) => void;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(focused ? 1 : 0);
  const bounce = useSharedValue(1);
  const press = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.set(focused ? 1 : 0);
      bounce.set(1);
      return;
    }
    progress.set(
      focused
        ? withTiming(1, { duration: motion.duration.tabPillIn, easing: PILL_IN })
        : withTiming(0, { duration: motion.duration.tabPillOut, easing: PILL_OUT }),
    );
    if (focused) {
      bounce.set(withSequence(withTiming(1.12, { duration: 80 }), withSpring(1, BOUNCE)));
    }
  }, [focused, reduced, progress, bounce]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        scale: focused
          ? interpolate(progress.value, [0, 1], [0.6, 1])
          : interpolate(progress.value, [0, 1], [0.9, 1]),
      },
    ],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(bounce.value, [1, 1.12], [0, -3]) },
      { scale: bounce.value * (1 - 0.06 * press.value) },
    ],
  }));
  /** Outline fades out and filled fades in over the first 40 % of the pill (80 ms). */
  const outlineStyle = useAnimatedStyle(() => ({
    opacity: 1 - interpolate(progress.value, [0, 0.4], [0, 1]),
  }));
  const filledStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4], [0, 1]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.textMuted, colors.brandAccentText]),
  }));

  const color = focused ? colors.brandAccentText : colors.textMuted;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: focused }}
      onPressIn={() => {
        if (focused) return;
        haptics.light();
        press.set(1);
      }}
      onPressOut={() => press.set(0)}
      onPress={() => {
        if (!focused) onSelect(item.key);
      }}
      style={styles.tab}
    >
      <View style={styles.indicator}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.pill,
            { backgroundColor: colors.bgPrimarySoft },
            pillStyle,
          ]}
        />
        <Animated.View style={[styles.icons, iconStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, outlineStyle]}>
            {item.icon?.({ focused: false, color: colors.textMuted })}
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, filledStyle]}>
            {item.icon?.({ focused: true, color: colors.brandAccentText })}
          </Animated.View>
        </Animated.View>
      </View>
      <Animated.Text
        style={[type.caption, { color }, labelStyle]}
        numberOfLines={1}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {item.label}
      </Animated.Text>
    </Pressable>
  );
}

/**
 * Floating tab bar (Figma "Tab bar": a 64 dp pill on the screen background, 16 dp from the sides,
 * Elevation 2). The active tab has a 64x32 soft violet indicator behind its icon; switching plays
 * A55 (pill grows in, icon swaps outline to filled with a bounce, previous pill fades out).
 * Phase 0 has Home and Settings only; the Figma frame's extra tabs are not built.
 */
export function TabBar({ items, activeKey, onSelect, bottomInset = 0 }: TabBarProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.bgScreen, paddingBottom: Math.max(space[8], bottomInset) },
      ]}
    >
      <View
        accessibilityRole="tablist"
        style={[
          styles.bar,
          elevationStyle(elevations.toast),
          { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault },
        ]}
      >
        {items.map((item) => (
          <TabItem
            key={item.key}
            item={item}
            focused={item.key === activeKey}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space[16], paddingTop: space[8] },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.tabBarHeight,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space[8],
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingVertical: space[4],
  },
  indicator: {
    width: sizes.tabPillWidth,
    height: sizes.tabPillHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: { borderRadius: radius.pill },
  icons: { width: 24, height: 24 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
