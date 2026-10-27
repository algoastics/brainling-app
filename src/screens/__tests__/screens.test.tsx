import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Linking, type AppStateStatus } from 'react-native';

import { core, dayCounts, resetCore, runningStatus } from '../../../test/thumbwellCoreMock';
import { resetRouter, router } from '../../../test/routerMock';
import { useAppStore } from '@/state/appStore';

import { Thumb } from '@/components/mascot';
import { resetAppIconCache } from '@/detection';

import { AboutScreen } from '../AboutScreen';
import { GuideScreen } from '../GuideScreen';
import { HomeScreen } from '../HomeScreen';
import { LockView } from '../lock/LockView';
import { SettingsScreen } from '../SettingsScreen';

jest.mock('thumbwell-core', () => ({
  __esModule: true,
  default: (jest.requireActual('../../../test/thumbwellCoreMock') as { core: object }).core,
}));
jest.mock(
  'expo-router',
  () => (jest.requireActual('../../../test/routerMock') as { routerModule: object }).routerModule,
);
jest.mock('@/storage', () => jest.requireActual('../../../test/memoryStorage'));
jest.mock('@/system/settings', () => ({ openAppInfo: jest.fn() }));

let appStateHandlers: ((s: AppStateStatus) => void)[] = [];

beforeEach(() => {
  resetAppIconCache();
  resetCore();
  resetRouter();
  useAppStore.setState({ onboardingCompleted: true });
  appStateHandlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandlers.push(handler as (s: AppStateStatus) => void);
    return { remove: jest.fn() } as never;
  });
});
afterEach(() => {
  jest.restoreAllMocks();
});

type ArtNode = { props: Record<string, unknown>; children: (string | ArtNode)[] };

