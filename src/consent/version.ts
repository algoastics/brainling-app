/**
 * Version of the Accessibility disclosure text (S06). Must equal the native
 * `Disclosure.CURRENT_VERSION`; bump both together when the text changes so consent is asked again.
 * History: 1 = first Phase 0 draft; 2 = adds the on-screen counter sentence (F03, D42);
 * 3 = adds the “Display over other apps” permission and the pause-the-video sentences (F03, D43).
 * Consent logged for an older version is never migrated: counting stays paused until version 3
 * is accepted.
 */
export const DISCLOSURE_VERSION = '3';
