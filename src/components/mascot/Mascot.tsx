import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useT } from '@/i18n';

import { mascotArt, type MascotArtState } from './art';

const MIN_SIZE = 24;
const MAX_LEVEL_BONUS = 0.3;

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
export function Mascot({ state, size = 160, level = 1 }: MascotProps) {
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
      <SvgXml xml={mascotArt[state]} width={px} height={px} />
    </View>
  );
}
