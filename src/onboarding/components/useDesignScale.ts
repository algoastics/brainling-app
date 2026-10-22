import { useWindowDimensions } from 'react-native';

import { layout } from '@/theme';

/**
 * The kit draws every screen on a 412×915 dp frame. Illustrations are placed in frame
 * coordinates and scaled by this factor so they keep their proportions on any phone.
 */
export function useDesignScale(): number {
  const { width, height } = useWindowDimensions();
  return Math.min(width / layout.screenWidth, height / layout.screenHeight, 1.25);
}
