import { jest } from '@jest/globals';
import type { CountingStatus, DailyLimit, DayCounts } from 'thumbwell-core';

/** A running, consented counting status (override fields per test). */
export const runningStatus: CountingStatus = {
  paused: false,
  pausedReason: null,
  serviceEnabled: true,
  serviceRunning: true,
  consentLogged: true,
  consent: { atMs: 1, version: '1' },
  disclosureVersion: '1',
  apps: { instagram: { enabled: true }, youtube: { enabled: true }, tiktok: { enabled: true } },
  dayStartMinutes: 240,
  flags: { facebook: false, snapchat: false, countBadge: false },
};

export const dayCounts = (total: number, apps: Record<string, number> = {}): DayCounts => ({
  date: '2026-10-27',
  total,
  apps,
  ads: {},
  nextCloseAtMs: 0,
  timeZone: 'Asia/Karachi',
});

/** Test double for the native module; reset with `resetCore()`. */
export const core = {
  getTodayCounts: jest.fn<() => Promise<DayCounts>>(),
  getCountingStatus: jest.fn<() => Promise<CountingStatus>>(),
  getDailyLimit: jest.fn<() => Promise<DailyLimit>>(),
  setDailyLimit: jest.fn<(n: number) => Promise<DailyLimit>>(),
  getDayStartMinutes: jest.fn<() => Promise<number>>(),
  setDayStartMinutes: jest.fn<(n: number) => Promise<DayCounts>>(),
  setConsent: jest.fn<(v: string) => Promise<{ atMs: number; version: string }>>(),
  getAppIcon: jest.fn<(pkg: string) => Promise<string | null>>(),
  openAccessibilitySettings: jest.fn<() => Promise<void>>(),
  clearAllData: jest.fn<() => Promise<void>>(),
  isServiceEnabled: jest.fn<() => Promise<boolean>>(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};

export function resetCore() {
  for (const fn of Object.values(core)) fn.mockReset();
  core.getTodayCounts.mockResolvedValue(dayCounts(0));
  core.getCountingStatus.mockResolvedValue(runningStatus);
  core.getDailyLimit.mockResolvedValue({ effective: 60, pending: null, pendingFromDay: null });
  core.setDailyLimit.mockImplementation(async (n) => ({
    effective: n,
    pending: null,
    pendingFromDay: null,
  }));
  core.getDayStartMinutes.mockResolvedValue(240);
  core.setDayStartMinutes.mockResolvedValue(dayCounts(0));
  core.setConsent.mockImplementation(async (version) => ({ atMs: 1, version }));
  core.getAppIcon.mockResolvedValue('AAAA');
  core.openAccessibilitySettings.mockResolvedValue(undefined);
  core.clearAllData.mockResolvedValue(undefined);
  core.isServiceEnabled.mockResolvedValue(true);
  core.addListener.mockImplementation(() => ({ remove: jest.fn() }));
}
