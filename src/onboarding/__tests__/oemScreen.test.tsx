import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { startActivityAsync } from 'expo-intent-launcher';
import { router } from 'expo-router';

import OemScreen from '@/app/(onboarding)/oem';
import { initialOnboarding, useOnboardingStore } from '@/onboarding/store';

const mockDevice: { manufacturer: string | null; brand: string | null } = {
  manufacturer: null,
  brand: null,
};
jest.mock('expo-device', () => ({
  get manufacturer() {
    return mockDevice.manufacturer;
  },
  get brand() {
    return mockDevice.brand;
  },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('expo-intent-launcher', () => ({
  ActivityAction: { APPLICATION_DETAILS_SETTINGS: 'android.settings.APPLICATION_DETAILS_SETTINGS' },
  startActivityAsync: jest.fn(() => Promise.resolve({ resultCode: 0 })),
}));
jest.mock('expo-application', () => ({ applicationId: 'com.algoastics.brainling' }));
jest.mock('@/storage', () => jest.requireActual('../../../test/memoryStorage'));

beforeEach(() => {
  jest.clearAllMocks();
  mockDevice.manufacturer = null;
  mockDevice.brand = null;
  useOnboardingStore.setState(initialOnboarding);
});

describe('S10 phone-maker guides', () => {
  it('starts with Samsung when the maker is unknown', async () => {
    await render(<OemScreen />);
    expect(screen.getByText('Guide for: Samsung · One UI')).toBeTruthy();
    expect(screen.getByLabelText('3. Turn off “Put unused apps to sleep”')).toBeTruthy();
  });

  it('shows the detected maker first and pages to the others', async () => {
    mockDevice.manufacturer = 'Xiaomi';
    mockDevice.brand = 'Redmi';
    await render(<OemScreen />);
    expect(screen.getByText('Detected: Xiaomi / Redmi / POCO · MIUI / HyperOS')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next phone maker' }));
    expect(screen.getByText('Guide for: Samsung · One UI')).toBeTruthy();
  });

  it('opens only the explicit component and falls back to the manual path', async () => {
    mockDevice.manufacturer = 'Xiaomi';
    jest.mocked(startActivityAsync).mockRejectedValueOnce(new Error('not found'));
    await render(<OemScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open the setting' }));
    expect(startActivityAsync).toHaveBeenCalledWith('android.intent.action.MAIN', {
      packageName: 'com.miui.securitycenter',
      className: 'com.miui.permcenter.autostart.AutoStartManagementActivity',
    });
    expect(await screen.findByText('Couldn’t open it. Settings → Apps → Brainling')).toBeTruthy();
  });

  it('records the step and continues to the setup check', async () => {
    await render(<OemScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'I did it' }));
    expect(useOnboardingStore.getState().autostart).toBe('done');
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/setup-check'));
  });
});
