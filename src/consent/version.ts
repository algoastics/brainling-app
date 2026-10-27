/**
 * Version of the Accessibility disclosure text (S06). Must equal the native
 * `Disclosure.CURRENT_VERSION`; bump both together when the text changes so consent is asked again.
 * History: 1 = first Phase 0 draft; 2 = adds the on-screen counter sentence (F03, D42); 3 = adds that Thumbwell may pause the
 * video and may tap the screen once at the limit, and takes the user to the app's Home screen on
 * Leave reels. Consent logged for an older version is never migrated: counting stays paused until
 * version 3 is accepted.
 */
export const DISCLOSURE_VERSION = '3';
