import type { Icon as PhosphorIcon, IconWeight } from 'phosphor-react-native';
import {
  ArrowLeft,
  ArrowSquareOut,
  Bell,
  CaretRight,
  ChartBar,
  Check,
  CircleHalf,
  EyeSlash,
  House,
  Info,
  Lock,
  Minus,
  Moon,
  PersonSimpleCircle,
  Plus,
  Seal,
  ShieldCheck,
  SlidersHorizontal,
  Sparkle,
  Timer,
  Trash,
  X,
} from 'phosphor-react-native';

import { useTheme, type ColorTokens } from '@/theme';

/** Phosphor glyphs for every icon name used in the app (Phosphor is the only icon set, D-icons). */
export const iconSet = {
  home: House,
  lock: Lock,
  settings: SlidersHorizontal,
  sliders: SlidersHorizontal,
  minus: Minus,
  plus: Plus,
  external: ArrowSquareOut,
  trash: Trash,
  accessibility: PersonSimpleCircle,
  sparkles: Sparkle,
  back: ArrowLeft,
  check: Check,
  info: Info,
  chevron: CaretRight,
  close: X,
  shield: ShieldCheck,
  badge: Seal,
  timer: Timer,
  moon: Moon,
  chart: ChartBar,
  bell: Bell,
  eyeOff: EyeSlash,
  contrast: CircleHalf,
} as const satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof iconSet;

export type IconProps = {
  name: IconName;
  size?: number;
  /** A semantic color name, or a raw color string. Defaults to `textPrimary`. */
  color?: keyof ColorTokens | (string & {});
  /** Active state: the Fill weight. Inactive icons use the Regular weight. */
  filled?: boolean;
  /** Heavier line for small marks on a colour (for example the check inside a checkbox). */
  bold?: boolean;
};

/** Decorative: an SVG with no label, so the parent control carries the accessible name. */
export function Icon({
  name,
  size = 24,
  color = 'textPrimary',
  filled = false,
  bold = false,
}: IconProps) {
  const { colors } = useTheme();
  const Glyph = iconSet[name];
  const resolved = color in colors ? colors[color as keyof ColorTokens] : color;
  const weight: IconWeight = filled ? 'fill' : bold ? 'bold' : 'regular';
  return <Glyph size={size} color={resolved} weight={weight} />;
}
