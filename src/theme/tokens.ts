/**
 * Thumbwell design tokens. Values come from the Figma file (page 02 Foundations); never hard-code
 * hex values in components, read them from the theme.
 */
import { primitives as p } from './palette';

export { palette, primitives } from './palette';

/** Semantic colors, one set per mode (Figma "Semantic colours / Light" and "/ Dark"). */
export type SemanticColors = {
  bgScreen: string;
  bgSurface: string;
  bgSurface2: string;
  bgPrimarySoft: string;
  brandPrimary: string;
  brandPrimaryEdge: string;
  brandOnPrimary: string;
  brandAccentText: string;
  brandLilac: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderDefault: string;
  borderStrong: string;
  borderControl: string;
  statusGood: string;
  statusGoodText: string;
  statusWarn: string;
  statusDanger: string;
  statusDangerStrong: string;
  statusDangerEdge: string;
  statusOnDanger: string;
};

export type ColorTokens = SemanticColors;

const lightSemantic: SemanticColors = {
  bgScreen: p.mist,
  bgSurface: p.white,
  bgSurface2: p.surface2Light,
  bgPrimarySoft: p.lilac100,
  brandPrimary: p.violet500,
  brandPrimaryEdge: p.violet700,
  brandOnPrimary: p.white,
  brandAccentText: p.violet700,
  brandLilac: p.lilac200,
  textPrimary: p.plum900,
  textSecondary: p.plum700,
  textMuted: p.plum600,
  borderDefault: p.lineLight,
  borderStrong: p.lineStrongLight,
  borderControl: p.plumControl,
  statusGood: p.mint500,
  statusGoodText: p.mint700,
  statusWarn: p.sun500,
  statusDanger: p.coral500,
  statusDangerStrong: p.coral700,
  statusDangerEdge: p.coral900,
  statusOnDanger: p.white,
};

const darkSemantic: SemanticColors = {
  bgScreen: p.nightBg,
  bgSurface: p.nightSurface,
  bgSurface2: p.nightSurface2,
  bgPrimarySoft: p.nightVioletSoft,
  brandPrimary: p.violet500,
  brandPrimaryEdge: p.violet800,
  brandOnPrimary: p.white,
  brandAccentText: p.lilacDark,
  brandLilac: p.lilacDark,
  textPrimary: p.moon,
  textSecondary: p.moonInk2,
  textMuted: p.moonMuted,
  borderDefault: p.lineDark,
  borderStrong: p.lineStrongDark,
  borderControl: p.nightControl,
  statusGood: p.mint300,
  statusGoodText: p.mint300,
  statusWarn: p.sun500,
  statusDanger: p.coral300,
  statusDangerStrong: p.coral300,
  statusDangerEdge: p.coral400,
  statusOnDanger: p.nightBg,
};

export const lightColors: ColorTokens = lightSemantic;
export const darkColors: ColorTokens = darkSemantic;

/** Font family names registered by `useThumbwellFonts` (Nunito for headings/numbers, Inter for text). */
export const fonts = {
  nunito: { bold: 'Nunito_700Bold', extrabold: 'Nunito_800ExtraBold', black: 'Nunito_900Black' },
  inter: { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold' },
} as const;

type TypeStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
};

/** Figma type scale (Foundations "Type scale"). */
export const type = {
  counterXl: { fontFamily: fonts.nunito.black, fontSize: 96, lineHeight: 96, letterSpacing: -2 },
  counterL: { fontFamily: fonts.nunito.black, fontSize: 64, lineHeight: 64, letterSpacing: -2 },
  display: { fontFamily: fonts.nunito.black, fontSize: 48, lineHeight: 52, letterSpacing: -1 },
  h1: { fontFamily: fonts.nunito.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -1 },
  h2: { fontFamily: fonts.nunito.extrabold, fontSize: 24, lineHeight: 30 },
  h3: { fontFamily: fonts.nunito.bold, fontSize: 20, lineHeight: 26 },
  button: { fontFamily: fonts.nunito.extrabold, fontSize: 17, lineHeight: 20, letterSpacing: 1 },
  bodyL: { fontFamily: fonts.inter.regular, fontSize: 18, lineHeight: 26 },
  body: { fontFamily: fonts.inter.regular, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.inter.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.inter.medium, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fonts.inter.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 10 },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof type;

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
  '2xl': 28,
  sheet: 28,
  dialog: 32,
  pill: 999,
} as const;

/** Component sizes (Figma "Size tokens"). */
export const sizes = {
  buttonHeight: 52,
  buttonHeightSm: 40,
  buttonEdge: 4,
  buttonEdgePressed: 1,
  buttonPressTravel: 3,
  touchMin: 48,
  inputHeight: 56,
  topBarHeight: 56,
  tabBarHeight: 72,
  switchWidth: 52,
  switchHeight: 32,
  progressHeight: 12,
  screenWidth: 360,
  screenHeight: 800,
} as const;

/** Floating-surface shadows (Figma "Elevation"). Cards use a 1.5dp border instead. */
export const elevations = {
  card: { color: '#2A1C7A', opacity: 0.08, offsetY: 2, radius: 8 },
  toast: { color: '#2A1C7A', opacity: 0.14, offsetY: 4, radius: 16 },
  sheet: { color: '#2A1C7A', opacity: 0.2, offsetY: 8, radius: 32 },
} as const;

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
  screenWidth: sizes.screenWidth,
  screenHeight: sizes.screenHeight,
  gutter: 20,
  tabBarHeight: sizes.tabBarHeight,
  minTouch: sizes.touchMin,
} as const;
