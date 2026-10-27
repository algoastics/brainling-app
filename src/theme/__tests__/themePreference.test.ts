import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  isThemePreference,
  resolveScheme,
  THEME_PREFERENCES,
  useThemePreference,
} from '../themePreference';
import { memoryStore } from '../../../test/memoryStorage';

jest.mock('@/storage', () => jest.requireActual('../../../test/memoryStorage'));

describe('resolveScheme', () => {
  it('follows the phone for "system" and treats unknown as light', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('system', undefined)).toBe('light');
  });

  it('lets an explicit pick win over the phone', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
});

describe('theme preference store', () => {
  beforeEach(() => {
    memoryStore.clear();
    useThemePreference.setState({ preference: 'system' });
  });

  it('lists System, Light and Dark in the Figma order', () => {
    expect(THEME_PREFERENCES).toEqual(['system', 'light', 'dark']);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('sepia')).toBe(false);
  });

  it('persists the pick and restores it', async () => {
    useThemePreference.getState().setPreference('dark');
    const stored = memoryStore.get('theme-preference') as string;
    expect(JSON.parse(stored).state).toEqual({ preference: 'dark' });
    useThemePreference.setState({ preference: 'system' });
    memoryStore.set('theme-preference', stored);
    await useThemePreference.persist.rehydrate();
    expect(useThemePreference.getState().preference).toBe('dark');
  });

  it('ignores a stored value that is not a preference', async () => {
    memoryStore.set(
      'theme-preference',
      JSON.stringify({ state: { preference: 'sepia' }, version: 1 }),
    );
    await useThemePreference.persist.rehydrate();
    expect(useThemePreference.getState().preference).toBe('system');
  });
});
