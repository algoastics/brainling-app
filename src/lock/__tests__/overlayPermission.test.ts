import { describe, expect, it } from '@jest/globals';

import { afterAccessibility, overlayNoticeVisible, overlayValueKey } from '../overlayPermission';

describe('overlay permission logic', () => {
  it('shows the fallback note only once the permission is known to be missing', () => {
    expect(overlayNoticeVisible(false)).toBe(true);
    expect(overlayNoticeVisible(true)).toBe(false);
    expect(overlayNoticeVisible(null)).toBe(false);
  });

  it('maps the permission to the Settings value, and to nothing while unknown', () => {
    expect(overlayValueKey(true)).toBe('on');
    expect(overlayValueKey(false)).toBe('off');
    expect(overlayValueKey(null)).toBeNull();
  });

  it('skips the onboarding step only when the permission is already granted', () => {
    expect(afterAccessibility(true)).toBe('home');
    expect(afterAccessibility(false)).toBe('overlay');
    expect(afterAccessibility(null)).toBe('overlay');
  });
});
