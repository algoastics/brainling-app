/**
 * "Display over other apps" (SYSTEM_ALERT_WINDOW) as the UI sees it. `null` means not read yet.
 * With it the lock is drawn below notifications; without it a fallback window is used, and
 * notifications may be hidden or not tappable while the lock is up.
 */
export type OverlayGranted = boolean | null;

/** The Home note about the fallback shows only once we know the permission is missing. */
export function overlayNoticeVisible(granted: OverlayGranted): boolean {
  return granted === false;
}

/** Which Settings value to show; `null` while unknown (no value is shown, nothing flickers). */
export function overlayValueKey(granted: OverlayGranted): 'on' | 'off' | null {
  if (granted === null) return null;
  return granted ? 'on' : 'off';
}

/**
 * After the Accessibility step: skip the permission step when it is already granted, show it
 * otherwise (also when the read failed, so the user can still choose).
 */
export function afterAccessibility(granted: OverlayGranted): 'home' | 'overlay' {
  return granted === true ? 'home' : 'overlay';
}
