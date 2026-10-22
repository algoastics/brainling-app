import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { startActivityAsync } from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import BatteryScreen from '@/app/(onboarding)/battery';
import NotificationsScreen from '@/app/(onboarding)/notifications';
import { initialOnboarding, useOnboardingStore } from '@/onboarding/store';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
}));
jest.mock('expo-intent-launcher', () => ({
  ActivityAction: {
    APPLICATION_DETAILS_SETTINGS: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    IGNORE_BATTERY_OPTIMIZATION_SETTINGS: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
  },
  startActivityAsync: jest.fn(() => Promise.resolve({ resultCode: 0 })),
}));
jest.mock('expo-application', () => ({ applicationId: 'com.algoastics.brainling' }));
jest.mock('@/storage', () => jest.requireActual('../../../test/memoryStorage'));

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingStore.setState({ ...initialOnboarding, mascotName: 'Bean' });
});

describe('S08 notification primer', () => {
  it('shows MVP-only examples with the mascot name', async () => {
    await render(<NotificationsScreen />);
    expect(screen.getByText('Bean is getting crispy.')).toBeTruthy();
    expect(screen.queryByText(/challenged you/)).toBeNull();
  });

  it('asks for the permission, records the answer and moves on', async () => {
    await render(<NotificationsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Allow notifications' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/battery'));
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(useOnboardingStore.getState().notifications).toBe('done');
  });

  it('can be skipped', async () => {
    await render(<NotificationsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(useOnboardingStore.getState().notifications).toBe('skipped');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('S09 battery', () => {
  it('opens battery optimisation settings, then the phone-maker guide', async () => {
    await render(<BatteryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Allow' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/oem'));
    expect(startActivityAsync).toHaveBeenCalledWith(
      'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
    );
    expect(useOnboardingStore.getState().battery).toBe('done');
  });

  it('falls back to App info when the list cannot open', async () => {
    jest.mocked(startActivityAsync).mockRejectedValueOnce(new Error('no activity'));
    await render(<BatteryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Allow' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/oem'));
    expect(startActivityAsync).toHaveBeenLastCalledWith(
      'android.settings.APPLICATION_DETAILS_SETTINGS',
      { data: 'package:com.algoastics.brainling' },
    );
  });
});
