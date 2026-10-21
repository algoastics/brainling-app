import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { mascotColors, palette } from '@/theme';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

export type LogomarkProps = {
  size?: number;
  /** 0 = eyes open, 1 = eyes closed. Drives the A01 blink. */
  eyelid?: SharedValue<number>;
};

const { body, fold, highlight } = mascotColors.happy;
const EYE_R = 8;

const stroke = {
  fill: 'none',
  stroke: fold,
  strokeWidth: 3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Eyelid({ cx, eyelid }: { cx: number; eyelid: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({
    ry: (EYE_R + 1) * eyelid.get(),
    cy: 6 - (EYE_R + 1) * (1 - eyelid.get()),
  }));
  return <AnimatedEllipse cx={cx} rx={EYE_R + 1} fill={body} animatedProps={props} />;
}

/** Brainling logomark (brand/logomark.svg) drawn natively so the eyes can blink. */
export function Logomark({ size = 160, eyelid }: LogomarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityRole="image">
      <G transform="translate(100 96) scale(1.4)">
        <Ellipse cx={0} cy={60} rx={44} ry={7} fill={palette.outline} opacity={0.13} />
        <Ellipse cx={-20} cy={52} rx={14} ry={8} fill={fold} />
        <Ellipse cx={20} cy={52} rx={14} ry={8} fill={fold} />
        <Ellipse cx={-55} cy={18} rx={9} ry={14} fill={fold} transform="rotate(25 -55 18)" />
        <Ellipse cx={55} cy={18} rx={9} ry={14} fill={fold} transform="rotate(-25 55 18)" />
        <Path
          d="M0 -44 C-10 -54 -30 -54 -38 -42 C-52 -42 -60 -28 -56 -16 C-64 -6 -62 12 -52 20 C-50 38 -32 50 0 50 C32 50 50 38 52 20 C62 12 64 -6 56 -16 C60 -28 52 -42 38 -42 C30 -54 10 -54 0 -44Z"
          fill={body}
        />
        <Path
          d="M-44 20 C-30 40 30 40 44 20 C40 36 26 46 0 46 C-26 46 -40 36 -44 20Z"
          fill={fold}
          opacity={0.25}
        />
        <Path d="M0 -44 C-4 -30 4 -22 0 -8" {...stroke} />
        <Path d="M-30 -38 C-22 -32 -26 -22 -36 -20" {...stroke} />
        <Path d="M30 -38 C22 -32 26 -22 36 -20" {...stroke} />
        <Path d="M-52 -2 C-44 -6 -40 2 -44 8" {...stroke} />
        <Path d="M52 -2 C44 -6 40 2 44 8" {...stroke} />
        <Path d="M-18 -30 C-12 -26 -14 -18 -20 -16" {...stroke} strokeWidth={2.5} />
        <Path d="M18 -30 C12 -26 14 -18 20 -16" {...stroke} strokeWidth={2.5} />
        <Ellipse
          cx={-30}
          cy={-32}
          rx={10}
          ry={6}
          fill={highlight}
          opacity={0.8}
          transform="rotate(-30 -30 -32)"
        />
        <Circle cx={-18} cy={6} r={EYE_R} fill={palette.outline} />
        <Circle cx={18} cy={6} r={EYE_R} fill={palette.outline} />
        <Circle cx={-15.5} cy={3} r={2.8} fill={palette.white} />
        <Circle cx={20.5} cy={3} r={2.8} fill={palette.white} />
        {eyelid ? (
          <>
            <Eyelid cx={-18} eyelid={eyelid} />
            <Eyelid cx={18} eyelid={eyelid} />
          </>
        ) : null}
        <Path
          d="M-9 22 Q0 31 9 22"
          fill="none"
          stroke={palette.outline}
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Ellipse cx={-34} cy={20} rx={7} ry={4} fill={palette.pink600} opacity={0.45} />
        <Ellipse cx={34} cy={20} rx={7} ry={4} fill={palette.pink600} opacity={0.45} />
      </G>
    </Svg>
  );
}
