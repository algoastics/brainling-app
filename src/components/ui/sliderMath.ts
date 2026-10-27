/**
 * Pure slider geometry, shared by the gesture (UI thread, hence the `worklet` directives) and the
 * tests. The thumb is a `thumb` dp circle that travels from 0 to `travel` dp (track width minus
 * thumb); its centre sits at `thumb / 2 + position`. Values map linearly onto that travel, so the
 * thumb is always exactly under the finger while dragging.
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
 * Thumb offset while dragging: the offset at touch-down plus how far the finger has moved since,
 * clamped to the track. Nothing moves at touch-down, and a finger that runs past an end pins the
 * thumb there (it picks up again as soon as the finger comes back past where it left).
 */
export function dragOffset(startOffset: number, translation: number, travel: number): number {
  'worklet';
  return clamp(startOffset + translation, 0, travel);
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
  return clamp(x - thumb / 2, 0, travel);
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
