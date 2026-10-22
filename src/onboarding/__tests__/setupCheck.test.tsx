import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { DayCounts } from 'brainling-core';
import { router } from 'expo-router';
import { AppState, type AppStateStatus } from 'react-native';

import SetupCheckScreen from '@/app/(onboarding)/setup-check';
import { initialOnboarding, useOnboardingStore } from '@/onboarding/store';
import { useAppStore } from '@/state/appStore';

type Listener = (c: DayCounts) => void;
const day = (total: number): DayCounts =>
  ({ date: '2026-10-22', total, apps: {} }) as unknown as DayCounts;
const mockCore = {
  listeners: new Set<Listener>(),
  isServiceEnabled: jest.fn(() => true),
  getTodayCounts: jest.fn(() => day(10)),
  addListener: jest.fn((_e: string, fn: Listener) => {
    mockCore.listeners.add(fn);
    return { remove: () => mockCore.listeners.delete(fn) };
  }),
};
jest.mock('brainling-core', () => ({
  __esModule: true,
  get default() {
    return mockCore;
  },
}));
jest.mock('expo-device', () => ({ manufacturer: 'samsung', brand: 'samsung' }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@/storage', () => jest.requireActual('../../../test/memoryStorage'));

let appState: ((s: AppStateStatus) => void)[] = [];
const emit = (s: AppStateStatus) => act(() => appState.forEach((fn) => fn(s)));
const count = (total: number) => act(() => mockCore.listeners.forEach((fn) => fn(day(total))));

beforeEach(() => {
  jest.clearAllMocks();
  appState = [];
  mockCore.listeners.clear();
  mockCore.isServiceEnabled.mockReturnValue(true);
  mockCore.getTodayCounts.mockReturnValue(day(10));
  useOnboardingStore.setState({
    ...initialOnboarding,
    notifications: 'done',
    battery: 'done',
    autostart: 'skipped',
  });
  useAppStore.setState({ onboardingCompleted: false });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
    appState.push(fn as (s: AppStateStatus) => void);
    return { remove: () => (appState = appState.filter((f) => f !== fn)) } as never;
  });
});

describe('S13 setup check', () => {
  it('summarises each step; no overlay permission is asked', async () => {
    await render(<SetupCheckScreen />);
    expect(screen.getByLabelText('Accessibility: On')).toBeTruthy();
    expect(screen.getByLabelText('Battery: On')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Autostart (Samsung): Skipped' })).toBeTruthy();
    expect(screen.getByLabelText('Overlay: Not needed')).toBeTruthy();
  });

  it('links back to S07 when accessibility is off and blocks the test', async () => {
    mockCore.isServiceEnabled.mockReturnValue(false);
    await render(<SetupCheckScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Accessibility: Off — tap to fix' }));
    expect(router.push).toHaveBeenCalledWith('/accessibility');
    expect(screen.getByRole('button', { name: 'Run test' })).toBeDisabled();
  });

  it('passes after three new reels and finishes onboarding', async () => {
    await render(<SetupCheckScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Run test' }));
    await emit('background');
    await count(12);
    expect(screen.getByLabelText('2 of 3 reels counted')).toBeTruthy();
    await count(13);
    expect(screen.getByText('3 reels counted!')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Finish' }));
    expect(useAppStore.getState().onboardingCompleted).toBe(true);
  });

  it('fails only once the user is back with too few reels, and can retry', async () => {
    await render(<SetupCheckScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Run test' }));
    await emit('background');
    mockCore.getTodayCounts.mockReturnValue(day(11));
    await emit('active');
    expect(screen.getByText('We couldn’t see reels')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Setup check')).toBeTruthy();
  });
});
