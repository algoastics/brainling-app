import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { DayCounts } from 'brainling-core';
import { AppState, type AppStateStatus } from 'react-native';

import { useServiceStatus, useTodayCounts } from '../hooks';

type CountListener = (c: DayCounts) => void;

const mockCore = {
  listeners: new Set<CountListener>(),
  getTodayCounts: jest.fn<() => DayCounts>(),
  isServiceEnabled: jest.fn<() => boolean>(),
  addListener: jest.fn((_event: string, fn: CountListener) => {
    mockCore.listeners.add(fn);
    return { remove: () => mockCore.listeners.delete(fn) };
  }),
};

// Getter: the factory runs when the hoisted import loads, before `mockCore` is initialised.
jest.mock('brainling-core', () => ({
  __esModule: true,
  get default() {
    return mockCore;
  },
}));

let appStateHandlers: ((s: AppStateStatus) => void)[] = [];
const removeAppState = jest.fn();

const day = (total: number, apps: Record<string, number> = {}): DayCounts => ({
  date: '2026-10-21',
  total,
  apps,
});

const setAppState = (s: AppStateStatus) =>
  act(() => {
    appStateHandlers.forEach((h) => h(s));
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockCore.listeners.clear();
  appStateHandlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandlers.push(handler as (s: AppStateStatus) => void);
    return { remove: removeAppState } as never;
  });
});

describe('useTodayCounts', () => {
  it('reads counts on mount', async () => {
    mockCore.getTodayCounts.mockReturnValue(day(3, { instagram: 3 }));
    const { result } = await renderHook(() => useTodayCounts());
    expect(result.current.counts).toEqual(day(3, { instagram: 3 }));
  });

  it('updates from onCountChange without calling native again', async () => {
    mockCore.getTodayCounts.mockReturnValue(day(0));
    const { result } = await renderHook(() => useTodayCounts());
    await act(() => {
      mockCore.listeners.forEach((l) => l(day(5, { youtube: 5 })));
    });
    expect(result.current.counts?.apps).toEqual({ youtube: 5 });
    expect(mockCore.getTodayCounts).toHaveBeenCalledTimes(1);
  });

  it('re-reads only when the app becomes active', async () => {
    mockCore.getTodayCounts.mockReturnValue(day(1));
    const { result } = await renderHook(() => useTodayCounts());
    mockCore.getTodayCounts.mockReturnValue(day(7));
    await setAppState('background');
    expect(result.current.counts?.total).toBe(1);
    await setAppState('active');
    expect(result.current.counts?.total).toBe(7);
  });

  it('removes its listeners on unmount', async () => {
    mockCore.getTodayCounts.mockReturnValue(day(0));
    const { unmount } = await renderHook(() => useTodayCounts());
    await unmount();
    expect(mockCore.listeners.size).toBe(0);
    expect(removeAppState).toHaveBeenCalled();
  });
});

describe('useServiceStatus', () => {
  it('reads the status on mount and on foreground', async () => {
    mockCore.isServiceEnabled.mockReturnValue(false);
    const { result } = await renderHook(() => useServiceStatus());
    expect(result.current.enabled).toBe(false);
    mockCore.isServiceEnabled.mockReturnValue(true);
    await setAppState('active');
    expect(result.current.enabled).toBe(true);
  });

  it('refresh() re-reads on demand', async () => {
    mockCore.isServiceEnabled.mockReturnValue(false);
    const { result } = await renderHook(() => useServiceStatus());
    mockCore.isServiceEnabled.mockReturnValue(true);
    await act(() => result.current.refresh());
    expect(result.current.enabled).toBe(true);
  });
});
