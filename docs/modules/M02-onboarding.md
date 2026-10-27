# M02 — Phase 0 screens

JS only. Routes are thin files in `src/app/`, screen logic lives in `src/screens/`, copy in
`src/i18n/locales/en.json`. Layout, tokens and components come from the Figma frames (file
`S4UpqkerYncBpyho3P5rU6`, pages "Phase 0 Screens"); copy and behaviour from the scope doc (4.1, F03,
F04, F05, F06, F17, Appendix D).

## Screens

| Frame | Route | Screen | Notes |
|---|---|---|---|
| S01-P0 Splash | `/` | `SplashScreen` | 1.2 s, then `initialRoute(onboardingCompleted)`: first run to Welcome, later to Home. |
| S02-P0 Welcome | `/welcome` | `WelcomeScreen` | Step 1 of 3. |
| S04-P0 Daily limit | `/limit` | `LimitScreen` | Step 2 of 3. Presets 30/60/100, default 60, stepper by 5. Saved with native `setDailyLimit`. |
| S06 Disclosure | `/disclosure` | `DisclosureScreen` | Step 3 of 3 in onboarding. Exact F03 text. Agree is disabled until the box is ticked, then `setConsent(version)` and on to `/guide`. "Not now" finishes onboarding with counting off. |
| S07 Guide | `/guide` | `GuideScreen` | Redirects to `/disclosure` while consent is not logged. Opens Accessibility settings, re-checks on return (AppState + `getCountingStatus`), "Still off, try again", success, Android 13+ "Allow restricted settings" help. |
| S14-P0 Home | `/(tabs)` | `HomeScreen` | Total vs limit, Thumb by count/limit, per-app rows with runtime launcher icons, paused banner. Refreshes on focus, on `onCountChange` and every 5 s. |
| S22-P0 Lock | `/lock-preview` (dev only) | `LockView` | JS preview of the overlay copy. The shipped overlay is native (M4). |
| S43-P0 Settings | `/(tabs)/settings` | `SettingsScreen` | Limit, counting status, day start, disclosure, privacy, feedback, About, delete data, version, disclaimer. |
| S43-about | `/about` | `AboutScreen` | Version, privacy link, disclaimer. |

The tab bar has Home and Settings only. The Figma frame's third tab (Limits) is not built; the
limit setting lives in Settings.

## Rules

- S06 is shown before **every** deep link to Accessibility settings: onboarding, the Home banner,
  the Settings counting row and the `thumbwell://reenable` link (`/reenable` redirects to S06).
- The first limit applies at once. Lowering applies at once; raising applies from the next logical
  day (`src/limit/limitRule.ts` mirrors the native rule in `DailyLimit.kt`).
- "Locked until HH:MM" comes from `src/lock/lockTime.ts` (day start, user time zone, DST safe).
  M4 mirrors it in Kotlin.
- Thumb states by count vs budget: glowing 90+, happy 70-89, meh 45-69, tired 35-44, fried below
  35 (health score, `src/components/mascot/thumbState.ts`).
- App icons are read from the installed app at runtime (`getAppIcon`); an app that is not installed
  gets a neutral tile. No third-party logo is bundled.
- First-run state is `onboardingCompleted` in encrypted MMKV (`src/state/appStore.ts`). Delete my
  data calls native `clearAllData()`, clears MMKV and returns to the splash.
- `appConfig.privacyPolicyUrl` and `appConfig.supportEmail` are placeholders; replace before release.
- Disclosure version lives in `src/consent/version.ts` and must equal the native
  `Disclosure.CURRENT_VERSION`.

## Tests

`src/screens/__tests__` (onboarding routing, disclosure gating, guide, Home, Settings, lock copy),
`src/limit`, `src/lock`, `src/components/mascot`, `src/navigation`, `src/support`. Native calls are
faked by `test/thumbwellCoreMock.ts`.
