/**
 * Pure slider geometry, shared by the gesture (UI thread, hence the `worklet` directives) and the
 * tests. The thumb is a `thumb` dp circle that travels from 0 to `travel` dp (track width minus
 * thumb); its centre sits at `thumb / 2 + position`. The finger's `x` on the track maps 1:1 onto
 * that travel (plus a grab from touch-down), so the thumb never runs ahead of the finger.
 */

/** Clamps `value` into [lo, hi]. */
export function clamp(value: number, lo: number, hi: number): number {
  'worklet';
  return Math.min(hi, Math.max(lo, value));
}

/** Snaps `value` to the nearest step inside [min, max]. */
export function snapToStep(value: number, min: number, max: number, step: number): number {
  'worklet';
  const snapped = min + Math.round((value - min) / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

/** How far the thumb can travel along a track of `width` dp. */
export function thumbTravel(width: number, thumb: number): number {
  'worklet';
  return Math.max(0, width - thumb);
}

/** Position (0 to 1) of `value` along the range; values outside the range pin to an end. */
export function positionOfValue(value: number, min: number, max: number): number {
  'worklet';
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Thumb offset in dp for `value`. */
export function offsetOfValue(value: number, min: number, max: number, travel: number): number {
  'worklet';
  return positionOfValue(value, min, max) * travel;
}

/**
 * Finger-to-thumb grab at touch-down: the thumb's left edge minus where that edge would sit if
 * the thumb centre jumped under the finger. Applied on every move so the thumb does not jump.
 */
export function grabAtTouch(offset: number, x: number, thumb: number): number {
  'worklet';
  return offset - (x - thumb / 2);
}

/**
 * Thumb offset for a finger at `x` dp on the track (view coordinates), plus the grab from
 * touch-down, clamped to the track. Past either end the thumb pins; as soon as the finger is
 * back over the track it follows again (absolute position, not accumulated translation).
 */
export function offsetAtFinger(x: number, grab: number, travel: number, thumb: number): number {
  'worklet';
  return clamp(x - thumb / 2 + grab, 0, travel);
}

/** Slider value (snapped to a step) for a thumb at `offset` dp. */
export function valueAtOffset(
  offset: number,
  travel: number,
  min: number,
  max: number,
  step: number,
): number {
  'worklet';
  if (travel <= 0) return min;
  const fraction = clamp(offset / travel, 0, 1);
  return snapToStep(min + fraction * (max - min), min, max, step);
}

/** Thumb offset for a tap at `x` dp on the track: the thumb centre goes to the finger, clamped. */
export function offsetForTap(x: number, travel: number, thumb: number): number {
  'worklet';
  return offsetAtFinger(x, 0, travel, thumb);
}

/** Centre of a snap mark (dp from the track's left edge). */
export function markCenter(
  value: number,
  min: number,
  max: number,
  width: number,
  thumb: number,
): number {
  'worklet';
  return thumb / 2 + offsetOfValue(value, min, max, thumbTravel(width, thumb));
}
