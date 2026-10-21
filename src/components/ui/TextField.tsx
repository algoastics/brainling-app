import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { radius, space, typography, useTheme } from '@/theme';

import { Text } from './Text';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'editable'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  success?: string;
  disabled?: boolean;
  leftIcon?: ReactNode;
};

/** C02 — TextField with default / focus / error / success / disabled states. */
export function TextField({
  label,
  error,
  success,
  disabled = false,
  leftIcon,
  ...input
}: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.bad
    : success
      ? colors.good
      : focused
        ? colors.primary
        : colors.line;
  const message = error ?? success;

  return (
    <View style={[styles.root, { opacity: disabled ? 0.5 : 1 }]}>
      <Text variant="caption" color="ink2">
        {label}
      </Text>
      <View
        style={[
          styles.box,
          {
            borderColor,
            backgroundColor: disabled ? colors.surface2 : colors.surface,
            borderWidth: focused || error || success ? 2 : 1.5,
          },
        ]}
      >
        {leftIcon}
        <TextInput
          {...input}
          accessibilityLabel={label}
          editable={!disabled}
          placeholderTextColor={colors.muted}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[styles.input, typography['body.md'], { color: colors.ink }]}
        />
      </View>
      {message ? (
        <Text
          variant="caption"
          style={{ color: error ? colors.bad : colors.good }}
          accessibilityLiveRegion="polite"
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[8] },
  box: {
    minHeight: 52,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[16],
    gap: space[8],
  },
  input: { flex: 1, paddingVertical: space[12] },
});
