/** Dismiss rule for a dragged sheet (Figma A56): far enough, or fast enough downwards. */
export const SHEET_DISMISS_FRACTION = 0.3;
/** 800 dp/s, expressed in dp per millisecond (Gesture Handler's velocityY is dp/s: divide by 1000). */
export const SHEET_DISMISS_VELOCITY = 0.8;
/** Dragging up past the rest position follows the finger at this share of the distance. */
export const SHEET_RUBBER_BAND = 0.25;

/** Sheet offset for a finger travel `dy`: 1:1 downwards, rubber-banded upwards. */
export function sheetDragOffset(dy: number): number {
  'worklet';
  return dy >= 0 ? dy : dy * SHEET_RUBBER_BAND;
}

/** True when releasing at `dy` (dp) with downward velocity `vy` (dp/ms) should dismiss. */
export function shouldDismissSheet(dy: number, vy: number, sheetHeight: number): boolean {
  'worklet';
  if (dy <= 0) return false;
  return dy > sheetHeight * SHEET_DISMISS_FRACTION || vy > SHEET_DISMISS_VELOCITY;
}