describe('guide (S07)', () => {
  it('hands back to the disclosure when consent is not logged', async () => {
    core.getCountingStatus.mockResolvedValue({
      ...runningStatus,
      consentLogged: false,
      serviceEnabled: false,
      paused: true,
      pausedReason: 'consent_missing',
    });
    await render(<GuideScreen />);
    expect(await screen.findByTestId('redirect')).toHaveTextContent(/\/disclosure/);
    expect(core.openAccessibilitySettings).not.toHaveBeenCalled();
  });

  it('opens the settings, then says "Still off, try again" when the service is still off', async () => {
    core.getCountingStatus.mockResolvedValue({
      ...runningStatus,
      serviceEnabled: false,
      paused: true,
      pausedReason: 'service_disabled',
    });
    await render(<GuideScreen />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Open Accessibility settings' }),
    );
    expect(core.openAccessibilitySettings).toHaveBeenCalledTimes(1);
    await act(async () => {
      appStateHandlers.forEach((h) => h('active'));
    });
    expect(await screen.findByText('Still off, try again')).toBeTruthy();
  });

  it('shows success once the service is on and goes Home', async () => {
    await render(<GuideScreen />);
    expect(await screen.findByText('Thumbwell is on')).toBeTruthy();
    useAppStore.setState({ onboardingCompleted: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Go to Home' }));
    expect(useAppStore.getState().onboardingCompleted).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });
});

describe('home (S14)', () => {
  it('shows total vs limit, the mascot count and per-app rows', async () => {
    core.getTodayCounts.mockResolvedValue(dayCounts(12, { instagram: 7, youtube: 3, tiktok: 2 }));
    await render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('total-count')).toHaveTextContent('12'));
    expect(screen.getByText('of 60 reels today')).toBeTruthy();
    expect(screen.getByTestId('summary')).toHaveTextContent('48 reels left today');
    expect(screen.getByLabelText('Instagram, Reels today, 7')).toBeTruthy();
    expect(screen.getByLabelText('YouTube, Shorts today, 3')).toBeTruthy();
    expect(screen.getByLabelText('TikTok, Videos today, 2')).toBeTruthy();
    expect(screen.queryByTestId('paused-banner')).toBeNull();
  });

  it('shows one fixed "happy" Thumb whatever the count (health bands are Phase 1)', async () => {
    // The art's own shape data (path `d`, `fill`, `stroke`), so any other pose differs.
    const art = (node: ArtNode): string =>
      [node.props.d, node.props.fill, node.props.stroke]
        .filter((v): v is string => typeof v === 'string')
        .join('|') + node.children.map((c) => (typeof c === 'string' ? c : art(c))).join('');
    const thumbArt = () => art(screen.getByLabelText('Thumb, the Thumbwell mascot'));
    await render(<Thumb pose="happy" width={156} />);
    const happy = thumbArt();
    await cleanup();
    await render(<Thumb pose="fried" width={156} />);
    expect(thumbArt()).not.toBe(happy);
    await cleanup();
    for (const total of [0, 30, 59, 200]) {
      core.getTodayCounts.mockResolvedValue(dayCounts(total, { instagram: total }));
      await render(<HomeScreen />);
      await waitFor(() =>
        expect(screen.getByTestId('total-count')).toHaveTextContent(String(total)),
      );
      expect(thumbArt()).toBe(happy);
      await cleanup();
    }
  });

  it('draws the installed app icon, and a neutral name tile when the app is not installed', async () => {
    core.getAppIcon.mockImplementation(async (pkg) =>
      pkg === 'com.instagram.android' ? 'AAAA' : null,
    );
    await render(<HomeScreen />);
    expect(await screen.findByTestId('app-instagram-icon')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('app-youtube-tile')).toBeTruthy());
    expect(screen.getByLabelText('YouTube, Not installed, 0')).toBeTruthy();
    expect(core.getAppIcon).toHaveBeenCalledWith('com.zhiliaoapp.musically');
    expect(core.getAppIcon).toHaveBeenCalledWith('com.ss.android.ugc.trill');
  });

  it.each([
    ['service_disabled', 'switched off in Accessibility settings'],
    ['consent_missing', 'needs your OK to use Accessibility'],
  ] as const)('shows the paused banner for %s and reopens the disclosure', async (reason, text) => {
    core.getCountingStatus.mockResolvedValue({
      ...runningStatus,
      paused: true,
      pausedReason: reason,
      serviceEnabled: reason !== 'service_disabled',
      consentLogged: reason !== 'consent_missing',
    });
    await render(<HomeScreen />);
    expect(await screen.findByTestId('paused-banner')).toBeTruthy();
    expect(screen.getByText(new RegExp(text))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Turn it back on' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/disclosure',
      params: { from: 'home' },
    });
    expect(core.openAccessibilitySettings).not.toHaveBeenCalled();
  });

  it('says how far over the limit you are', async () => {
    core.getTodayCounts.mockResolvedValue(dayCounts(65, { instagram: 65 }));
    await render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('summary')).toHaveTextContent(/5 over/));
  });
});

