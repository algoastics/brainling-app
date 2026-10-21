/**
 * Brainling design tokens, ported from brainling-design/code/theme.ts and
 * tokens/brainling.tokens.json. Never hard-code hex values in components; read them from here.
 *
 * Deviation from the kit: light `muted` is darkened from #7C7598 (4.1:1 on bg) to #6E6789
 * (5.0:1 on bg, 4.7:1 on surface2) so it can be used for body text (handoff §5).
 */
export const palette = {
  violet50: '#F4F1FF',
  violet100: '#E7E1FF',
  violet300: '#B7A8FF',
  violet500: '#7B61FF',
  violet600: '#6B4EFF',
  violet700: '#5236E0',
  violet900: '#2A1C7A',
  pink50: '#FFF0F6',
  pink100: '#FFD9E8',
  pink300: '#FFB8D2',
  pink500: '#FF8FB8',
  pink600: '#F2588F',
  pink800: '#B8335F',
  mint50: '#E9FBF4',
  mint100: '#CFF6E8',
  mint500: '#22C993',
  mint700: '#129A6E',
  sun50: '#FFF9E6',
  sun100: '#FFF0C2',
  sun500: '#FFC233',
  sun700: '#D99A00',
  ember50: '#FFF1EC',
  ember100: '#FFE0D5',
  ember500: '#FF6B3D',
  ember700: '#D9461A',
  ember900: '#8A2A0E',
  zombie300: '#C5D3BC',
  zombie500: '#9BB08F',
  zombie700: '#6E8463',
  ice100: '#DDF2FF',
  ice500: '#8FD3FF',
  ice700: '#3E9BD6',
  ink900: '#17122E',
  ink700: '#3F3860',
  ink500: '#7C7598',
  ink300: '#BDB8D1',
  ink200: '#E6E2F0',
  ink100: '#F2EFFA',
  ink50: '#FAF8FF',
  white: '#FFFFFF',
  night900: '#0E0B1F',
  night800: '#1A1533',
  night700: '#241E42',
  night600: '#332C55',
  outline: '#22183F',
  gold: '#FFD45C',
  gold700: '#C9971C',
} as const;

export type ColorTokens = {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  muted: string;
  line: string;
  primary: string;
  primary2: string;
  primarySoft: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  good: string;
  goodSoft: string;
  warn: string;
  warnSoft: string;
  bad: string;
  badSoft: string;
  info: string;
  infoSoft: string;
  coin: string;
  coinInk: string;
  scrim: string;
  shadow: string;
  nav: string;
};

export const lightColors: ColorTokens = {
  bg: '#FAF8FF',
  surface: '#FFFFFF',
  surface2: '#F2EFFA',
  ink: '#17122E',
  ink2: '#3F3860',
  muted: '#6E6789',
  line: '#E6E2F0',
  primary: '#6B4EFF',
  primary2: '#5236E0',
  primarySoft: '#E7E1FF',
  onPrimary: '#FFFFFF',
  accent: '#FF8FB8',
  accentSoft: '#FFD9E8',
  good: '#22C993',
  goodSoft: '#CFF6E8',
  warn: '#FFC233',
  warnSoft: '#FFF0C2',
  bad: '#FF6B3D',
  badSoft: '#FFE0D5',
  info: '#3E9BD6',
  infoSoft: '#DDF2FF',
  coin: '#FFC233',
  coinInk: '#D99A00',
  scrim: '#17122E',
  shadow: '#DCD6EE',
  nav: '#FFFFFF',
};

export const darkColors: ColorTokens = {
  bg: '#0E0B1F',
  surface: '#1A1533',
  surface2: '#241E42',
  ink: '#F4F1FF',
  ink2: '#CFC8EA',
  muted: '#9A93B8',
  line: '#332C55',
  primary: '#8C75FF',
  primary2: '#A897FF',
  primarySoft: '#2E2566',
  onPrimary: '#FFFFFF',
  accent: '#FF8FB8',
  accentSoft: '#45213A',
  good: '#3ADBA6',
  goodSoft: '#123D33',
  warn: '#FFCC55',
  warnSoft: '#3D3214',
  bad: '#FF825C',
  badSoft: '#43221A',
  info: '#8FD3FF',
  infoSoft: '#16324A',
  coin: '#FFC233',
  coinInk: '#D99A00',
  scrim: '#000000',
  shadow: '#07050F',
  nav: '#1A1533',
};

