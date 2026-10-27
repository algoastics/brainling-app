/**
 * Single source for the Accessibility prominent-disclosure copy (S06). Any screen that leads to
 * Android accessibility settings (S06, /reenable) renders these keys so the wording never drifts.
 */
export const DISCLOSURE_POINTS = [
  { key: 'counts', ok: true },
  { key: 'lock', ok: true },
  { key: 'never', ok: false },
] as const;

export const DISCLOSURE_PARAGRAPHS = ['what', 'use', 'never', 'off'] as const;

export type DisclosurePointKey = (typeof DISCLOSURE_POINTS)[number]['key'];
export type DisclosureParagraphKey = (typeof DISCLOSURE_PARAGRAPHS)[number];

export const disclosurePointKey = (k: DisclosurePointKey) =>
  `onboarding.disclosure.points.${k}` as const;
export const disclosureParagraphKey = (k: DisclosureParagraphKey) =>
  `onboarding.disclosure.body.${k}` as const;

/**
 * Version of this disclosure text. Logged natively with a timestamp when the user accepts it
 * (`ThumbwellCore.setConsent`); must equal `Disclosure.CURRENT_VERSION` in thumbwell-core. Bump
 * both when the text changes, which pauses counting until the user accepts again.
 */
export const DISCLOSURE_VERSION = '1';
