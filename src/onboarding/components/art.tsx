import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { Text } from '@/components/ui';
import { fonts, palette, radius, useTheme } from '@/theme';

import { Icon } from './Icon';
import { easeInOut, easeOut } from './motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const EGG_CRACKS = [
  'M-10 -40 l6 10 -8 8 6 8',
  'M20 -30 l-6 10 8 6 -4 10',
  'M-40 8 l12 -2 6 8 10 -6 10 8 10 -6 12 4',
] as const;

/** S05 brain-pod (kit `egg()`), drawn as precompiled SVG. `cracks` 0–3. */
export const Egg = memo(function Egg({ size, cracks }: { size: number; cracks: number }) {
  return (
    <Svg width={size} height={size * (128 / 120)} viewBox="-60 -66 120 128">
      <Ellipse cx={0} cy={52} rx={40} ry={7} fill={palette.outline} opacity={0.12} />
      <Path
        d="M0 -60 C34 -60 50 -10 50 14 C50 40 28 54 0 54 C-28 54 -50 40 -50 14 C-50 -10 -34 -60 0 -60Z"
        fill="#FFE0EB"
      />
      <Path
        d="M-30 -10 C-20 -20 -10 -4 0 -14 C10 -24 20 -8 30 -18"
        fill="none"
        stroke={palette.pink300}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <Circle cx={-18} cy={20} r={6} fill={palette.pink300} />
      <Circle cx={16} cy={30} r={4} fill={palette.pink300} />
      <Circle cx={22} cy={4} r={5} fill={palette.pink300} />
      <Ellipse
        cx={-22}
        cy={-34}
        rx={8}
        ry={12}
        fill={palette.white}
        opacity={0.7}
        rotation={20}
        origin="-22, -34"
      />
      {EGG_CRACKS.slice(0, cracks).map((d) => (
        <Path
          key={d}
          d={d}
          fill="none"
          stroke={palette.outline}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
});

/** Kit `flame()` (orange tier) for the S02 card 3 illustration. */
export const Flame = memo(function Flame({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * 1.2} viewBox="-22 -28 44 52">
      <Path
        d="M0 22 C12 22 20 14 20 2 C20 -10 10 -16 6 -26 C0 -20 -2 -14 -2 -8 C-6 -11 -8 -15 -8 -20 C-16 -12 -20 -4 -20 4 C-20 15 -12 22 0 22Z"
        fill={palette.ember500}
      />
      <Path
        d="M0 22 C7 22 11 17 11 10 C11 3 6 -1 3 -7 C0 -3 -1 1 -1 4 C-4 2 -5 0 -5 -3 C-9 1 -11 6 -11 10 C-11 17 -7 22 0 22Z"
        fill={palette.sun500}
      />
    </Svg>
  );
});

/** Mascot props from the kit sheet (`prop='shield'` on S06, `prop='battery'` on S09). */
export const MascotProp = memo(function MascotProp({
  kind,
  size,
}: {
  kind: 'shield' | 'battery';
  size: number;
}) {
  if (kind === 'shield') {
    return (
      <Svg width={size} height={size * 1.1} viewBox="24 -2 40 40">
        <Path
          d="M44 0 l18 6 v12 c0 10 -8 16 -18 18 c-10 -2 -18 -8 -18 -18 v-12z"
          fill={palette.violet600}
          stroke={palette.white}
          strokeWidth={2}
        />
        <Path
          d="M36 18 l6 6 10 -11"
          fill="none"
          stroke={palette.white}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size * 0.6} viewBox="42 -8 42 22">
      <Path
        d="M48 -6 h26 a4 4 0 0 1 4 4 v10 a4 4 0 0 1 -4 4 h-26 a4 4 0 0 1 -4 -4 v-10 a4 4 0 0 1 4 -4z"
        fill={palette.white}
        stroke={palette.outline}
        strokeWidth={2.5}
      />
      <Path d="M78 -1 h4 v8 h-4z" fill={palette.outline} />
      <Path
        d="M50 -2 h6 a2 2 0 0 1 2 2 v6 a2 2 0 0 1 -2 2 h-6 a2 2 0 0 1 -2 -2 v-6 a2 2 0 0 1 2 -2z"
        fill={palette.ember500}
      />
    </Svg>
  );
});

/** S07 finger-tap guide: pink dot with a halo that pulses until the service is on (A07 note). */
export const TapPulse = memo(function TapPulse() {
  const reduceMotion = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    s.set(
      withRepeat(
        withSequence(
          withTiming(1.35, { duration: 600, easing: easeInOut }),
          withTiming(1, { duration: 600, easing: easeInOut }),
        ),
        -1,
      ),
    );
  }, [reduceMotion, s]);
  const halo = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <View style={styles.pulse} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.halo, halo]} />
      <View style={styles.dot} />
    </View>
  );
});

