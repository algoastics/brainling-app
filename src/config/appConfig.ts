/**
 * Single app-level config for Thumbwell Phase 0.
 *
 * PLACEHOLDERS: the privacy-policy URL and the support email are DUMMY values. Replace both
 * before any store submission. Nothing else in the app should hard-code them.
 */
export const appConfig = {
  /** replace with the real hosted privacy policy. */
  privacyPolicyUrl: 'https://example.com/thumbwell/privacy',
  /** replace with the real support mailbox. */
  supportEmail: 'support@example.com',

  /** Feature flags. Phase 0 ships with all of these OFF. */
  flags: {
    /** Crash reporting. OFF: no DSN is configured and nothing initialises Sentry. */
    sentryEnabled: false,
    /** Facebook / Snapchat detection stays in code but is disabled until M3. */
    facebookEnabled: false,
    snapchatEnabled: false,
    /** Not part of Phase 0. */
    proEnabled: false,
    signInEnabled: false,
    analyticsEnabled: false,
  },

  /** Sentry DSN. Intentionally empty; Sentry never starts while `sentryEnabled` is false. */
  sentryDsn: '',
} as const;

export type AppConfig = typeof appConfig;
