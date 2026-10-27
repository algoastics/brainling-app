import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import ReenableScreen from '../../app/reenable';

const mockCore = {
  isServiceEnabled: jest.fn<() => Promise<boolean>>(),
  openAccessibilitySettings: jest.fn<() => Promise<void>>(),
};

jest.mock('thumbwell-core', () => ({
  __esModule: true,
  get default() {
    return mockCore;
  },
}));

const mockRouter = { canGoBack: jest.fn(() => false), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));

describe('reenable route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCore.openAccessibilitySettings.mockResolvedValue(undefined);
  });

  it('shows the disclosure before the settings link and opens settings only on tap', async () => {
    mockCore.isServiceEnabled.mockResolvedValue(false);
    await render(<ReenableScreen />);
    expect(await screen.findByText(/never reads your messages/i)).toBeTruthy();
    expect(mockCore.openAccessibilitySettings).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Open accessibility settings' }));
    expect(mockCore.openAccessibilitySettings).toHaveBeenCalledTimes(1);
  });

  it('confirms and offers a way home once the service is back on', async () => {
    mockCore.isServiceEnabled.mockResolvedValue(true);
    await render(<ReenableScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Back to Thumbwell' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
    expect(screen.queryByRole('button', { name: 'Open accessibility settings' })).toBeNull();
  });
});
