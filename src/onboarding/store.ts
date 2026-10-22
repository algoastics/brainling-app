import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/storage';

import { BUDGET, GUESS } from './flow';

export const QUIZ_APPS = ['instagram', 'youtube'] as const;
export type QuizApp = (typeof QUIZ_APPS)[number];

export const GOALS = ['sleep', 'focus', 'family', 'curious'] as const;
export type Goal = (typeof GOALS)[number];

export const MASCOT_COLOURS = ['pink', 'ice', 'mint'] as const;
export type MascotColour = (typeof MASCOT_COLOURS)[number];

/** `done` means the user went through the step; Android offers no read-back for some of them. */
export type StepStatus = 'pending' | 'done' | 'skipped';

type OnboardingData = {
  apps: QuizApp[];
  guess: number;
  goals: Goal[];
  budget: number;
  mascotName: string;
  mascotColour: MascotColour;
  /** Epoch ms when S06 was accepted; `null` until then. */
  disclosureAcceptedAt: number | null;
  notifications: StepStatus;
  battery: StepStatus;
  autostart: StepStatus;
};

type OnboardingActions = {
  toggleApp: (app: QuizApp) => void;
  setGuess: (guess: number) => void;
  toggleGoal: (goal: Goal) => void;
  setBudget: (budget: number) => void;
  setMascot: (name: string, colour: MascotColour) => void;
  acceptDisclosure: (at: number) => void;
  setStep: (step: 'notifications' | 'battery' | 'autostart', status: StepStatus) => void;
};

export type OnboardingState = OnboardingData & OnboardingActions;

export const initialOnboarding: OnboardingData = {
  apps: [...QUIZ_APPS],
  guess: GUESS.initial,
  goals: [],
  budget: BUDGET.initial,
  mascotName: '',
  mascotColour: 'pink',
  disclosureAcceptedAt: null,
  notifications: 'pending',
  battery: 'pending',
  autostart: 'pending',
};

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** Onboarding answers, kept on this phone only (encrypted MMKV); nothing here leaves the device. */
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialOnboarding,
      toggleApp: (app) => set((s) => ({ apps: toggle(s.apps, app) })),
      setGuess: (guess) => set({ guess }),
      toggleGoal: (goal) => set((s) => ({ goals: toggle(s.goals, goal) })),
      setBudget: (budget) => set({ budget }),
      setMascot: (mascotName, mascotColour) => set({ mascotName: mascotName.trim(), mascotColour }),
      acceptDisclosure: (at) => set({ disclosureAcceptedAt: at }),
      setStep: (step, status) => set({ [step]: status }),
    }),
    {
      name: 'onboarding',
      version: 1,
      storage: createJSONStorage(() => zustandStorage),
      partialize: (s): OnboardingData => ({
        apps: s.apps,
        guess: s.guess,
        goals: s.goals,
        budget: s.budget,
        mascotName: s.mascotName,
        mascotColour: s.mascotColour,
        disclosureAcceptedAt: s.disclosureAcceptedAt,
        notifications: s.notifications,
        battery: s.battery,
        autostart: s.autostart,
      }),
    },
  ),
);
