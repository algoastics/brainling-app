import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useReducedMotion } from '@/motion/useReducedMotion';

import { mixTokenSets } from './mixColors';
import { resolveScheme, useThemePreference, type ColorSchemeName } from './themePreference';
import { darkColors, lightColors, motion, type ColorTokens } from './tokens';

export type Theme = {
  scheme: ColorSchemeName;
  colors: ColorTokens;
};

const setFor = (scheme: ColorSchemeName): ColorTokens =>
  scheme === 'dark' ? darkColors : lightColors;

const ThemeContext = createContext<Theme>({ scheme: 'light', colors: lightColors });

type ThemeProviderProps = {
  /** Forces a scheme (e.g. the component preview or tests); otherwise Settings, Theme decides. */
  scheme?: ColorSchemeName;
  children: ReactNode;
};

type Fade = {
  target: ColorSchemeName;
  /** Colours on screen when this fade began. */
  from: ColorTokens;
  /** 0 to 1; 1 means the target colours are fully applied. */
  t: number;
  /** Bumps on every new fade so the animation effect restarts. */
  id: number;
};

const colorsOf = (fade: Fade): ColorTokens =>
  fade.t >= 1 ? setFor(fade.target) : mixTokenSets(fade.from, setFor(fade.target), fade.t);

/**
 * Cross-fades the colour tokens to `target` over `duration` ms (Figma A61). A change that arrives
 * mid-fade continues from the colours on screen. A duration of 0 swaps at once.
 */
function useFadedColors(target: ColorSchemeName, duration: number): ColorTokens {
  const [fade, setFade] = useState<Fade>(() => ({
    target,
    from: setFor(target),
    t: 1,
    id: 0,
  }));
  if (fade.target !== target) {
    setFade({
      target,
      from: colorsOf(fade),
      t: duration <= 0 ? 1 : 0,
      id: fade.id + 1,
    });
  }

  const running = fade.t < 1;
  const { id } = fade;
  useEffect(() => {
    if (!running) return undefined;
    const started = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - started) / duration);
      setFade((current) => (current.id === id ? { ...current, t } : current));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, id, duration]);

  return useMemo(() => colorsOf(fade), [fade]);
}

export function ThemeProvider({ scheme, children }: ThemeProviderProps) {
  const system = useColorScheme();
  const preference = useThemePreference((state) => state.preference);
  const reduced = useReducedMotion();
  const resolved = scheme ?? resolveScheme(preference, system);
  const colors = useFadedColors(resolved, reduced ? 0 : motion.duration.themeFade);
  const theme = useMemo(() => ({ scheme: resolved, colors }), [resolved, colors]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
