/** S10 phone-maker guides. Samsung leads; the detected maker's guide is shown first. */
export const OEM_KEYS = ['samsung', 'xiaomi', 'oppo', 'vivo', 'oneplus', 'pixel'] as const;
export type OemKey = (typeof OEM_KEYS)[number];

/** Number of steps per guide; the texts live in i18n under `onboarding.oem.<key>.steps`. */
export const OEM_STEP_COUNT: Record<OemKey, 1 | 2 | 3 | 4> = {
  samsung: 3,
  xiaomi: 4,
  oppo: 3,
  vivo: 2,
  oneplus: 2,
  pixel: 1,
};

const MATCHERS: readonly [RegExp, OemKey][] = [
  [/samsung/, 'samsung'],
  [/xiaomi|redmi|poco/, 'xiaomi'],
  [/oneplus/, 'oneplus'],
  [/oppo|realme/, 'oppo'],
  [/vivo|iqoo/, 'vivo'],
  [/google/, 'pixel'],
];

/** Maps `Build.MANUFACTURER` / `Build.BRAND` to a guide, or `null` for makers without one. */
export function detectOem(manufacturer?: string | null, brand?: string | null): OemKey | null {
  const id = `${manufacturer ?? ''} ${brand ?? ''}`.toLowerCase();
  for (const [re, key] of MATCHERS) if (re.test(id)) return key;
  return null;
}

/** Guide order for the S10 pager: the detected maker first, then the default order. */
export function guideOrder(detected: OemKey | null): OemKey[] {
  if (detected === null) return [...OEM_KEYS];
  return [detected, ...OEM_KEYS.filter((k) => k !== detected)];
}

/** Whether the setup check lists an "Autostart" row: stock Android needs no extra step. */
export function needsAutostart(key: OemKey | null): key is Exclude<OemKey, 'pixel'> {
  return key !== null && key !== 'pixel';
}

export type OemTarget =
  { kind: 'appInfo' } | { kind: 'component'; packageName: string; className: string };

const APP_INFO: OemTarget = { kind: 'appInfo' };

/**
 * Settings pages opened by "Open the setting", tried in order. Only explicit components of the
 * maker's own system apps (never implicit intents); if none resolves the screen shows S10-intentfail.
 */
export const OEM_TARGETS: Record<OemKey, readonly OemTarget[]> = {
  samsung: [APP_INFO],
  xiaomi: [
    {
      kind: 'component',
      packageName: 'com.miui.securitycenter',
      className: 'com.miui.permcenter.autostart.AutoStartManagementActivity',
    },
  ],
  oppo: [
    {
      kind: 'component',
      packageName: 'com.coloros.safecenter',
      className: 'com.coloros.safecenter.permission.startup.StartupAppListActivity',
    },
    {
      kind: 'component',
      packageName: 'com.coloros.safecenter',
      className: 'com.coloros.safecenter.startupapp.StartupAppListActivity',
    },
    {
      kind: 'component',
      packageName: 'com.oplus.safecenter',
      className: 'com.oplus.safecenter.permission.startup.StartupAppListActivity',
    },
  ],
  vivo: [
    {
      kind: 'component',
      packageName: 'com.vivo.permissionmanager',
      className: 'com.vivo.permissionmanager.activity.BgStartUpManagerActivity',
    },
    {
      kind: 'component',
      packageName: 'com.iqoo.secure',
      className: 'com.iqoo.secure.ui.phoneoptimize.BgStartUpManager',
    },
  ],
  oneplus: [APP_INFO],
  pixel: [APP_INFO],
};
