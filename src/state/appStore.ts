import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/storage';

type AppState = {
  onboardingCompleted: boolean;
  completeOnboarding: () => void;
};

/** App-level flags persisted in encrypted MMKV. Feature stores live next to their modules. */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      onboardingCompleted: false,
      completeOnboarding: () => set({ onboardingCompleted: true }),
    }),
    {
      name: 'app',
      version: 1,
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ onboardingCompleted }) => ({ onboardingCompleted }),
    },
  ),
);