/** A07 success tick: green disc scales in (300 ms), then the check draws (200 ms). */
export const SuccessTick = memo(function SuccessTick({ size = 160 }: { size?: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const disc = useSharedValue(reduceMotion ? 1 : 0);
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    disc.set(withTiming(1, { duration: 300, easing: easeOut }));
    draw.set(withDelay(300, withTiming(1, { duration: 200, easing: easeOut })));
  }, [disc, draw, reduceMotion]);
  const discStyle = useAnimatedStyle(() => ({
    transform: [{ scale: disc.get() }],
    opacity: disc.get(),
  }));
  const CHECK_LEN = 22;
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - draw.get()) }));
  return (
    <View
      style={{
        width: size * 1.5,
        height: size * 1.5,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius.pill, backgroundColor: colors.goodSoft },
        ]}
      />
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius.pill,
            backgroundColor: colors.good,
            alignItems: 'center',
            justifyContent: 'center',
          },
          discStyle,
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <AnimatedPath
            d="M5 12.5l4.5 4.5L19 7"
            fill="none"
            stroke={palette.white}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={CHECK_LEN}
            animatedProps={checkProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
});

const CONFETTI_COLOURS = [
  palette.pink500,
  palette.sun500,
  palette.mint500,
  palette.violet500,
  palette.ice500,
  palette.ember500,
];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  round: boolean;
  colour: string;
  spin: number;
};

/** Deterministic PRNG so the scatter is stable between renders (kit `confetti(seed=3)`). */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeParticles(n: number, spread: number, seed: number): Particle[] {
  const r = rng(seed);
  return Array.from({ length: Math.min(n, 60) }, (_, i) => {
    const round = i % 2 === 0;
    return {
      x: (r() * 2 - 1) * spread,
      y: (r() * 1.2 - 0.7) * spread,
      vx: (r() * 2 - 1) * spread * 1.1,
      vy: -(0.6 + r()) * spread * 1.4,
      w: round ? 4 + r() * 5 : 5 + r() * 5,
      h: round ? 0 : 3 + r() * 3,
      round,
      colour: CONFETTI_COLOURS[Math.floor(r() * CONFETTI_COLOURS.length)] ?? palette.pink500,
      spin: (r() * 2 - 1) * 720,
    };
  });
}

const Piece = memo(function Piece({
  p,
  t,
  animate,
}: {
  p: Particle;
  t: { get: () => number };
  animate: boolean;
}) {
  const style = useAnimatedStyle(() => {
    if (!animate) return { transform: [{ translateX: p.x }, { translateY: p.y }] };
    const k = t.get();
    const gravity = 2.6 * Math.abs(p.vy);
    return {
      opacity: k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25,
      transform: [
        { translateX: p.vx * k },
        { translateY: p.vy * k + 0.5 * gravity * k * k },
        { rotate: `${p.spin * k}deg` },
      ],
    };
  });
  const size = p.round
    ? { width: p.w, height: p.w, borderRadius: p.w / 2 }
    : { width: p.w, height: p.h, borderRadius: 1.5 };
  return <Animated.View style={[styles.piece, size, { backgroundColor: p.colour }, style]} />;
});

/**
 * A10 confetti: ≤ 60 particles, 1.2 s gravity burst. Static scatter when `burst` is false (kit decor
 * on S05-named) and under Remove animations (motion spec: A10 disabled).
 */
