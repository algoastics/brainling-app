/** Snaps `value` to the nearest step inside [min, max]. */
export function snapToStep(value: number, min: number, max: number, step: number): number {
  const snapped = min + Math.round((value - min) / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

/** Slider value for a touch at `x` dp along a track of `width` dp. */
export function valueAtPosition(
  x: number,
  width: number,
  min: number,
  max: number,
  step: number,
): number {
  if (width <= 0) return min;
  const fraction = Math.min(1, Math.max(0, x / width));
  return snapToStep(min + fraction * (max - min), min, max, step);
}

/** Position (0 to 1) of `value` along the track; values outside the range pin to an end. */
export function positionOfValue(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}
