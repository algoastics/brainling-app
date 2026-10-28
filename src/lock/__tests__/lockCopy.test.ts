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
function native(name: string, quantity?: 'one' | 'other'): string {
  const match = quantity
    ? new RegExp(`<plurals name="${name}">[\\s\\S]*?<item quantity="${quantity}">(.*)</item>`).exec(
        strings,
      )
    : new RegExp(`<string name="${name}">(.*)</string>`).exec(strings);
  if (!match) throw new Error(`missing native string ${name}`);
  return (match[1] ?? '')
    .replace(/\\'/g, "'")
    .replace('%1$d', '{{count}}')
    .replace('%1$s', '{{time}}');
}

describe('lock copy shared with the native overlay (S22-P0)', () => {
  it.each([
    ['thumbwell_lock_chip', 'chip'],
    ['thumbwell_lock_body', 'body'],
    ['thumbwell_lock_leave', 'leave'],
    ['thumbwell_lock_note_title', 'noteTitle'],
    ['thumbwell_lock_note_body', 'noteBody'],
  ])('%s matches lock.%s', (nativeName, key) => {
    expect(native(nativeName)).toBe(en.lock[key]);
  });

  it('matches the singular and plural headline', () => {
    expect(native('thumbwell_lock_title', 'one')).toBe(en.lock.title_one);
    expect(native('thumbwell_lock_title', 'other')).toBe(en.lock.title_other);
  });

  it('matches the singular and plural "today" caption', () => {
    expect(native('thumbwell_lock_today', 'one')).toBe(en.lock.today_one);
    expect(native('thumbwell_lock_today', 'other')).toBe(en.lock.today_other);
    expect(native('thumbwell_lock_today', 'one')).toBe('Today: {{count}} reel');
  });

  it('keeps the spec headline, singular for one reel', () => {
    expect(native('thumbwell_lock_title', 'one')).toBe("That's {{count}} reel. Time for a break.");
    expect(native('thumbwell_lock_title', 'other')).toBe(
      "That's {{count}} reels. Time for a break.",
    );
  });
});
