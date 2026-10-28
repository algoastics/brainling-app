import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { bezier, haptics, useReducedMotion } from '@/motion';
import { maxFontScale, motion, radius, sizes, space, type, useTheme } from '@/theme';

export type TabBarItem = {
  key: string;
  label: string;
  /**
   * Renders the icon. `focused` selects the active variant (A55 cross-fades inactive to active);
   * `active` is true only while this tab is selected and starts the icon's part animation (A98).
   */
  icon?: (props: { focused: boolean; color: string; active: boolean }) => ReactNode;
};

export type TabBarProps = {
  items: readonly TabBarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  /** Real bottom safe-area inset (system navigation area); the bar adds no margin of its own. */
  bottomInset?: number;
};

/** A55: the pill grows from its centre outward, 180 ms, ease-out cubic, no overshoot. */
const PILL_IN = Easing.out(Easing.cubic);
const PILL_OUT = bezier(motion.easing.accelerate);
const BAR_HEIGHT = 88;

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
  const press = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.set(focused ? 1 : 0);
      return;
    }
    progress.set(
      focused
        ? withTiming(1, { duration: motion.duration.tabPillIn, easing: PILL_IN })
        : withTiming(0, { duration: motion.duration.tabPillOut, easing: PILL_OUT }),
    );
  }, [focused, reduced, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: focused ? 1 : progress.value,
    transform: [{ scaleX: focused ? progress.value : 1 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.06 * press.value }],
  }));
  /** Inactive fades out and active fades in over the first 40 % of the pill (72 ms). */
  const outlineStyle = useAnimatedStyle(() => ({
    opacity: 1 - interpolate(progress.value, [0, 0.4], [0, 1]),
  }));
  const filledStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4], [0, 1]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.textSecondary, colors.brandAccentText]),
  }));

  const color = focused ? colors.brandAccentText : colors.textSecondary;
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
            {item.icon?.({ focused: false, color: colors.textSecondary, active: false })}
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, filledStyle]}>
            {item.icon?.({ focused: true, color: colors.brandAccentText, active: focused })}
          </Animated.View>
        </Animated.View>
      </View>
      <Animated.Text
        style={[type.caption, { color }, labelStyle]}
        maxFontSizeMultiplier={maxFontScale.caption}
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
 * Tab bar (Figma "Tab bar" 14:83): flush to the bottom edge, 88 dp high, 20 dp top corners, raised
 * surface with a 1 dp top border. The active tab has a 64x32 soft violet indicator behind its
 * icon; switching plays A55 (pill grows from its centre in 180 ms, previous pill fades out) and
 * A98 (the active icon's named part animates in 220 ms). Reduced motion swaps instantly.
 * Only the real bottom inset is padded below the items, and as the bar takes its own height in
 * the layout, screen content ends above it.
 * Phase 0 has Home and Settings only; the Figma frame's extra tabs are not built.
 */
export function TabBar({ items, activeKey, onSelect, bottomInset = 0 }: TabBarProps) {
  const { colors } = useTheme();
  return (
    <View
      testID="tab-bar"
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: colors.bgSurfaceRaised,
          borderColor: colors.borderDefault,
          paddingBottom: bottomInset,
        },
      ]}
    >
      {items.map((item) => (
        <TabItem key={item.key} item={item} focused={item.key === activeKey} onSelect={onSelect} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: BAR_HEIGHT,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    paddingTop: space[8],
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