export const Confetti = memo(function Confetti({
  count = 40,
  spread = 160,
  burst = false,
  seed = 3,
}: {
  count?: number;
  spread?: number;
  burst?: boolean;
  seed?: number;
}) {
  const reduceMotion = useReducedMotion();
  const animate = burst && !reduceMotion;
  const particles = useMemo(() => makeParticles(count, spread, seed), [count, spread, seed]);
  const t = useSharedValue(0);
  useEffect(() => {
    if (animate) t.set(withTiming(1, { duration: 1200 }));
  }, [animate, t]);
  return (
    <View
      pointerEvents="none"
      style={styles.confetti}
      importantForAccessibility="no-hide-descendants"
    >
      {particles.map((p, i) => (
        <Piece key={i} p={p} t={t} animate={animate} />
      ))}
    </View>
  );
});

/** S09 battery (kit drawing) with the A09 fill: 0 → 100 % over 700 ms, ease-in-out. */
export const BatteryFill = memo(function BatteryFill({ scale = 1 }: { scale?: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const f = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) f.set(withTiming(1, { duration: 700, easing: easeInOut }));
  }, [f, reduceMotion]);
  const fill = useAnimatedStyle(() => ({ width: `${f.get() * 100}%` }));
  const s = scale;
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center' }}
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          width: 140 * s,
          height: 80 * s,
          borderRadius: 18 * s,
          borderWidth: 6 * s,
          borderColor: colors.ink,
          padding: 6 * s,
        }}
      >
        <View style={{ flex: 1, borderRadius: 10 * s, overflow: 'hidden' }}>
          <Animated.View
            style={[{ height: '100%', backgroundColor: colors.good, borderRadius: 10 * s }, fill]}
          />
          <View
            style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
          >
            <Icon name="bolt" size={36 * s} color={palette.white} strokeWidth={2.4} filled />
          </View>
        </View>
      </View>
      <View
        style={{
          width: 10 * s,
          height: 28 * s,
          borderTopRightRadius: 4 * s,
          borderBottomRightRadius: 4 * s,
          backgroundColor: colors.ink,
          marginLeft: 1,
        }}
      />
    </View>
  );
});

/** Settings mock-up on S07 (kit `phone_mock`): fixed light phone UI, highlighted row with its toggle on. */
export const PhoneMock = memo(function PhoneMock({
  rows,
  highlight,
  width,
}: {
  rows: readonly string[];
  highlight: number;
  width: number;
}) {
  const k = width / 280;
  return (
    <View
      style={{ width, borderRadius: 26 * k, backgroundColor: palette.ink900, padding: 8 * k }}
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          borderRadius: 20 * k,
          backgroundColor: palette.white,
          paddingVertical: 14 * k,
          paddingHorizontal: 8 * k,
          gap: 8 * k,
        }}
      >
        {rows.map((row, i) => {
          const on = i === highlight;
          return (
            <View
              key={row}
              style={{
                height: 42 * k,
                borderRadius: 10 * k,
                paddingHorizontal: 10 * k,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: on ? palette.violet100 : 'transparent',
              }}
            >
              <Text
                style={{
                  fontFamily: on ? fonts.body.extrabold : fonts.body.semibold,
                  fontSize: 13.5 * k,
                  color: palette.ink900,
                }}
              >
                {row}
              </Text>
              {on ? (
                <View
                  style={{
                    width: 50 * k,
                    height: 30 * k,
                    borderRadius: 15 * k,
                    backgroundColor: palette.violet600,
                    padding: 4 * k,
                    alignItems: 'flex-end',
                  }}
                >
                  <View
                    style={{
                      width: 22 * k,
                      height: 22 * k,
                      borderRadius: 11 * k,
                      backgroundColor: palette.white,
                    }}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
});

/** Small trophy used on S02 card 3. */
export const Trophy = memo(function Trophy({ size }: { size: number }) {
  return <Icon name="trophy" size={size} color={palette.sun700} />;
});

const styles = StyleSheet.create({
  pulse: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.pink500,
    opacity: 0.35,
  },
  dot: { width: 20, height: 20, borderRadius: 10, backgroundColor: palette.pink500 },
  piece: { position: 'absolute' },
  confetti: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 },
});
