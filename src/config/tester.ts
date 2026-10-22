/**
 * Tester build switch. ON by default for the tester APK: onboarding is bypassed for a single
 * Tester Setup screen (the onboarding code stays intact). Build with EXPO_PUBLIC_TESTER_MODE=0
 * to restore the full onboarding flow. Native twin: BRAINLING_TESTER_MODE (live count badge).
 */
export const TESTER_MODE = process.env.EXPO_PUBLIC_TESTER_MODE !== '0';

export const TESTER_SETUP_ROUTE = '/tester-setup' as const;
