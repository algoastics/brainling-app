import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { StepIndicator } from '@/components/ui';
import { useOverlayStage } from '@/onboarding/overlayStage';
import { onboardingStepFor } from '@/onboarding/steps';

import { OnboardingLayout } from '../OnboardingLayout';

const route = { pathname: '/welcome', params: {} as Record<string, string> };
jest.mock('expo-router', () => ({
  Stack: () => null,
  usePathname: () => route.pathname,
  useGlobalSearchParams: () => route.params,
}));

beforeEach(() => {
  route.pathname = '/welcome';
  route.params = {};
  useOverlayStage.setState({ active: false });
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('onboarding header', () => {
  it('stays mounted and changes in place when the step changes', async () => {
    const view = await render(<OnboardingLayout />);
    const header = screen.getByTestId('onboarding-header');
    expect(screen.getByLabelText('1 of 4')).toBeTruthy();

    for (const [path, label] of [
      ['/limit', '2 of 4'],
      ['/disclosure', '3 of 4'],
      ['/guide', '3 of 4'],
    ] as const) {
      route.pathname = path;
      await view.rerender(<OnboardingLayout />);
      expect(screen.getByTestId('onboarding-header')).toBe(header);
      expect(screen.getByLabelText(label)).toBeTruthy();
    }

    await act(async () => useOverlayStage.setState({ active: true }));
    expect(screen.getByTestId('onboarding-header')).toBe(header);
    expect(screen.getByLabelText('4 of 4')).toBeTruthy();
  });

  it('is hidden when the disclosure is opened outside the first run', async () => {
    route.pathname = '/disclosure';
    route.params = { from: 'home' };
    await render(<OnboardingLayout />);
    expect(screen.queryByTestId('onboarding-header')).toBeNull();
    expect(screen.getByTestId('onboarding-layout')).toBeTruthy();
  });
});

describe('step animation', () => {
  it('animates the pills and the counter by default', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const view = await render(<StepIndicator current={1} total={4} />);
    timing.mockClear();
    await view.rerender(<StepIndicator current={2} total={4} />);
    expect(timing).toHaveBeenCalled();
    expect(screen.getByLabelText('2 of 4')).toBeTruthy();
  });

  it('swaps at once with reduced motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const view = await render(<StepIndicator current={1} total={4} />);
    await act(async () => undefined);
    timing.mockClear();
    await view.rerender(<StepIndicator current={2} total={4} />);
    expect(timing).not.toHaveBeenCalled();
    expect(screen.getByLabelText('2 of 4')).toBeTruthy();
  });
});

describe('onboardingStepFor', () => {
  it('maps routes to steps and ignores the rest', () => {
    expect(onboardingStepFor('/welcome', undefined, false)).toBe(1);
    expect(onboardingStepFor('/limit', undefined, false)).toBe(2);
    expect(onboardingStepFor('/disclosure', undefined, false)).toBe(3);
    expect(onboardingStepFor('/disclosure', 'onboarding', false)).toBe(3);
    expect(onboardingStepFor('/disclosure', 'home', false)).toBeNull();
    expect(onboardingStepFor('/guide', undefined, false)).toBe(3);
    expect(onboardingStepFor('/guide', undefined, true)).toBe(4);
    expect(onboardingStepFor('/about', undefined, false)).toBeNull();
  });
});
