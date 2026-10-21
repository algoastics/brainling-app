import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { elevation, palette, radius, space, typography, useTheme, type ColorTokens } from '@/theme';

import { Text } from './Text';
import { usePressScale } from './usePressScale';

export type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'text' | 'good' | 'danger' | 'pro';
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

type KindStyle = { bg: string; fg: string; shade?: string; border?: string };

function kindStyle(kind: ButtonKind, c: ColorTokens): KindStyle {
  switch (kind) {
    case 'primary':
      return { bg: c.primary, fg: c.onPrimary, shade: c.primary2 };
    case 'secondary':
      return { bg: c.surface, fg: c.primary, shade: c.shadow, border: c.line };
    case 'ghost':
      return { bg: 'transparent', fg: c.primary, border: c.primary };
    case 'text':
      return { bg: 'transparent', fg: c.primary };
    case 'good':
      return { bg: c.good, fg: palette.ink900, shade: palette.mint700 };
    case 'danger':
      return { bg: c.bad, fg: palette.ink900, shade: palette.ember700 };
    case 'pro':
      return { bg: c.coin, fg: palette.ink900, shade: c.coinInk };
  }
}

const HEIGHT: Record<ButtonSize, number> = { lg: 54, sm: 40 };

/** C01 — Button. Pressed: shifts down 2dp, loses its offset shadow and scales to 0.97. */
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
  const k = kindStyle(kind, colors);
  const [focused, setFocused] = useState(false);
  const press = usePressScale();
  const inactive = disabled || loading;
  const height = HEIGHT[size];

  return (
    <Animated.View style={[press.animatedStyle, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        hitSlop={size === 'sm' ? 4 : 0}
      >
        {({ pressed }) => (
          <View
            style={[
              styles.ring,
              { borderRadius: radius.pill, borderColor: focused ? colors.primary : 'transparent' },
            ]}
          >
            <View style={{ paddingBottom: k.shade ? elevation.offsetY : 0 }}>
              {k.shade && !pressed && !inactive ? (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    styles.shade,
                    { backgroundColor: k.shade, top: elevation.offsetY, borderRadius: radius.pill },
                  ]}
                />
              ) : null}
              <View
                style={[
                  styles.face,
                  {
                    minHeight: height,
                    backgroundColor: k.bg,
                    borderColor: k.border ?? 'transparent',
                    paddingHorizontal: size === 'lg' ? space[24] : space[16],
                    transform: [{ translateY: pressed && k.shade ? 2 : 0 }],
                    opacity: disabled ? 0.45 : 1,
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={k.fg} />
                ) : (
                  <>
                    {icon}
                    <Text
                      style={[
                        size === 'lg' ? typography['body.lg'] : typography['body.sm'],
                        { color: k.fg },
                      ]}
                    >
                      {label}
                    </Text>
                    {iconRight}
                  </>
                )}
              </View>
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 2, padding: 3, margin: -5 },
  shade: { bottom: 0 },
  face: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
  },
});
