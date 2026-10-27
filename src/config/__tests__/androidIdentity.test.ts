/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from '@jest/globals';

const root = join(__dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const app = JSON.parse(read('app.json')) as {
  expo: { plugins: (string | [string, unknown])[]; android: { package: string } };
};
const pluginName = (p: string | [string, unknown]) => (typeof p === 'string' ? p : p[0]);

/**
 * "The app is installed twice" guard: the build must produce ONE application id and ONE launcher
 * entry. The generated manifest and the APK are checked by scripts/check-android-identity.sh.
 */
describe('android identity', () => {
  it('has one package id, shared with iOS, and no leftover Brainling id', () => {
    expect(app.expo.android.package).toBe('com.algoastics.thumbwell');
    const text = read('app.json');
    expect(text).not.toMatch(/brainling/i);
    expect(text).not.toMatch(/applicationIdSuffix|appIdSuffix/i);
  });

  it('adds no plugin that creates a second launcher (dev client, aliases, extra activities)', () => {
    const names = app.expo.plugins.map(pluginName);
    expect(names.some((n) => /dev-client|dev-launcher|dev-menu/.test(n))).toBe(false);
    for (const file of ['modules/thumbwell-core/app.plugin.js', 'plugins/withGradleJvmArgs.js']) {
      expect(read(file)).not.toMatch(
        /activity-alias|android\.intent\.category\.LAUNCHER|'activity'/,
      );
    }
  });

  it('declares no product flavors or application id suffix in the module build', () => {
    const gradle = read('modules/thumbwell-core/android/build.gradle');
    expect(gradle).not.toMatch(/productFlavors|applicationIdSuffix/);
  });
});
