import { health, stateForHealth, type MascotState } from '@/theme';

/** Onboarding routes (M2). S11 is cut from the MVP and S12 is deferred to v1.1 (module plan §0). */
export const ONBOARDING_ROUTES = {
  welcome: '/welcome',
  quiz: '/quiz',
  budget: '/budget',
  hatch: '/hatch',
  disclosure: '/disclosure',
  restricted: '/restricted',
  accessibility: '/accessibility',
  notifications: '/notifications',
  battery: '/battery',
  oem: '/oem',
  setupCheck: '/setup-check',
} as const;

export type OnboardingRoute = (typeof ONBOARDING_ROUTES)[keyof typeof ONBOARDING_ROUTES];

/** Android 13 (API 33) added "Allow restricted settings" for sideloaded apps. */
export const RESTRICTED_SETTINGS_MIN_API = 33;

export function needsRestrictedSettingsGuide(os: string, version: number | string): boolean {
  return os === 'android' && Number(version) >= RESTRICTED_SETTINGS_MIN_API;
}

/**
 * Where S06 leads once the user agrees. The disclosure always comes first: S07-restricted and S07
 * are the only screens that deep-link into system settings for the service.
 */
export function routeAfterDisclosure(os: string, version: number | string): OnboardingRoute {
  return needsRestrictedSettingsGuide(os, version)
    ? ONBOARDING_ROUTES.restricted
    : ONBOARDING_ROUTES.accessibility;
}

/** S03 — "Guess your daily reels" slider. */
export const GUESS = { min: 0, max: 500, step: 10, initial: 200 } as const;

/** S04 — daily reel budget stepper. */
export const BUDGET = { min: 10, max: 300, step: 10, initial: 60 } as const;

/** Midpoint of the kit's "1 reel = 20–30 seconds" estimate. */
export const SECONDS_PER_REEL = 25;

export function snap(value: number, min: number, max: number, step: number): number {
  const stepped = Math.round((value - min) / step) * step + min;
  return Math.min(max, Math.max(min, stepped));
}

export function stepBudget(budget: number, direction: 1 | -1): number {
  return snap(budget + direction * BUDGET.step, BUDGET.min, BUDGET.max, BUDGET.step);
}

export function budgetMinutes(budget: number): number {
  return Math.round((budget * SECONDS_PER_REEL) / 60);
}

/** Mascot under the S03 slider: how a typical day of that many reels would feel. */
export function guessMascotState(guess: number): MascotState {
  return stateForHealth(health(guess, 400));
}

/** S04 face preview: a smaller budget means a happier Brainling. */
export function budgetMascotState(budget: number): MascotState {
  if (budget <= 30) return 'glowing';
  if (budget <= 90) return 'happy';
  if (budget <= 150) return 'meh';
  if (budget <= 240) return 'fried';
  return 'zombie';
}

/** S05 — name rules: 2–14 characters, emoji OK (an emoji counts as one). */
export const NAME = { min: 2, max: 14 } as const;

const JOINERS = /[\u200d\ufe0e\ufe0f\u{1F3FB}-\u{1F3FF}]/u;

export function nameLength(name: string): number {
  return Array.from(name.trim()).filter((ch) => !JOINERS.test(ch)).length;
}

export type NameCheck = 'ok' | 'tooShort' | 'tooLong';

export function checkName(name: string): NameCheck {
  const n = nameLength(name);
  if (n < NAME.min) return 'tooShort';
  if (n > NAME.max) return 'tooLong';
  return 'ok';
}

/** S05 — taps on the brain-pod before it hatches (A06). */
export const HATCH_TAPS = 3;

/** S13 — reels the live self-test needs to see. */
export const SELF_TEST_REELS = 3;

export type CountSnapshot = { date: string; total: number };

/** Reels counted since the test started; a new day restarts the native total at 0. */
export function reelsSince(baseline: CountSnapshot, current: CountSnapshot): number {
  if (current.date !== baseline.date) return current.total;
  return Math.max(0, current.total - baseline.total);
}

export type SelfTestOutcome = 'pass' | 'fail' | 'running';

/**
 * Passes as soon as enough reels arrive. A failure is only decided once the user is back in the
 * app (`returned`), so live counts can still arrive while the user is in Instagram or YouTube.
 */
export function evaluateSelfTest(seen: number, returned: boolean): SelfTestOutcome {
  if (seen >= SELF_TEST_REELS) return 'pass';
  return returned ? 'fail' : 'running';
}
