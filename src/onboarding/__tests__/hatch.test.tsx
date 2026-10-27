import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import HatchScreen from '@/app/(onboarding)/hatch';
import { initialOnboarding, useOnboardingStore } from '@/onboarding/store';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@/storage', () => jest.requireActual('../../../test/memoryStorage'));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  useOnboardingStore.setState(initialOnboarding);
});

async function hatch() {
  await render(<HatchScreen />);
  const egg = screen.getByRole('button', { name: 'Brain-pod' });
  for (let i = 0; i < 3; i++) await fireEvent.press(egg);
  await act(() => jest.runAllTimersAsync());
}

describe('S05 hatch and name', () => {
  it('cracks over three taps, then asks for a name', async () => {
    await render(<HatchScreen />);
    expect(screen.getByText('Tap 1 of 3')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Brain-pod' }));
    expect(screen.getByText('Tap 2 of 3')).toBeTruthy();
    expect(screen.queryByText('Say hi to your Thumbwell!')).toBeNull();
  });

  it('rejects a one-character name', async () => {
    await hatch();
    await fireEvent.changeText(screen.getByLabelText('Name (2–14 characters, emoji OK)'), 'B');
    await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
    expect(screen.getByText('Name needs 2–14 characters.')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('saves name and colour locally and moves on to the disclosure', async () => {
    await hatch();
    await fireEvent.changeText(screen.getByLabelText('Name (2–14 characters, emoji OK)'), ' Bean ');
    await fireEvent.press(screen.getByRole('radio', { name: 'Mint' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
    expect(useOnboardingStore.getState()).toMatchObject({
      mascotName: 'Bean',
      mascotColour: 'mint',
    });
    expect(router.push).toHaveBeenCalledWith('/disclosure');
  });
});