describe('settings (S43-P0)', () => {
  it('shows the limit, counting state, version and the trademark disclaimer', async () => {
    await render(<SettingsScreen />);
    expect(await screen.findByText('60 reels')).toBeTruthy();
    expect(screen.getByText('On')).toBeTruthy();
    expect(screen.getByText('04:00')).toBeTruthy();
    expect(screen.getByTestId('disclaimer')).toHaveTextContent(
      'Not affiliated with or endorsed by Meta, Google/YouTube, TikTok or Snap Inc. All trademarks belong to their owners.',
    );
  });

  it('saves a lower limit right away with a "applies right away" note', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByTestId('row-limit'));
    await fireEvent.press(screen.getByTestId('limit-preset-30'));
    expect(screen.getByTestId('limit-note')).toHaveTextContent(/applies right away/);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(core.setDailyLimit).toHaveBeenCalledWith(30));
  });

  it('warns that a higher limit applies from tomorrow', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByTestId('row-limit'));
    await fireEvent.press(screen.getByTestId('limit-preset-100'));
    expect(screen.getByTestId('limit-note')).toHaveTextContent(/applies from tomorrow/);
    expect(screen.getByTestId('limit-note')).toHaveTextContent(/04:00/);
  });

  it('shows a waiting raise on the limit row', async () => {
    core.getDailyLimit.mockResolvedValue({
      effective: 60,
      pending: 100,
      pendingFromDay: '2026-10-28',
    });
    await render(<SettingsScreen />);
    expect(await screen.findByText('100 reels from tomorrow')).toBeTruthy();
  });

  it('saves the day start', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByTestId('row-day-start'));
    await fireEvent.press(screen.getByTestId('day-start-300'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(core.setDayStartMinutes).toHaveBeenCalledWith(300));
  });

  it('shows the badge rows with their defaults (S43-P0)', async () => {
    await render(<SettingsScreen />);
    expect(await screen.findByText('Floating badge')).toBeTruthy();
    expect(screen.getByText('Shows today’s count over Instagram, YouTube and TikTok')).toBeTruthy();
    expect(screen.getByTestId('row-badge-switch').props.value).toBe(true);
    expect(screen.getByRole('button', { name: 'Badge display time, 2 s' })).toBeTruthy();
    expect(screen.getByText('Hide completely when resting')).toBeTruthy();
    expect(screen.getByTestId('row-badge-hide-switch').props.value).toBe(false);
  });

  it('saves the badge switches natively', async () => {
    await render(<SettingsScreen />);
    await fireEvent(await screen.findByTestId('row-badge-switch'), 'valueChange', false);
    await waitFor(() => expect(core.setBadgeSettings).toHaveBeenCalledWith({ enabled: false }));
    await fireEvent(screen.getByTestId('row-badge-hide-switch'), 'valueChange', true);
    await waitFor(() =>
      expect(core.setBadgeSettings).toHaveBeenCalledWith({ hideWhenResting: true }),
    );
    expect(screen.getByTestId('row-badge-switch').props.value).toBe(false);
  });

  it('picks the badge display time from the chips', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByTestId('row-badge-time'));
    expect(
      screen.getByText(
        'How long the Thumb stays awake after a counted reel, before it settles to rest.',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('badge-time-always'));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(core.setBadgeSettings).toHaveBeenCalledWith({ displayTime: 'always' }),
    );
    expect(await screen.findByRole('button', { name: 'Badge display time, Always' })).toBeTruthy();
  });

  it('sends the user to the disclosure to fix paused counting', async () => {
    core.getCountingStatus.mockResolvedValue({
      ...runningStatus,
      paused: true,
      pausedReason: 'service_disabled',
      serviceEnabled: false,
    });
    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByTestId('row-counting'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/disclosure',
      params: { from: 'settings' },
    });
  });

  it('opens a feedback mail with version and device info', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByTestId('row-feedback'));
    const url = String(open.mock.calls[0]?.[0]);
    expect(url.startsWith('mailto:support@example.com')).toBe(true);
    expect(decodeURIComponent(url)).toContain('App: ');
  });

  it('deletes all data after confirming, then starts over', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByTestId('row-delete'));
    expect(core.clearAllData).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(core.clearAllData).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useAppStore.getState().onboardingCompleted).toBe(false));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('keeps everything when the delete is cancelled', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByTestId('row-delete'));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(core.clearAllData).not.toHaveBeenCalled();
    expect(useAppStore.getState().onboardingCompleted).toBe(true);
  });
});

describe('about and lock preview', () => {
  it('shows the disclaimer on About', async () => {
    await render(<AboutScreen />);
    expect(screen.getByTestId('about-disclaimer')).toHaveTextContent(/^Not affiliated with/);
  });

  it('shows the lock copy with the real budget and the unlock time', async () => {
    const onLeave = jest.fn();
    await render(<LockView limit={60} until="04:00" today={60} onLeave={onLeave} />);
    expect(screen.getByText("That's 60 reels. Time for a break.")).toBeTruthy();
    expect(
      screen.getByText(
        'Reels, Shorts and TikTok are locked until 04:00. DMs and the rest of each app still work.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Today: 60 reels')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Leave reels' }));
    expect(onLeave).toHaveBeenCalled();
  });

  it('uses the singular for a one-reel limit and the plural for zero', async () => {
    const { unmount } = await render(
      <LockView limit={1} until="04:00" today={1} onLeave={jest.fn()} />,
    );
    expect(screen.getByText("That's 1 reel. Time for a break.")).toBeTruthy();
    expect(screen.getByText('Today: 1 reel')).toBeTruthy();
    await unmount();
    await render(<LockView limit={0} until="04:00" today={0} onLeave={jest.fn()} />);
    expect(screen.getByText("That's 0 reels. Time for a break.")).toBeTruthy();
    expect(screen.getByText('Today: 0 reels')).toBeTruthy();
  });
});
