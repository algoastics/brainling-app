import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { maxFontScale, type, useTheme, type ColorTokens, type TypeVariant } from '@/theme';

export type TextProps = RNTextProps & {
  /** A Thumbwell type-scale name (`h2`, `body`, `label` ...). */
  variant?: TypeVariant;
  color?: keyof ColorTokens;
};

/**
 * Themed text using the Thumbwell type scale. Scales with the system font size, capped per style
 * (`maxFontScale`: 1.2 for titles, counters and buttons, 1.3 for reading text).
 */
export function Text({ variant = 'body', color = 'textPrimary', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={maxFontScale[variant]}
      {...rest}
      style={[type[variant], { color: colors[color] }, style]}
    />
  );
}
