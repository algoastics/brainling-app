import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { useAppStore } from '@/state/appStore';

import TesterSetupScreen from '../../app/tester-setup';

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

const mockRouter = { replace: jest.fn() };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('@/storage', () => jest.requireActual('../../../test/memoryStorage'));

describe('tester setup route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCore.openAccessibilitySettings.mockResolvedValue(undefined);
    useAppStore.setState({ testerSetupDone: false });
  });

  it('shows the disclosure and steps, opens settings only on tap', async () => {
    mockCore.isServiceEnabled.mockResolvedValue(false);
    await render(<TesterSetupScreen />);
    expect(await screen.findByText('Off')).toBeTruthy();
    expect(screen.getByText(/never reads your messages/i)).toBeTruthy();
    expect(screen.getByText(/Allow restricted settings/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Accessibility settings' }));
    expect(mockCore.openAccessibilitySettings).toHaveBeenCalledTimes(1);
  });

  it('offers Continue once the service is on', async () => {
    mockCore.isServiceEnabled.mockResolvedValue(true);
    await render(<TesterSetupScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Continue' }));
    expect(useAppStore.getState().testerSetupDone).toBe(true);
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});
