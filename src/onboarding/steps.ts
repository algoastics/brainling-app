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

/**
 * The onboarding step a route belongs to, or null when the route is not part of onboarding. The
 * disclosure is shared with the Home banner and the re-enable link, which pass `from`: only a
 * first run (no `from`, or `from=onboarding`) counts as step 3. The guide is step 3 until its
 * "Display over other apps" stage is showing, then step 4.
 */
export function onboardingStepFor(
  pathname: string,
  from: string | undefined,
  overlayStage: boolean,
): number | null {
  switch (pathname) {
    case '/welcome':
      return STEP_WELCOME;
    case '/limit':
      return STEP_LIMIT;
    case '/disclosure':
      return from === undefined || from === 'onboarding' ? STEP_ACCESSIBILITY : null;
    case '/guide':
      return overlayStage ? STEP_OVERLAY : STEP_ACCESSIBILITY;
    default:
      return null;
  }
}
