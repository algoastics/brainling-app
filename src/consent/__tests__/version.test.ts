import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

import en from '../../i18n/locales/en.json';
import { DISCLOSURE_VERSION } from '../version';

const nativePrefs = readFileSync(
  join(
    __dirname,
    '../../../modules/thumbwell-core/android/src/main/java/com/algoastics/thumbwell/core/data/CorePrefs.kt',
  ),
  'utf8',
);

describe('disclosure version 2 (F03, D42)', () => {
  it('is 2 and equals the native Disclosure.CURRENT_VERSION', () => {
    expect(DISCLOSURE_VERSION).toBe('2');
    expect(nativePrefs).toContain(`const val CURRENT_VERSION = "${DISCLOSURE_VERSION}"`);
  });

  it('uses the Scope v3 F03 wording, with the counter sentence', () => {
    expect(en.disclosure.title).toBe('Thumbwell uses Accessibility to count your reels.');
    expect(en.disclosure.p1).toBe(
      "To count Instagram Reels, YouTube Shorts and TikTok videos, Thumbwell uses Android's AccessibilityService API. Only while one of these apps is open, it reads the structure of the screen on your phone — which screen is showing, the labels of on-screen elements, and scroll events — to tell when a new short video starts.",
    );
    expect(en.disclosure.p2).toBe(
      'We use this only to count the short videos you watch and show you your count. While one of these apps is open, Thumbwell also shows a small movable counter on top of it, so you can see your count as you scroll; you can turn it off in Thumbwell settings. We also use it, when you reach your limit, to cover the reels screen or go back.',
    );
    expect(en.disclosure.p3).toBe(
      'Everything is processed on your phone. Thumbwell does not store any text it sees, does not record your screen, and does not keep or send your messages, comments or anything about the videos. Your counts stay on your phone.',
    );
    expect(en.disclosure.p4).toBe(
      'You can turn this off at any time in Android Settings → Accessibility.',
    );
    expect(en.disclosure.check).toBe(
      'I understand and agree that Thumbwell uses the Accessibility service as described above.',
    );
  });

  it('has the F18 service description in the plugin, matching the counter wording', () => {
    const plugin = readFileSync(
      join(__dirname, '../../../modules/thumbwell-core/app.plugin.js'),
      'utf8',
    );
    expect(plugin).toContain(
      "'Thumbwell counts the Instagram Reels, YouTube Shorts and TikTok videos you watch, shows your count on a small on-screen counter you can switch off, and, at your limit, covers the reels screen or goes back. Everything is processed on your phone.'",
    );
    expect(plugin).toContain('props.serviceDescription ??\n    SERVICE_DESCRIPTION');
  });
});
