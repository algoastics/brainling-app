/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from '@jest/globals';

const root = join(__dirname, '..', '..', '..');
const strings = readFileSync(
  join(root, 'modules/thumbwell-core/android/src/main/res/values/thumbwell_lock_strings.xml'),
  'utf8',
);
const en = JSON.parse(readFileSync(join(root, 'src/i18n/locales/en.json'), 'utf8')) as {
  lock: Record<string, string>;
};

/** An Android string resource as i18next text: `%1$d` is `{{count}}`, `%1$s` is `{{time}}`. */
function native(name: string): string {
  const match = new RegExp(`<string name="${name}">(.*)</string>`).exec(strings);
  if (!match) throw new Error(`missing native string ${name}`);
  return (match[1] ?? '')
    .replace(/\\'/g, "'")
    .replace('%1$d', '{{count}}')
    .replace('%1$s', '{{time}}');
}

describe('lock copy shared with the native overlay (S22-P0)', () => {
  it.each([
    ['thumbwell_lock_chip', 'chip'],
    ['thumbwell_lock_title', 'title'],
    ['thumbwell_lock_body', 'body'],
    ['thumbwell_lock_leave', 'leave'],
    ['thumbwell_lock_today', 'today'],
  ])('%s matches lock.%s', (nativeName, key) => {
    expect(native(nativeName)).toBe(en.lock[key]);
  });

  it('keeps the spec headline', () => {
    expect(native('thumbwell_lock_title')).toBe("That's {{count}} reels. Time for a break.");
  });
});
