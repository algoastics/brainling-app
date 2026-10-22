import { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Part =
  | { readonly d: string }
  | { readonly c: readonly [number, number, number] }
  | { readonly r: readonly [number, number, number, number, number] };

/** C13 icons used by onboarding (24dp grid, round caps), copied from the kit's icon table. */
const ICONS = {
  back: [{ d: 'M15 5l-7 7 7 7' }],
  next: [{ d: 'M9 5l7 7-7 7' }],
  check: [{ d: 'M5 12.5l4.5 4.5L19 7' }],
  close: [{ d: 'M6 6l12 12M18 6L6 18' }],
  plus: [{ d: 'M12 5v14M5 12h14' }],
  minus: [{ d: 'M5 12h14' }],
  info: [{ c: [12, 12, 9] }, { d: 'M12 11v6' }, { d: 'M12 7.5v.3' }],
  alert: [{ d: 'M12 3l10 18H2z' }, { d: 'M12 10v5' }, { d: 'M12 18v.3' }],
  shield: [{ d: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z' }, { d: 'M8.5 12l2.5 2.5 4.5-5' }],
  lock: [{ r: [5, 11, 14, 10, 2.5] }, { d: 'M8 11V8a4 4 0 0 1 8 0v3' }, { d: 'M12 15v2' }],
  phone: [{ r: [6, 2.5, 12, 19, 2.5] }, { d: 'M10.5 18.5h3' }],
  refresh: [{ d: 'M20 11a8 8 0 1 0-2.3 5.7' }, { d: 'M20 4v7h-7' }],
  play: [{ d: 'M8 5l11 7-11 7z' }],
  bolt: [{ d: 'M13 2L4 14h7l-1 8 9-12h-7z' }],
  trophy: [
    { d: 'M7 4h10v5a5 5 0 0 1-10 0z' },
    { d: 'M7 6H4a3 3 0 0 0 3 4' },
    { d: 'M17 6h3a3 3 0 0 1-3 4' },
    { d: 'M12 14v4' },
    { d: 'M8 21h8' },
  ],
} as const satisfies Record<string, readonly Part[]>;

export type IconName = keyof typeof ICONS;

export type IconProps = {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  filled?: boolean;
};

/** Decorative icon (hidden from TalkBack); the control that holds it carries the label. */
export const Icon = memo(function Icon({
  name,
  size = 24,
  color,
  strokeWidth = 2,
  filled = false,
}: IconProps) {
  const fill = filled || name === 'play' ? color : 'none';
  const parts: readonly Part[] = ICONS[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {parts.map((p, i) => {
        const stroke = {
          stroke: color,
          strokeWidth,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
        };
        if ('d' in p) return <Path key={i} d={p.d} fill={fill} {...stroke} />;
        if ('c' in p)
          return <Circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} fill={fill} {...stroke} />;
        const [x, y, w, h, rx] = p.r;
        return <Rect key={i} x={x} y={y} width={w} height={h} rx={rx} fill={fill} {...stroke} />;
      })}
    </Svg>
  );
});
