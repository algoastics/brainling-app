import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { typography, useTheme, type ColorTokens, type TypographyVariant } from '@/theme';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: keyof ColorTokens;
};

/** Themed text using the design-kit type scale. Scales with the system font size. */
export function Text({ variant = 'body.md', color = 'ink', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return <RNText {...rest} style={[typography[variant], { color: colors[color] }, style]} />;
}
