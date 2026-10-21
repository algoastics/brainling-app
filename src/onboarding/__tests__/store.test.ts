import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { initialOnboarding, useOnboardingStore } from '../store';

jest.mock('@/storage', () => {
  const mem = new Map<string, string>();
  return {
    zustandStorage: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    },
    __mem: mem,
  };
});

const { __mem: mem } = jest.requireMock<{ __mem: Map<string, string> }>('@/storage');

beforeEach(() => {
  useOnboardingStore.setState(initialOnboarding);
});

describe('useOnboardingStore', () => {
  it('starts with both launch apps ticked and the kit defaults', () => {
    const s = useOnboardingStore.getState();
    expect(s.apps).toEqual(['instagram', 'youtube']);
    expect(s.budget).toBe(60);
    expect(s.guess).toBe(200);
    expect(s.disclosureAcceptedAt).toBeNull();
  });

  it('toggles apps and goals', () => {
    const { toggleApp, toggleGoal } = useOnboardingStore.getState();
    toggleApp('youtube');
    toggleGoal('sleep');
    toggleGoal('focus');
    toggleGoal('sleep');
    expect(useOnboardingStore.getState().apps).toEqual(['instagram']);
    expect(useOnboardingStore.getState().goals).toEqual(['focus']);
  });

  it('trims the mascot name and persists answers to encrypted storage', () => {
    useOnboardingStore.getState().setMascot('  Bean ', 'mint');
    useOnboardingStore.getState().acceptDisclosure(1234);
    const saved = JSON.parse(mem.get('onboarding') ?? '{}') as {
      state: { mascotName: string; mascotColour: string; disclosureAcceptedAt: number };
    };
    expect(saved.state).toMatchObject({
      mascotName: 'Bean',
      mascotColour: 'mint',
      disclosureAcceptedAt: 1234,
    });
  });
});
