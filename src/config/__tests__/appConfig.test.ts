import { describe, expect, it } from '@jest/globals';

import { appConfig } from '../appConfig';

describe('appConfig', () => {
  it('keeps Phase 0 flags off and Sentry without a DSN', () => {
    expect(appConfig.flags.sentryEnabled).toBe(false);
    expect(appConfig.sentryDsn).toBe('');
    expect(Object.values(appConfig.flags).every((v) => v === false)).toBe(true);
  });

  it('uses dummy privacy and support placeholders', () => {
    expect(appConfig.privacyPolicyUrl).toBe('https://example.com/thumbwell/privacy');
    expect(appConfig.supportEmail).toBe('support@example.com');
  });
});
