import { memo } from 'react';
import { View } from 'react-native';
import { parse, SvgAst } from 'react-native-svg';

import { useT } from '@/i18n';

import { THUMB_ART, THUMB_ART_SIZE } from './thumbArt';

/** The five health states plus the welcome wave. */
export type ThumbPose = keyof typeof THUMB_ART;

type ThumbAst = ReturnType<typeof parse>;
const astCache = new Map<ThumbPose, ThumbAst>();

/** Parses each pose's XML once per JS session (SvgXml would re-parse on every mount). */
export function thumbAst(pose: ThumbPose): ThumbAst {
  let ast = astCache.get(pose);
  if (ast === undefined) {
    ast = parse(THUMB_ART[pose]);
    astCache.set(pose, ast);
  }
  return ast;
}

export type ThumbProps = {
  pose: ThumbPose;
  /** Rendered width in dp; the height follows the 240:270 artwork. */
  width?: number;
};

/** Static Thumb mascot (Figma 03 Mascot). A Rive version can replace the artwork later. */
export const Thumb = memo(function Thumb({ pose, width = 192 }: ThumbProps) {
  const t = useT();
  const height = Math.round((width * THUMB_ART_SIZE.height) / THUMB_ART_SIZE.width);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('mascot.label')}
      style={{ width, height }}
    >
      <SvgAst ast={thumbAst(pose)} override={{ width, height }} />
    </View>
  );
});
