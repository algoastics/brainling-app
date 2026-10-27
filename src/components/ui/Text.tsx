import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { type, useTheme, type ColorTokens, type TypeVariant } from '@/theme';

export type TextProps = RNTextProps & {
  /** A Thumbwell type-scale name (`h2`, `body`, `label` ...). */
  variant?: TypeVariant;
  color?: keyof ColorTokens;
};

/** Themed text using the Thumbwell type scale. Scales with the system font size. */
export function Text({ variant = 'body', color = 'textPrimary', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return <RNText {...rest} style={[type[variant], { color: colors[color] }, style]} />;
}
