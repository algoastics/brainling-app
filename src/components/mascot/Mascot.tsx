import { memo } from 'react';
import { View } from 'react-native';
import { parse, SvgAst } from 'react-native-svg';

import { useT } from '@/i18n';

import { mascotArt, type MascotArtState } from './art';

const MIN_SIZE = 24;
const MAX_LEVEL_BONUS = 0.3;

type MascotAst = ReturnType<typeof parse>;
const astCache = new Map<MascotArtState, MascotAst>();

/** Parses each mascot's XML once per JS session instead of on every mount (SvgXml re-parses). */
export function mascotAst(state: MascotArtState): MascotAst {
  let ast = astCache.get(state);
  if (ast === undefined) {
    ast = parse(mascotArt[state]);
    astCache.set(state, ast);
  }
  return ast;
}

export type MascotProps = {
  /** Health state, or `ghost` when counting is off (not a health state). */
  state: MascotArtState;
  /** Base size in dp (≥ 24). */
  size?: number;
  /** Level 1–30: +1% size per level, capped at +30%. */
  level?: number;
};

/**
 * Static mascot from the design kit's mascot sheet. The Rive version (A03/A12 inputs
 * health/sleeping/poke/outfit/room) replaces the artwork behind this same interface in M5.
 */
export const Mascot = memo(function Mascot({ state, size = 160, level = 1 }: MascotProps) {
  const t = useT();
  const bonus = Math.min(Math.max(level - 1, 0) * 0.01, MAX_LEVEL_BONUS);
  const px = Math.round(Math.max(size, MIN_SIZE) * (1 + bonus));
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('mascot.label', {
        state: t(`mascot.state.${state}`),
        line: t(`mascot.line.${state}`),
      })}
      style={{ width: px, height: px }}
    >
      <SvgAst ast={mascotAst(state)} override={{ width: px, height: px }} />
    </View>
  );
});
