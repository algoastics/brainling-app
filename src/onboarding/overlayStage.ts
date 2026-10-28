import { create } from 'zustand';

type OverlayStage = {
  /** True while the guide shows its "Display over other apps" stage (onboarding step 4). */
  active: boolean;
  set: (active: boolean) => void;
};

/** In-memory only: tells the persistent onboarding header which step the guide is on. */
export const useOverlayStage = create<OverlayStage>()((set) => ({
  active: false,
  set: (active) => set({ active }),
}));
