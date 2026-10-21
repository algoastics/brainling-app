# M00 — Foundation: status

Branch: `module/00-foundation`. Tracks the M0 Definition of Done from `docs/MODULE_PLAN.md`.

## Done

| Item | Where |
|---|---|
| ESLint (no-console, no-warning-comments, no-debugger, unused disables), Prettier, strict TS | `eslint.config.js`, `.prettierrc.json`, `tsconfig.json` |
| husky + lint-staged + commitlint + gitleaks pre-commit | `.husky/`, `commitlint.config.js` |
| `.gitignore` for env files, keystores, Firebase configs, build output, `android/`, `ios/` | `.gitignore` |
| Expo Router with typed routes: root stack, `(tabs)` Home/Stats/Me, modal stack | `src/app/` |
| expo-dev-client | `package.json` |
| Theme/tokens light + dark (light `muted` darkened to #6E6789 for AA body text) | `src/theme/` |
| Fonts: Fredoka, Plus Jakarta Sans, JetBrains Mono | `src/theme/fonts.ts` |
| Design system C01–C05, C09, C10 (+ ProTag, Screen) and a dev-only preview with a light/dark switch | `src/components/ui/`, `src/app/design-system.tsx` |
| S01 native splash, app icon, adaptive icon (foreground/background/monochrome) | `assets/`, `app.json` |
| S01 in-app splash with A01 logo pop + blink, reduced-motion fade, S01-error with retry | `src/components/brand/` |
| Zustand + MMKV (AES-256, key generated with expo-crypto and kept in expo-secure-store / Android Keystore) | `src/storage/`, `src/state/` |
| `com.algoastics.brainling` package; allowBackup off, cleartext off, R8 + resource shrinking in release | `app.json` |
| `modules/brainling-core` local Expo Module skeleton (Android, autolinked) | `modules/brainling-core/` |

## Open (needed before the M0 PR can merge)

| Item | Notes |
|---|---|
| Jest + React Native Testing Library | Not set up yet; `pre-push` runs `npm test --if-present`. |
| EAS Build profiles (development / preview / production) + per-profile EAS env/secrets | Needs the EAS project owner; `eas build --profile preview` APK install is a DoD item. |
| CI (GitHub Actions): `npm ci`, typecheck, lint, tests, `npm audit --audit-level=high`, gitleaks, commitlint, branch-name check | Typecheck in CI must generate router types first (see below). |
| Dependabot | `.github/dependabot.yml`. |
| CODEOWNERS + branch protection on `main` | Waiting for the reviewer's GitHub handle. |
| i18n scaffold (EN only) | Strings in the S01 splash, tab titles and preview are inline English until then. |
| `<Mascot>` interface with static SVG fallback | Logomark exists in `src/components/brand/`; the stateful Mascot lands with M5 interfaces. |
| ESLint rule: ink-on-primary below 16dp | Handoff §5 contrast rule; custom lint rule not written yet. |
| App icons via `PackageManager.getApplicationIcon` | Native, ships with the M1 bridge; `AppChip` already takes a device icon source. |
| `brainling-core` config plugin | Added with M1 when the AccessibilityService is declared. |
| Network security config | With the first network call (M11 ruleset fetch). |
| Pinned dependency versions (`--save-exact`) | Expo SDK packages use `~` ranges from `expo install`; lockfile is committed. |
| Manual checks | Device run of all tab stubs, preview at 1.3x font scale, TalkBack. |

## Out of M0 by design (other modules)

- C06 social cards — v1.1 (M14). C07 game UI — M6. C08 lock overlay — native Kotlin in M4.

## Notes

- Typed routes are generated into `.expo/types` by `expo start`; run it once on a fresh clone
  (or in CI before `npm run typecheck`), otherwise route literals such as `/design-system` fail
  to typecheck.
- `react-dom` is pinned to 19.3.0 to satisfy expo-router's web peer dependency with React 19.3.0.
