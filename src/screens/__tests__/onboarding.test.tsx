import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { core, resetCore } from '../../../test/thumbwellCoreMock';
import { params, resetRouter, router } from '../../../test/routerMock';
import { useAppStore } from '@/state/appStore';
import { DISCLOSURE_VERSION } from '@/consent/version';

import { DisclosureScreen } from '../DisclosureScreen';
import { LimitScreen } from '../LimitScreen';
import { SPLASH_MS, SplashScreen } from '../SplashScreen';
import { WelcomeScreen } from '../WelcomeScreen';

jest.mock('thumbwell-core', () => ({
  __esModule: true,
  default: (jest.requireActual('../../../test/thumbwellCoreMock') as { core: object }).core,
}));
jest.mock(
  'expo-router',
  () => (jest.requireActual('../../../test/routerMock') as { routerModule: object }).routerModule,
);
jest.mock('@/storage', () => jest.requireActual('../../../test/memoryStorage'));

beforeEach(() => {
  resetCore();
  resetRouter();
  useAppStore.setState({ onboardingCompleted: false });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('splash routing', () => {
  it.each([
    [false, '/welcome'],
    [true, '/(tabs)'],
  ])('onboarding done = %s routes to %s after the splash', async (done, route) => {
    jest.useFakeTimers();
    useAppStore.setState({ onboardingCompleted: done });
    await render(<SplashScreen />);
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(SPLASH_MS);
    });
    expect(router.replace).toHaveBeenCalledWith(route);
  });
});

describe('welcome and limit', () => {
  it('continues from welcome to the limit step', async () => {
    await render(<WelcomeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: "Let's set it up" }));
    expect(router.push).toHaveBeenCalledWith('/limit');
  });

  it('starts at 60, steps by 5, takes a preset and saves the limit natively', async () => {
    await render(<LimitScreen />);
    expect(screen.getByTestId('limit-value')).toHaveAccessibilityValue({ text: '60' });
    await fireEvent.press(screen.getByTestId('limit-more'));
    expect(screen.getByTestId('limit-value')).toHaveAccessibilityValue({ text: '65' });
    await fireEvent.press(screen.getByTestId('limit-preset-100'));
    expect(screen.getByTestId('limit-value')).toHaveAccessibilityValue({ text: '100' });
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(core.setDailyLimit).toHaveBeenCalledWith(100));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/disclosure'));
  });

  it('stays on the step and says so when the limit cannot be saved', async () => {
    core.setDailyLimit.mockRejectedValue(new Error('native'));
    await render(<LimitScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Could not save your limit. Try again.')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('disclosure gating', () => {
  it('shows the exact disclosure text', async () => {
    await render(<DisclosureScreen />);
    expect(screen.getByText('Thumbwell uses Accessibility to count your reels.')).toBeTruthy();
    expect(
      screen.getByText('You can turn this off at any time in Android Settings → Accessibility.'),
    ).toBeTruthy();
  });

  it('keeps Agree & continue disabled until the box is ticked', async () => {
    await render(<DisclosureScreen />);
    const agree = screen.getByRole('button', { name: 'Agree & continue' });
    expect(agree).toBeDisabled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    await fireEvent.press(agree);
    expect(core.setConsent).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('disclosure-check'));
    expect(screen.getByRole('button', { name: 'Agree & continue' })).toBeEnabled();
  });

  it('logs consent for the current version, then goes to the guide', async () => {
    await render(<DisclosureScreen />);
    await fireEvent.press(screen.getByTestId('disclosure-check'));
    await fireEvent.press(screen.getByRole('button', { name: 'Agree & continue' }));
    await waitFor(() => expect(core.setConsent).toHaveBeenCalledWith(DISCLOSURE_VERSION));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/guide'));
    expect(core.openAccessibilitySettings).not.toHaveBeenCalled();
  });

  it('shows the version 3 permission sentence and logs consent for "3"', async () => {
    await render(<DisclosureScreen />);
    expect(screen.getByText(/Display over other apps/)).toBeTruthy();
    expect(screen.getByText(/pause the video that is playing/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('disclosure-check'));
    await fireEvent.press(screen.getByRole('button', { name: 'Agree & continue' }));
    await waitFor(() => expect(core.setConsent).toHaveBeenCalledWith('3'));
  });

  it('does not continue when consent could not be logged', async () => {
    core.setConsent.mockRejectedValue(new Error('native'));
    await render(<DisclosureScreen />);
    await fireEvent.press(screen.getByTestId('disclosure-check'));
    await fireEvent.press(screen.getByRole('button', { name: 'Agree & continue' }));
    expect(await screen.findByText('Could not save your choice. Try again.')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('"Not now" during onboarding finishes it and lands on Home without consent', async () => {
    await render(<DisclosureScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(useAppStore.getState().onboardingCompleted).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
    expect(core.setConsent).not.toHaveBeenCalled();
  });

  it('shows step 3 of 4 during onboarding', async () => {
    await render(<DisclosureScreen />);
    expect(screen.getByText('3 of 4')).toBeTruthy();
  });

  it('"Not now" from the Home banner just goes back', async () => {
    params.current = { from: 'home' };
    await render(<DisclosureScreen />);
    expect(screen.queryByText('3 of 4')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(router.back).toHaveBeenCalled();
  });
});
