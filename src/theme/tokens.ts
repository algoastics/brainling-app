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
  /** Floating tab bar and other raised surfaces (Figma bg/surface-raised). */
  bgSurfaceRaised: string;
  /** Bottom sheet and dialog background (Figma bg/overlay). */
  bgOverlay: string;
  /** Scrim behind sheets and dialogs (Figma overlay/scrim, alpha included). */
  overlayScrim: string;
  /** Home hero glow gradient, centre and edge (Figma glow/hero-start and glow/hero-end). */
  glowHeroStart: string;
  glowHeroEnd: string;
  brandWordmarkAccent: string;
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
  bgSurfaceRaised: p.white,
  bgOverlay: p.white,
  overlayScrim: '#2A1C7A80',
  glowHeroStart: '#6B4EFF33',
  glowHeroEnd: '#6B4EFF00',
  brandWordmarkAccent: p.violet500,
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
  bgSurfaceRaised: p.nightVioletSoft,
  bgOverlay: p.nightSurface2,
  overlayScrim: '#000000A0',
  glowHeroStart: '#8C75FF57',
  glowHeroEnd: '#8C75FF00',
  brandWordmarkAccent: p.violet300,
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

/** Figma tracking is a percent of the font size; React Native wants dp. */
export const tracking = (percent: number, fontSize: number): number =>
  Math.round((percent / 100) * fontSize * 100) / 100;

/**
 * Figma type scale v1.4 (Foundations "Typography" text styles, 28 Oct). Tracking is dp: Figma
 * gives H1, Counter L and Button in px and Overline as 8 %. Counter XL, Counter M and Display
 * only have their sizes in the file, so their line height and tracking follow the old ratios.
 */
export const type = {
  counterXl: {
    fontFamily: fonts.nunito.black,
    fontSize: 64,
    lineHeight: 64,
    letterSpacing: tracking(-3, 64),
  },
  counterL: { fontFamily: fonts.nunito.black, fontSize: 48, lineHeight: 48, letterSpacing: -1.5 },
  counterM: {
    fontFamily: fonts.nunito.black,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: tracking(-1.5, 32),
  },
  display: {
    fontFamily: fonts.nunito.black,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: tracking(-1.5, 36),
  },
  h1: { fontFamily: fonts.nunito.extrabold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.nunito.extrabold, fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: fonts.nunito.bold, fontSize: 17, lineHeight: 24 },
  button: { fontFamily: fonts.nunito.extrabold, fontSize: 15, lineHeight: 20, letterSpacing: 0.5 },
  bodyL: { fontFamily: fonts.inter.regular, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: fonts.inter.regular, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.inter.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.inter.medium, fontSize: 12, lineHeight: 16 },
  overline: {
    fontFamily: fonts.inter.semibold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: tracking(8, 11),
  },
} as const satisfies Record<string, TypeStyle>;

/**
 * How far Android font scaling may grow each style. Titles, counters and buttons sit in fixed
 * layouts, so they stop at 1.2; reading text goes to 1.3.
 */
export const maxFontScale: Record<keyof typeof type, number> = {
  counterXl: 1.2,
  counterL: 1.2,
  counterM: 1.2,
  display: 1.2,
  h1: 1.2,
  h2: 1.2,
  h3: 1.2,
  button: 1.2,
  bodyL: 1.3,
  body: 1.3,
  label: 1.3,
  caption: 1.3,
  overline: 1.3,
};

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

/**
 * Layout spacing (Figma "Spacing & Size"). Screens and top bars use `screenMargin` (16 dp, never
 * 24); `sectionGap` is the vertical gap between groups only.
 */
export const spacing = {
  screenMargin: 16,
  sectionGap: 24,
  titleGap: 12,
  groupInset: 16,
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
  tabBarHeight: 64,
  tabPillWidth: 64,
  tabPillHeight: 32,
  rowHeight: 56,
  rowHeightCompact: 52,
  grabberWidth: 36,
  ring: 168,
  ringStroke: 14,
  sliderTrack: 8,
  sliderThumb: 28,
  badgeDot: 8,
  iconMd: 24,
  switchThumb: 24,
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

type Elevation = (typeof elevations)[keyof typeof elevations];

/** Style props for an elevation (iOS shadow plus an Android elevation of similar weight). */
export function elevationStyle(level: Elevation) {
  return {
    shadowColor: level.color,
    shadowOpacity: level.opacity,
    shadowOffset: { width: 0, height: level.offsetY },
    shadowRadius: level.radius,
    elevation: Math.round(level.radius / 2),
  } as const;
}

/** Motion tokens (Figma Motion spec A50 to A61); durations in ms, easings as cubic-bezier points. */
export const motion = {
  duration: {
    instant: 80,
    fast: 120,
    quick: 200,
    base: 300,
    slow: 500,
    slower: 800,
    pressIn: 60,
    pressOut: 120,
    entrance: 250,
    stagger: 40,
    tabPillIn: 180,
    tabPart: 220,
    tabPillOut: 150,
    sheetOpen: 300,
    sheetDismiss: 250,
    themeFade: 200,
    reducedFade: 100,
    digit: 150,
    digitPlace: 30,
    breath: 3500,
  },
  easing: {
    standard: [0.2, 0, 0, 1],
    out: [0, 0, 0.2, 1],
    decelerate: [0, 0, 0.2, 1],
    accelerate: [0.4, 0, 1, 1],
    emphasized: [0.2, 0, 0, 1],
    overshoot: [0.34, 1.56, 0.64, 1],
  },
  spring: { damping: 12, stiffness: 180 },
  /** Offsets in dp. */
  distance: { entrance: 8, page: 30 },
} as const;

export const layout = {
  screenWidth: sizes.screenWidth,
  screenHeight: sizes.screenHeight,
  gutter: spacing.screenMargin,
  tabBarHeight: sizes.tabBarHeight,
  minTouch: sizes.touchMin,
} as const;
