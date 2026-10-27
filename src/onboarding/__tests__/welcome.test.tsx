import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import WelcomeScreen from '@/app/(onboarding)/welcome';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/storage', () => jest.requireActual('../../../test/memoryStorage'));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('S02 welcome carousel', () => {
  it('pages through the three cards, then starts the quiz', async () => {
    await render(<WelcomeScreen />);
    expect(screen.getByText('You scrolled 300 reels today. Did you notice?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    const start = screen.getByRole('button', { name: 'Get started' });
    expect(router.push).not.toHaveBeenCalled();
    await fireEvent.press(start);
    expect(router.push).toHaveBeenCalledWith('/quiz');
  });

  it('describes each illustration and hides the account link (S12 is v1.1)', async () => {
    await render(<WelcomeScreen />);
    expect(screen.getByLabelText('300 reels today, counted across your apps')).toBeTruthy();
    expect(screen.getByLabelText('A happy Thumbwell turning into a fried one')).toBeTruthy();
    expect(screen.queryByText('I already have an account')).toBeNull();
  });
});
