/**
 * Version of the Accessibility disclosure text (S06). Must equal the native
 * `Disclosure.CURRENT_VERSION`; bump both together when the text changes so consent is asked again.
 * History: 1 = first Phase 0 draft; 2 = adds the on-screen counter sentence (F03, D42). Consent
 * logged for version 1 is never migrated: counting stays paused until version 2 is accepted.
 */
export const DISCLOSURE_VERSION = '2';
