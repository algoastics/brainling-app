import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useAppStore } from '@/state/appStore';

import TesterSetupScreen from '../../app/tester-setup';

const mockCore = {
  isServiceEnabled: jest.fn<() => Promise<boolean>>(),
  openAccessibilitySettings: jest.fn<() => Promise<void>>(),
  setConsent: jest.fn<(version: string) => Promise<unknown>>(),
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
    mockCore.setConsent.mockResolvedValue({ atMs: 1, version: '1' });
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
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(mockCore.setConsent).toHaveBeenCalledWith('1');
    expect(useAppStore.getState().testerSetupDone).toBe(true);
  });
});
