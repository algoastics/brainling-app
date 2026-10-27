import {
  Accessibility,
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Home,
  Info,
  Lock,
  Minus,
  Plus,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react-native';

import { useTheme, type ColorTokens } from '@/theme';

/** Lucide-style icon set used by the Phase 0 screens (Figma "icon/*"). */
export const iconSet = {
  home: Home,
  lock: Lock,
  settings: Settings,
  minus: Minus,
  plus: Plus,
  external: ExternalLink,
  trash: Trash2,
  accessibility: Accessibility,
  clock: Clock,
  sparkles: Sparkles,
  back: ArrowLeft,
  check: Check,
  info: Info,
  chevron: ChevronRight,
  close: X,
  shield: Shield,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof iconSet;

export type IconProps = {
  name: IconName;
  size?: number;
  /** A semantic color name, or a raw color string. Defaults to `textPrimary`. */
  color?: keyof ColorTokens | (string & {});
  strokeWidth?: number;
};

/** Decorative by default (hidden from accessibility); the parent control carries the label. */
export function Icon({ name, size = 24, color = 'textPrimary', strokeWidth = 2 }: IconProps) {
  const { colors } = useTheme();
  const Glyph = iconSet[name];
  const resolved = color in colors ? colors[color as keyof ColorTokens] : color;
  return (
    <Glyph
      size={size}
      color={resolved}
      strokeWidth={strokeWidth}
      importantForAccessibility="no"
      accessibilityElementsHidden
    />
  );
}
