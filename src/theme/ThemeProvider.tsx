import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ColorTokens } from './tokens';

export type ColorSchemeName = 'light' | 'dark';

export type Theme = {
  scheme: ColorSchemeName;
  colors: ColorTokens;
};

const lightTheme: Theme = { scheme: 'light', colors: lightColors };
const darkTheme: Theme = { scheme: 'dark', colors: darkColors };

const ThemeContext = createContext<Theme>(lightTheme);

type ThemeProviderProps = {
  /** Forces a scheme (e.g. the component preview); defaults to the system setting. */
  scheme?: ColorSchemeName;
  children: ReactNode;
};

export function ThemeProvider({ scheme, children }: ThemeProviderProps) {
  const system = useColorScheme();
  const resolved: ColorSchemeName = scheme ?? (system === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => (resolved === 'dark' ? darkTheme : lightTheme), [resolved]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
