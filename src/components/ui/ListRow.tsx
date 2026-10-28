import { Children, useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/motion';
import { radius, sizes, space, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Switch } from './Switch';
import { Text } from './Text';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Leading 36 dp tile with a 24 dp icon (Figma "Group row": soft violet tile, radius 8). */
  icon?: IconName;
  /** Trailing value text, in the accent colour. */
  value?: string;
  /** Trailing glyph: a chevron (opens a screen) or the external-link mark (leaves the app). */
  trailing?: 'chevron' | 'external';
  /** A check mark in the trailing slot (picker rows). The slot is kept when unchecked. */
  checked?: boolean;
  /** Shows the check slot (24 dp) even when nothing is checked, so rows stay aligned. */
  selectable?: boolean;
  danger?: boolean;
  /** Makes the row a switch row (Figma 52x32 switch); `onSwitchChange` receives the new value. */
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  /** Dims the row and turns the switch off for touch; the saved value is kept. */
  switchDisabled?: boolean;
  onPress?: () => void;
  testID?: string;
};

const PRESS_IN_MS = 60;
const PRESS_OUT_MS = 150;

/** Row press tint (A60): the soft violet fades in over 60 ms and out over 150 ms. */
function PressTint({ pressed }: { pressed: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const alpha = useSharedValue(0);
  useEffect(() => {
    alpha.value = withTiming(pressed ? 1 : 0, {
      duration: reduced ? 0 : pressed ? PRESS_IN_MS : PRESS_OUT_MS,
    });
  }, [pressed, reduced, alpha]);
  const style = useAnimatedStyle(() => ({ opacity: alpha.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgPrimarySoft }, style]}
    />
  );
}

/**
 * List row (Figma "Group row"): optional icon tile, title and subtitle, value, chevron, check
 * or switch. 56 dp minimum, 16 dp sides, 12 dp gap. Divider lines belong to `ListGroup`.
 */
export function ListRow({
  title,
  subtitle,
  icon,
  value,
  trailing,
  checked,
  selectable = false,
  danger = false,
  switchValue,
  onSwitchChange,
  switchDisabled = false,
  onPress,
  testID,
}: ListRowProps) {
  const { colors } = useTheme();
  const ink = danger ? 'statusDangerStrong' : 'textPrimary';
  const content = (
    <>
      {icon ? (
        <View style={[styles.tile, { backgroundColor: colors.bgPrimarySoft }]}>
          <Icon name={icon} size={24} color={danger ? 'statusDangerStrong' : 'brandAccentText'} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="body" color={ink}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="label" color={onPress ? 'brandAccentText' : 'textSecondary'}>
          {value}
        </Text>
      ) : null}
      {switchValue !== undefined ? (
        <Switch
          testID={testID ? `${testID}-switch` : undefined}
          accessibilityLabel={title}
          value={switchValue}
          disabled={switchDisabled}
          onValueChange={onSwitchChange}
        />
      ) : null}
      {selectable || checked ? (
        <View style={styles.slot}>
          {checked ? <Icon name="check" size={24} color="brandAccentText" /> : null}
        </View>
      ) : null}
      {trailing ? (
        <Icon name={trailing === 'external' ? 'external' : 'chevron'} size={24} color="textMuted" />
      ) : null}
    </>
  );
  if (!onPress) {
    return (
      <View
        testID={testID}
        style={[styles.row, switchDisabled && styles.dimmed]}
        accessibilityState={switchDisabled ? { disabled: true } : undefined}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole={selectable ? 'radio' : 'button'}
      accessibilityLabel={value ? `${title}, ${value}` : title}
      accessibilityState={selectable ? { checked: Boolean(checked) } : undefined}
      onPress={onPress}
    >
      {({ pressed }) => (
        <View style={styles.row}>
          <PressTint pressed={pressed} />
          {content}
        </View>
      )}
    </Pressable>
  );
}

/**
 * A white group of rows (Figma "Settings group": radius 20, 1 dp border). The hairline between
 * rows is inset to the text start (16 dp) so it does not run under the icon tiles.
 */
export function ListGroup({ children, testID }: { children: ReactNode; testID?: string }) {
  const { colors } = useTheme();
  const rows = Children.toArray(children);
  return (
    <View
      testID={testID}
      style={[
        styles.group,
        { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault },
      ]}
    >
      {rows.map((row, i) => (
        <View key={i}>
          {row}
          {i < rows.length - 1 ? (
            <View style={styles.divider}>
              <View style={[styles.hairline, { backgroundColor: colors.borderDefault }]} />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * A titled section: header (caption, uppercase, muted), the group, then an optional footer
 * (Figma "Group header" / "Group footer").
 */
export function ListSection({
  title,
  footer,
  children,
  testID,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.caption} accessible accessibilityRole="header">
          <Text variant="overline" color="textMuted">
            {title.toUpperCase()}
          </Text>
        </View>
      ) : null}
      <ListGroup testID={testID}>{children}</ListGroup>
      {footer ? (
        <View style={styles.caption}>
          <Text variant="caption" color="textMuted">
            {footer}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  section: { gap: space[8] },
  caption: { paddingHorizontal: space[16] },
  row: {
    minHeight: sizes.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingHorizontal: space[16],
    paddingVertical: space[8],
  },
  divider: { paddingLeft: space[16], height: 1, flexDirection: 'row' },
  hairline: { flex: 1, height: 1 },
  dimmed: { opacity: 0.45 },
  tile: {
    width: 36,
    height: 36,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  slot: { width: 24, height: 24 },
});
