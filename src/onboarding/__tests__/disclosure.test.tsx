import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import DisclosureScreen from '@/app/(onboarding)/disclosure';
import { initialOnboarding, useOnboardingStore } from '@/onboarding/store';
import { useAppStore } from '@/state/appStore';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@/storage', () => jest.requireActual('../../../test/memoryStorage'));

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingStore.setState(initialOnboarding);
  useAppStore.setState({ onboardingCompleted: false });
});

describe('S06 prominent disclosure', () => {
  it('shows what is read, why, and what is never done', async () => {
    await render(<DisclosureScreen />);
    expect(screen.getByRole('header', { name: /needs Accessibility/ })).toBeTruthy();
    expect(screen.getByText(/AccessibilityService API/)).toBeTruthy();
    expect(screen.getByText(/do not record your screen/)).toBeTruthy();
  });

  it('cannot continue until the box is ticked', async () => {
    await render(<DisclosureScreen />);
    const agree = screen.getByRole('button', { name: 'Agree & continue' });
    expect(agree).toBeDisabled();
    await fireEvent.press(agree);
    expect(router.push).not.toHaveBeenCalled();
    expect(useOnboardingStore.getState().disclosureAcceptedAt).toBeNull();
  });

  it('records consent and goes to the restricted-settings guide on Android 13+', async () => {
    Object.defineProperty(Platform, 'Version', { get: () => 34, configurable: true });
    Platform.OS = 'android';
    await render(<DisclosureScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: /I understand and agree/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Agree & continue' }));
    expect(useOnboardingStore.getState().disclosureAcceptedAt).toEqual(expect.any(Number));
    expect(router.push).toHaveBeenCalledWith('/restricted');
  });

  it('"Not now" finishes onboarding without opening any settings', async () => {
    await render(<DisclosureScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(useAppStore.getState().onboardingCompleted).toBe(true);
    expect(router.push).not.toHaveBeenCalled();
  });
});
