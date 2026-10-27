import { describe, expect, it } from '@jest/globals';

import { buildFeedbackMailto } from '../feedback';

describe('buildFeedbackMailto', () => {
  const url = buildFeedbackMailto({
    email: 'support@example.com',
    subject: 'Thumbwell feedback',
    intro: 'Write your feedback above this line.',
    appVersion: '1.0.0',
    build: '7',
    device: 'Google Pixel 8',
    os: '15',
  });

  it('addresses the support mailbox with a subject', () => {
    expect(url.startsWith('mailto:support@example.com?subject=Thumbwell%20feedback&body=')).toBe(
      true,
    );
  });

  it('puts app version and device info in the body and nothing else', () => {
    const body = decodeURIComponent(url.split('&body=')[1] ?? '');
    expect(body).toContain('App: 1.0.0 (7)');
    expect(body).toContain('Device: Google Pixel 8');
    expect(body).toContain('Android: 15');
    expect(body.split('\n').filter(Boolean)).toHaveLength(4);
  });
});
