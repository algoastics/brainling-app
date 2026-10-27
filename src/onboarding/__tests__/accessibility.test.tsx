import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { startActivityAsync } from 'expo-intent-launcher';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import AccessibilityScreen from '@/app/(onboarding)/accessibility';
import RestrictedScreen from '@/app/(onboarding)/restricted';
import { initialOnboarding, useOnboardingStore } from '@/onboarding/store';

const mockCore = { isServiceEnabled: jest.fn(() => false), openAccessibilitySettings: jest.fn() };
jest.mock('thumbwell-core', () => ({
  __esModule: true,
  get default() {
    return mockCore;
  },
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  Redirect: ({ href }: { href: string }): ReactNode => {
    const { Text: T } = jest.requireActual<typeof import('react-native')>('react-native');
    return <T>{`redirect:${href}`}</T>;
  },
}));
jest.mock('expo-intent-launcher', () => ({
  ActivityAction: { APPLICATION_DETAILS_SETTINGS: 'android.settings.APPLICATION_DETAILS_SETTINGS' },
  startActivityAsync: jest.fn(() => Promise.resolve({ resultCode: 0 })),
}));
jest.mock('expo-application', () => ({ applicationId: 'com.algoastics.thumbwell' }));
jest.mock('@/storage', () => jest.requireActual('../../../test/memoryStorage'));

let foreground: ((s: AppStateStatus) => void) | undefined;
beforeEach(() => {
  jest.clearAllMocks();
  mockCore.isServiceEnabled.mockReturnValue(false);
  useOnboardingStore.setState({ ...initialOnboarding, disclosureAcceptedAt: 1 });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
    foreground = fn as (s: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });
});

describe('settings screens need the disclosure first', () => {
  it.each([
    ['S07', AccessibilityScreen],
    ['S07-restricted', RestrictedScreen],
  ])('%s redirects to S06 when consent is missing', async (_name, Screen) => {
    useOnboardingStore.setState({ disclosureAcceptedAt: null });
    await render(<Screen />);
    expect(screen.getByText('redirect:/disclosure')).toBeTruthy();
    expect(mockCore.openAccessibilitySettings).not.toHaveBeenCalled();
  });
});

describe('S07-restricted', () => {
  it('walks through App info > ⋮ > Allow restricted settings', async () => {
    await render(<RestrictedScreen />);
    expect(screen.getByLabelText('2. Tap ⋮ (top right)')).toBeTruthy();
    expect(screen.getByLabelText('3. Tap “Allow restricted settings”')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open App info' }));
    expect(startActivityAsync).toHaveBeenCalledWith(
      'android.settings.APPLICATION_DETAILS_SETTINGS',
      { data: 'package:com.algoastics.thumbwell' },
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Done — turn on Accessibility' }));
    expect(router.push).toHaveBeenCalledWith('/accessibility');
  });
});

describe('S07 accessibility guide', () => {
  it('opens settings, shows "still off" on return, then success once enabled', async () => {
    await render(<AccessibilityScreen />);
    expect(screen.getByText(/banking or payment apps/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Accessibility settings' }));
    expect(mockCore.openAccessibilitySettings).toHaveBeenCalledTimes(1);

    await act(() => foreground?.('active'));
    expect(screen.getByText('Still off — try again')).toBeTruthy();

    mockCore.isServiceEnabled.mockReturnValue(true);
    await act(() => foreground?.('active'));
    expect(screen.getByText('Counting is ON')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(router.push).toHaveBeenCalledWith('/notifications');
  });
});
