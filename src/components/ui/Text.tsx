import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import {
  type,
  typography,
  useTheme,
  type ColorTokens,
  type TypeVariant,
  type TypographyVariant,
} from '@/theme';

export type TextProps = RNTextProps & {
  /** A Thumbwell type-scale name (`h2`, `body`, `label` ...) or an old dotted variant. */
  variant?: TypeVariant | TypographyVariant;
  color?: keyof ColorTokens;
};

function styleFor(variant: TypeVariant | TypographyVariant) {
  return variant in type ? type[variant as TypeVariant] : typography[variant as TypographyVariant];
}

/** Themed text using the Thumbwell type scale. Scales with the system font size. */
export function Text({ variant = 'body', color = 'textPrimary', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return <RNText {...rest} style={[styleFor(variant), { color: colors[color] }, style]} />;
}
