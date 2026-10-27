import type { ComponentType } from 'react';

import {
  AccessibilityGlyph,
  BackGlyph,
  BadgeGlyph,
  BellGlyph,
  ChartGlyph,
  CheckGlyph,
  ChevronRightGlyph,
  CloseGlyph,
  ContrastGlyph,
  ExternalGlyph,
  EyeOffGlyph,
  HomeGlyph,
  InfoGlyph,
  LockGlyph,
  MinusGlyph,
  MoonGlyph,
  PlusGlyph,
  ShieldGlyph,
  SlidersGlyph,
  SparkleGlyph,
  TimerGlyph,
  TrashGlyph,
  type GlyphProps,
} from '@/components/icons/glyphs';
import { useTheme, type ColorTokens } from '@/theme';

/** The 22 pebble glyphs of the Figma "Icon system" (names keep the earlier call sites working). */
export const iconSet = {
  home: HomeGlyph,
  lock: LockGlyph,
  settings: SlidersGlyph,
  sliders: SlidersGlyph,
  minus: MinusGlyph,
  plus: PlusGlyph,
  external: ExternalGlyph,
  trash: TrashGlyph,
  accessibility: AccessibilityGlyph,
  sparkles: SparkleGlyph,
  back: BackGlyph,
  check: CheckGlyph,
  info: InfoGlyph,
  chevron: ChevronRightGlyph,
  close: CloseGlyph,
  shield: ShieldGlyph,
  badge: BadgeGlyph,
  timer: TimerGlyph,
  moon: MoonGlyph,
  chart: ChartGlyph,
  bell: BellGlyph,
  eyeOff: EyeOffGlyph,
  contrast: ContrastGlyph,
} as const satisfies Record<string, ComponentType<GlyphProps>>;

export type IconName = keyof typeof iconSet;

/** Glyphs that carry a tint shape; the other seven (action glyphs) only change colour. */
export const TINTED_ICONS: readonly IconName[] = [
  'home',
  'lock',
  'settings',
  'sliders',
  'trash',
  'accessibility',
  'sparkles',
  'info',
  'shield',
  'badge',
  'timer',
  'moon',
  'chart',
  'bell',
  'eyeOff',
  'contrast',
];

export type IconProps = {
  name: IconName;
  size?: number;
  /** A semantic color name, or a raw color string. Defaults to `textPrimary`. */
  color?: keyof ColorTokens | (string & {});
  /** Stroke width in 24 dp units; the Figma set uses 2 at every size. */
  strokeWidth?: number;
  /** Active state: tint colour on the enclosed shape (colour-only glyphs just change colour). */
  filled?: boolean;
};

/** Decorative by default (hidden from accessibility); the parent control carries the label. */
export function Icon({
  name,
  size = 24,
  color = 'textPrimary',
  strokeWidth = 2,
  filled = false,
}: IconProps) {
  const { colors } = useTheme();
  const Glyph = iconSet[name];
  const resolved = color in colors ? colors[color as keyof ColorTokens] : color;
  return (
    <Glyph
      size={size}
      color={resolved}
      tint={colors.brandLilac}
      filled={filled}
      strokeWidth={strokeWidth}
    />
  );
}
