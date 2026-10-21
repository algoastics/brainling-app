import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { palette, radius, space, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

export type StatusBannerProps = {
  tone: 'bad' | 'warn';
  icon: IconName;
  text: string;
  action?: { label: string; onPress: () => void };
};

/** Kit `banner()`: solid tone strip with icon, message and optional trailing action (S07-error, S10-intentfail). */
export const StatusBanner = memo(function StatusBanner({
  tone,
  icon,
  text,
  action,
}: StatusBannerProps) {
  const { colors } = useTheme();
  const fg = tone === 'bad' ? palette.white : palette.ink900;
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: tone === 'bad' ? colors.bad : colors.warn }]}
    >
      <Icon name={icon} size={22} color={fg} strokeWidth={2.4} />
      <Text variant="body.sm" style={[styles.text, { color: fg }]} accessibilityRole="alert">
        {text}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          hitSlop={12}
        >
          <Text variant="body.sm" style={{ color: fg }}>
            {action.label}
          </Text>
        </Pressable>
      ) : (
        <View />
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space[16],
    paddingVertical: space[12],
  },
  text: { flex: 1 },
});
