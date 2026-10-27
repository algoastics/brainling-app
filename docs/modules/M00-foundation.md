# M00 — Foundation: status

Branch: `module/00-foundation`. Tracks the M0 Definition of Done from `docs/MODULE_PLAN.md`.

## Done

| Item | Where |
|---|---|
| ESLint (no-console, no-warning-comments, no-debugger, unused disables), Prettier, strict TS | `eslint.config.js`, `.prettierrc.json`, `tsconfig.json` |
| husky: pre-commit gitleaks + lint-staged + typecheck; commit-msg commitlint; pre-push Jest | `.husky/`, `commitlint.config.js` |
| `.gitignore` for env files, keystores, Firebase configs, build output, `android/`, `ios/`, module builds | `.gitignore` |
| Expo Router with typed routes: root stack, `(tabs)` Home/Stats/Me, modal stack | `src/app/` |
| expo-dev-client | `package.json` |
| EAS profiles: development (dev client APK), preview (APK), production (AAB, remote version, autoIncrement); env via EAS environments, names listed, no values in repo | `eas.json`, `docs/EAS.md` |
| Jest (jest-expo) + React Native Testing Library; tests for health/state, token contrast, storage key, Button, Checkbox, StreakPill, Mascot | `src/**/__tests__/`, `jest.setup.ts`, `test/` |
| CI (GitHub Actions): npm ci, typed routes (`npm run typegen`), typecheck, lint, format, tests, commitlint, branch name, gitleaks (full history), audit-ci at high, expo-doctor | `.github/workflows/ci.yml` |
| npm audit gate with documented upstream exceptions (review 2026-12-21) | `audit-ci.jsonc`, `docs/security/audit-exceptions.md` |
| Dependabot: npm (Expo SDK group, dev tooling group) + github-actions, weekly | `.github/dependabot.yml` |
| i18n: i18next + expo-localization, English only, typed keys; UI strings moved | `src/i18n/` |
| Theme/tokens light + dark (light `muted` darkened to #6E6789 for AA body text) | `src/theme/` |
| Fonts: Nunito, Inter (was Fredoka, Plus Jakarta Sans, JetBrains Mono) | `src/theme/fonts.ts` |
| Design system C01–C05, C09, C10 (+ ProTag, Screen) and a dev-only preview with light/dark switch | `src/components/ui/`, `src/app/design-system.tsx` |
| `<Mascot>`: static art for all 7 health states + ghost from the design kit mascot sheet (no fallbacks needed) | `src/components/mascot/` |
| S01 native splash, app icon, adaptive icon; in-app S01 with A01 logo pop + blink; S01-error retry | `assets/`, `app.json`, `src/components/brand/` |
| Zustand + MMKV (AES-256, key in Android Keystore via expo-secure-store) | `src/storage/`, `src/state/` |
| `com.algoastics.thumbwell`; allowBackup off, cleartext off, R8 + shrink in release; minimal permissions (storage and mic blocked; SYSTEM_ALERT_WINDOW is declared by the thumbwell-core plugin for the lock, see M04) | `app.json` |
| All MVP native libraries installed up front (list below) | `package.json` |
| `modules/thumbwell-core` local Expo Module skeleton (Android, autolinked) | `modules/thumbwell-core/` |
| Debug dev-client APK (arm64-v8a) builds from this branch | `thumbwell-builds/thumbwell-m0-debug-v2.apk` (not in repo) |

### Native libraries installed in M0 (so M1–M12 need no new native rebuild)

Animation/graphics: rive-react-native, lottie-react-native, @shopify/react-native-skia,
react-native-reanimated + worklets, react-native-gesture-handler, react-native-svg,
expo-linear-gradient, expo-blur, expo-image, expo-haptics. System: expo-notifications,
expo-updates (fingerprint runtime), expo-application, expo-device, expo-intent-launcher,
@react-native-community/netinfo, expo-web-browser, expo-store-review, expo-localization,
expo-secure-store, expo-crypto, expo-file-system, expo-constants, expo-linking. Sharing:
expo-sharing, react-native-view-shot. Billing: react-native-purchases (own paywall UI, so no
purchases-ui). Observability: @sentry/react-native, posthog-react-native. Storage:
react-native-mmkv + react-native-nitro-modules. Not added: Play Integrity (v1.1 social),
Supabase (JS only, v1.1).

## Open

| Item | Notes |
|---|---|
| `eas build --profile preview` APK installed on a device | Profiles exist; first EAS cloud build not run yet. |
| CI green on GitHub | Workflow committed; first run happens on push/PR. |
| CODEOWNERS + branch protection on `main` | Waiting for the reviewer's GitHub handle. |
| ESLint rule: ink-on-primary below 16dp | Handoff §5 contrast rule; custom rule not written. |
| App icons via `PackageManager.getApplicationIcon` | Native, ships with the M1 bridge; `AppChip` takes a device icon source. |
| `thumbwell-core` config plugin | Added with M1 when the AccessibilityService is declared. |
| Network security config | With the first network call (M11 ruleset fetch). |
| Manual checks | Device run of all tab stubs, preview at 1.3x font scale, TalkBack. |

## Out of M0 by design (other modules)

- C06 social cards — v1.1 (M14). C07 game UI — M6. C08 lock overlay — native Kotlin in M4.
- Rive mascot animation (A03/A12) replaces the static art behind `<Mascot>` in M5.

## Notes

- Typed routes live in `.expo/types` (git-ignored); run `npm run typegen` on a fresh clone and
  before `npm run typecheck` in CI.
- `react-dom` is pinned to 19.3.0 to satisfy expo-router's web peer dependency with React 19.3.0.
- Reanimated's bundled Jest mock fails on SDK 58 (`setCSSEventHandler` in JSReanimated), so tests
  use the small double in `test/reanimatedMock.ts`; revisit on the next Reanimated release.
- rive-react-native is not in the Expo SDK 58 version map; it is locked by `package-lock.json`.
