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

/**
 * Old Brainling key names, mapped onto the Thumbwell semantics so existing screens re-skin without
 * edits. @deprecated: new code uses the semantic names above.
 */
export type LegacyColors = {
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

export type ColorTokens = SemanticColors & LegacyColors;

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

function withLegacy(s: SemanticColors, dark: boolean): ColorTokens {
  return {
    ...s,
    bg: s.bgScreen,
    surface: s.bgSurface,
    surface2: s.bgSurface2,
    ink: s.textPrimary,
    ink2: s.textSecondary,
    muted: s.textMuted,
    line: s.borderDefault,
    primary: s.brandPrimary,
    primary2: s.brandPrimaryEdge,
    primarySoft: s.bgPrimarySoft,
    onPrimary: s.brandOnPrimary,
    accent: s.brandLilac,
    accentSoft: s.bgPrimarySoft,
    good: s.statusGood,
    goodSoft: dark ? '#123D33' : '#D5F3E9',
    warn: s.statusWarn,
    warnSoft: dark ? '#3D3214' : '#FDEBC8',
    bad: s.statusDanger,
    badSoft: dark ? '#43221A' : '#FBE0D5',
    info: dark ? '#8FD3FF' : '#3E9BD6',
    infoSoft: dark ? '#16324A' : '#DDF2FF',
    coin: '#FFC233',
    coinInk: '#D99A00',
    scrim: dark ? '#000000' : p.plum900,
    shadow: dark ? '#07050F' : p.lineStrongLight,
    nav: s.bgSurface,
  };
}

export const lightColors: ColorTokens = withLegacy(lightSemantic, false);
export const darkColors: ColorTokens = withLegacy(darkSemantic, true);

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

/** Font family names registered by `useThumbwellFonts` (Nunito for headings/numbers, Inter for text). */
export const fonts = {
  nunito: { bold: 'Nunito_700Bold', extrabold: 'Nunito_800ExtraBold', black: 'Nunito_900Black' },
  inter: { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold' },
  /** @deprecated Old Brainling aliases (Fredoka/Jakarta), now Nunito/Inter. */
  display: { regular: 'Nunito_700Bold', semibold: 'Nunito_800ExtraBold', bold: 'Nunito_900Black' },
  /** @deprecated */
  body: {
    semibold: 'Inter_500Medium',
    bold: 'Inter_600SemiBold',
    extrabold: 'Nunito_800ExtraBold',
  },
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

/** @deprecated Old variant names, mapped onto the Thumbwell scale. */
export const typography = {
  'display.xl': type.counterL,
  'display.lg': type.display,
  'heading.h1': type.h1,
  'heading.h2': type.h2,
  'heading.h3': type.h3,
  'body.lg': { ...type.button, letterSpacing: 0 },
  'body.md': type.body,
  'body.sm': type.label,
  caption: type.caption,
  mono: type.label,
} as const satisfies Record<string, TypeStyle>;

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

/** @deprecated Brainling chunky offset shadow, still used by the old onboarding screens. */
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
  screenWidth: sizes.screenWidth,
  screenHeight: sizes.screenHeight,
  gutter: 20,
  tabBarHeight: sizes.tabBarHeight,
  minTouch: sizes.touchMin,
} as const;
