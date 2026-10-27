export const WELCOME_ROUTE = '/welcome';
export const HOME_ROUTE = '/(tabs)';

/** Where the splash sends the user: first run goes through onboarding, later runs go to Home. */
export function initialRoute(
  onboardingCompleted: boolean,
): typeof WELCOME_ROUTE | typeof HOME_ROUTE {
  return onboardingCompleted ? HOME_ROUTE : WELCOME_ROUTE;
}
