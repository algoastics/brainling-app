import { useOnboardingStore } from './store';

/** Screens that deep-link to system settings only render once S06 was accepted. */
export function useDisclosureAccepted(): boolean {
  return useOnboardingStore((s) => s.disclosureAcceptedAt !== null);
}
