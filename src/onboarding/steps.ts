/**
 * Onboarding is four steps (Figma spec "Onboarding order + skip"): Welcome, Daily limit,
 * Accessibility (the disclosure and then "Turn on in Accessibility" are both step 3) and
 * Display over other apps, which is last and skippable.
 */
export const ONBOARDING_STEPS = 4;

export const STEP_WELCOME = 1;
export const STEP_LIMIT = 2;
export const STEP_ACCESSIBILITY = 3;
export const STEP_OVERLAY = 4;