export type MascotState =
  'glowing' | 'happy' | 'meh' | 'fried' | 'zombie' | 'sleeping' | 'recovering';

export type MascotColorSet = { body: string; fold: string; highlight: string; ui: string };

export const mascotColors: Record<MascotState | 'ghost', MascotColorSet> = {
  glowing: { body: '#FF9EC4', fold: '#F06C9F', highlight: '#FFD3E4', ui: '#FF8FB8' },
  happy: { body: '#FFB3CC', fold: '#EC7FA5', highlight: '#FFE0EB', ui: '#22C993' },
  meh: { body: '#E8B9C9', fold: '#C48C9F', highlight: '#F3D9E1', ui: '#FFC233' },
  fried: { body: '#F0A27E', fold: '#C4643E', highlight: '#F9CDB5', ui: '#FF6B3D' },
  zombie: { body: '#A9BC9C', fold: '#748A69', highlight: '#CBD8C2', ui: '#9BB08F' },
  sleeping: { body: '#E7AFD0', fold: '#B97BA4', highlight: '#F5D6E7', ui: '#B7A8FF' },
  recovering: { body: '#F7BDD0', fold: '#D98AA6', highlight: '#FDE1EA', ui: '#8FD3FF' },
  ghost: { body: '#CFCCDB', fold: '#A19DB5', highlight: '#E5E3EE', ui: '#BDB8D1' },
};

export const fonts = {
  display: {
    regular: 'Fredoka_400Regular',
    semibold: 'Fredoka_600SemiBold',
    bold: 'Fredoka_700Bold',
  },
  body: {
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
    extrabold: 'PlusJakartaSans_800ExtraBold',
  },
  mono: 'JetBrainsMono_500Medium',
} as const;

export const typography = {
  'display.xl': { fontFamily: fonts.display.bold, fontSize: 64, lineHeight: 83 },
  'display.lg': { fontFamily: fonts.display.bold, fontSize: 48, lineHeight: 62 },
  'heading.h1': { fontFamily: fonts.display.semibold, fontSize: 32, lineHeight: 42 },
  'heading.h2': { fontFamily: fonts.display.semibold, fontSize: 24, lineHeight: 31 },
  'heading.h3': { fontFamily: fonts.display.semibold, fontSize: 20, lineHeight: 26 },
  'body.lg': { fontFamily: fonts.body.bold, fontSize: 16, lineHeight: 21 },
  'body.md': { fontFamily: fonts.body.semibold, fontSize: 15, lineHeight: 20 },
  'body.sm': { fontFamily: fonts.body.semibold, fontSize: 13, lineHeight: 17 },
  caption: { fontFamily: fonts.body.bold, fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: fonts.mono, fontSize: 16, lineHeight: 21 },
} as const;

export type TypographyVariant = keyof typeof typography;

export const space = {
  2: 2,
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
  64: 64,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  sheet: 28,
  dialog: 32,
  pill: 999,
} as const;

/** Chunky offset shadow with no blur (matches the design SVGs). */
export const elevation = { offsetY: 3, opacity: 0.7 } as const;

export const motion = {
  duration: { instant: 80, fast: 120, quick: 200, base: 300, slow: 500, slower: 800 },
  easing: {
    standard: [0.2, 0, 0, 1],
    out: [0, 0, 0.2, 1],
    overshoot: [0.34, 1.56, 0.64, 1],
  },
  spring: { damping: 12, stiffness: 180 },
} as const;

export const layout = {
  screenWidth: 412,
  screenHeight: 915,
  gutter: 20,
  tabBarHeight: 84,
  minTouch: 48,
} as const;
