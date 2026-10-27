import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/storage';

/** What the user picked in Settings, Theme (Figma A61). "system" follows the phone. */
export type ThemePreference = 'system' | 'light' | 'dark';

export type ColorSchemeName = 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** The scheme to draw: an explicit pick wins, "system" follows the phone (light when unknown). */
export function resolveScheme(
  preference: ThemePreference,
  system: string | null | undefined,
): ColorSchemeName {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

type ThemePreferenceState = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

/** The theme choice, persisted in encrypted MMKV and applied live by `ThemeProvider`. */
export const useThemePreference = create<ThemePreferenceState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: 'theme-preference',
      version: 1,
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ preference }) => ({ preference }),
      merge: (persisted, current) => {
        const stored = (persisted as { preference?: unknown } | undefined)?.preference;
        return { ...current, preference: isThemePreference(stored) ? stored : current.preference };
      },
    },
  ),
);
