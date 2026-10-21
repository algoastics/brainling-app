import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import BudgetScreen from '@/app/(onboarding)/budget';
import QuizScreen from '@/app/(onboarding)/quiz';
import { initialOnboarding, useOnboardingStore } from '@/onboarding/store';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@/storage', () => jest.requireActual('../../../test/memoryStorage'));

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingStore.setState(initialOnboarding);
});

describe('S03 quick quiz', () => {
  it('lists only the launch apps, pre-ticked, and toggles them', async () => {
    await render(<QuizScreen />);
    const instagram = screen.getByRole('checkbox', { name: 'Instagram' });
    expect(instagram).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'YouTube' })).toBeChecked();
    expect(screen.queryByText('TikTok')).toBeNull();
    await fireEvent.press(instagram);
    expect(useOnboardingStore.getState().apps).toEqual(['youtube']);
  });

  it('adjusts the reel guess with TalkBack actions', async () => {
    await render(<QuizScreen />);
    const slider = screen.getByRole('adjustable', { name: 'Your guess of reels per day' });
    expect(slider.props.accessibilityValue).toMatchObject({ now: 200, text: '200 reels' });
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(useOnboardingStore.getState().guess).toBe(210);
  });

  it('selects goals and continues to the budget', async () => {
    await render(<QuizScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Sleep better' }));
    expect(useOnboardingStore.getState().goals).toEqual(['sleep']);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(router.push).toHaveBeenCalledWith('/budget');
  });
});

describe('S04 budget', () => {
  it('steps the budget by 10 and updates the estimate', async () => {
    await render(<BudgetScreen />);
    expect(screen.getByLabelText('60 reels a day')).toBeTruthy();
    expect(
      screen.getByText('About 1 reel = 20–30 seconds. 60 reels ≈ 25 min (estimate).'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'More reels' }));
    expect(useOnboardingStore.getState().budget).toBe(70);
    expect(screen.getByLabelText('70 reels a day')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Fewer reels' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Fewer reels' }));
    expect(useOnboardingStore.getState().budget).toBe(50);
  });

  it('stops at the minimum', async () => {
    useOnboardingStore.setState({ budget: 10 });
    await render(<BudgetScreen />);
    expect(screen.getByRole('button', { name: 'Fewer reels' })).toBeDisabled();
  });

  it('opens the M22 Pro sheet from the per-app hint, then continues', async () => {
    await render(<BudgetScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Pro: a different limit for each app. Pro feature' }),
    );
    expect(screen.getByText('Per-app limits are Pro')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(router.push).toHaveBeenCalledWith('/hatch');
  });
});
