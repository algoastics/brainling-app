import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/storage';

type AppState = {
  /** First-run flag: set when the user leaves the onboarding (S06 "Not now" or S07 done). */
  onboardingCompleted: boolean;
  completeOnboarding: () => void;
  /** Back to a first run (Settings, Delete my data). */
  resetApp: () => void;
};

/** App-level flags persisted in encrypted MMKV. Feature stores live next to their modules. */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      onboardingCompleted: false,
      completeOnboarding: () => set({ onboardingCompleted: true }),
      resetApp: () => set({ onboardingCompleted: false }),
    }),
    {
      name: 'app',
      version: 2,
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ onboardingCompleted }) => ({ onboardingCompleted }),
      migrate: (persisted) => ({
        onboardingCompleted: Boolean(
          (persisted as { onboardingCompleted?: boolean } | undefined)?.onboardingCompleted,
        ),
      }),
    },
  ),
);
