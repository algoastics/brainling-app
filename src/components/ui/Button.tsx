import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { haptics, pressTo, useReducedMotion } from '@/motion';
import { radius, sizes, space, useTheme, type ColorTokens } from '@/theme';

import { Text } from './Text';

export type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'text' | 'good' | 'pro';
export type ButtonSize = 'lg' | 'sm';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: ViewStyle;
};

type KindStyle = { face: string; fg: string; edge?: string; border?: string };

function kindStyle(kind: ButtonKind, c: ColorTokens, inactive: boolean): KindStyle {
  if (inactive && kind !== 'ghost' && kind !== 'text') {
    return { face: c.bgSurface2, fg: c.textMuted, edge: c.borderStrong };
  }
  switch (kind) {
    case 'primary':
    case 'pro':
      return { face: c.brandPrimary, fg: c.brandOnPrimary, edge: c.brandPrimaryEdge };
    case 'secondary':
      return {
        face: c.bgSurface,
        fg: c.brandAccentText,
        edge: c.borderStrong,
        border: c.borderStrong,
      };
    case 'danger':
      return { face: c.statusDangerStrong, fg: c.statusOnDanger, edge: c.statusDangerEdge };
    case 'good':
      return { face: c.statusGood, fg: c.statusOnDanger, edge: c.statusGoodText };
    case 'ghost':
      return {
        face: 'transparent',
        fg: inactive ? c.textMuted : c.brandAccentText,
      };
    case 'text':
      return { face: 'transparent', fg: inactive ? c.textMuted : c.brandAccentText };
  }
}

/**
 * Button (Figma "Button": lg 52 / sm 40, radius 16). Solid kinds sit on a 4dp "edge" in a darker
 * tone; on press (A50) only the face travels down 3dp so the lip shrinks to 1dp. The haptic fires
 * on press-in (Medium for the primary CTA, Light otherwise). Reduced motion: no travel, the face
 * swaps to the edge colour while pressed.
 */
export function Button({
  label,
  onPress,
  kind = 'primary',
  size = 'lg',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const inactive = disabled || loading;
  const k = kindStyle(kind, colors, disabled);
  const height = size === 'lg' ? sizes.buttonHeight : sizes.buttonHeightSm;
  const hasEdge = k.edge !== undefined;
  const reduced = useReducedMotion();
  const press = useSharedValue(0);
  const faceMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: press.value * sizes.buttonPressTravel }],
  }));
  const heavy = kind === 'primary' || kind === 'pro';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => {
        if (heavy) haptics.medium();
        else haptics.light();
        pressTo(press, true, reduced);
      }}
      onPressOut={() => pressTo(press, false, reduced)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      hitSlop={size === 'sm' ? 4 : 0}
      style={[
        styles.root,
        focused && { borderColor: colors.brandPrimary, borderWidth: 2, margin: -2 },
        style,
      ]}
    >
      {({ pressed }) => {
        const down = pressed && !inactive;
        const face = reduced && down ? (k.edge ?? k.face) : k.face;
        return (
          <View
            style={[
              styles.edge,
              {
                backgroundColor: k.edge ?? 'transparent',
                height: height + (hasEdge ? sizes.buttonEdge : 0),
              },
            ]}
          >
            <Animated.View
              style={[
                styles.face,
                {
                  height,
                  backgroundColor: face,
                  borderColor: k.border ?? 'transparent',
                  borderWidth: k.border ? 1.5 : 0,
                  paddingHorizontal: size === 'lg' ? space[24] : space[16],
                  opacity: !hasEdge && down ? 0.7 : 1,
                },
                hasEdge && !reduced ? faceMotion : null,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={k.fg} />
              ) : (
                <>
                  {icon}
                  <Text variant="button" style={{ color: k.fg }}>
                    {label}
                  </Text>
                  {iconRight}
                </>
              )}
            </Animated.View>
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.md },
  edge: { borderRadius: radius.md, overflow: 'hidden' },
  face: {
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
  },
});
