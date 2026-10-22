import type { ReactNode } from 'react';
import { View } from 'react-native';

export type PositionedProps = {
  /** Centre in 412-wide kit frame coordinates. */
  cx: number;
  cy: number;
  /** Box size in kit dp (before scaling). */
  w: number;
  h: number;
  /** Design scale from `useDesignScale`. */
  k: number;
  /** Width of the container the frame is centred in. */
  frameWidth: number;
  children: ReactNode;
};

/** Places an illustration where the kit draws it, scaled and centred on any screen width. */
export function Positioned({ cx, cy, w, h, k, frameWidth, children }: PositionedProps) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: frameWidth / 2 + (cx - 206) * k - (w * k) / 2,
        top: cy * k - (h * k) / 2,
        width: w * k,
        height: h * k,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}
