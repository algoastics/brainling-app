# Codebase summary (Step 0, Oct 28 2026)

Read this instead of re-scanning. Never open node_modules, android/ (generated), ios, .expo, dist, build outputs.

## Stack
Expo SDK app (expo-router, typed routes), RN, TypeScript, Reanimated 4.7, react-native-worklets 0.13,
gesture-handler 3.3, MMKV storage, i18next (en.json only, typed keys), zustand store.
Native module `modules/thumbwell-core` (Kotlin, accessibility service, lock, badge).

## JS/TS (src/)
- app/ routes: index, welcome, limit, disclosure, guide, overlay (new, uncommitted), (tabs)/index+settings, about, reenable, dev-only lock-preview/detection-debug. Stack in navigation/RootStack.tsx.
- screens/: Welcome, Limit, Disclosure, Guide (S07 + overlay stage), OverlayPermissionStep, overlay/ (View, Screen: uncommitted), Home, Settings (+ settings/sheets.tsx), About, lock/LockView.
- components/ui/: Text, Button, Card, Chip, ListRow, Switch, Slider (+sliderMath), BottomSheet (+sheetMotion), TabBar, TopBar, Screen, Banner, Dialog, odometer, StepIndicator, StatusChip. Icons: components/ui/Icon.tsx (Phosphor via phosphor-react-native; Regular, Fill when active). Mascot: components/mascot (Thumb, thumbArt, thumbState, AliveThumb, LimitThumb).
- theme/ tokens, provider, preference (System/Light/Dark, persisted); motion/ (haptics, reduced motion, pressTo); i18n/locales/en.json; consent/version.ts (DISCLOSURE_VERSION); lock/ (lockTime, overlayPermission); detection/hooks.ts; apps/supportedApps.ts (IG/YT/TikTok only); onboarding/steps.ts (4 steps).
- test/ mocks: reanimatedMock, thumbwellCoreMock, routerMock, memoryStorage; jest.setup.ts.

## Kotlin (modules/thumbwell-core/android/src/main/java/com/algoastics/thumbwell/core/)
- ThumbwellCoreModule.kt (JS API), FeatureFlags.kt (FB/Snapchat off), data/ (CorePrefs: Disclosure version), rules/, health/.
- detection/: ThumbwellAccessibilityService, ReelSession, PagerTracker, NodeInspector, BadgeLogic, CountBadge, OdometerView, OverlaySafetyPackages.
- lock/: LockController, LockOverlay (TYPE_APPLICATION_OVERLAY, fallback TYPE_ACCESSIBILITY_OVERLAY), LockLogic (LeaveFlow, window choice), LockTree (Home tab ACTION_CLICK), LockAudio (media key, mute/restore, focus), LockBounds, LockEntry, LockWatch, LimitEngine.
- Unit tests: modules/thumbwell-core/android/src/test/... (data, detection, health, lock, rules).
- app.plugin.js: manifest, service XML, description text.

## Docs
docs/modules/M00..M04 (M04-lock, M03b-badge), docs/TESTING-phase0.md (device checks), COMMIT_RULES.md, BUILD-local.md, NEEDS_DECISION.md (untracked, repo root). No brand-spec file found in repo.

## Commands (run once, targeted)
- npx tsc --noEmit ; npx eslint src test jest.setup.ts
- npx jest src/components src/screens src/theme src/lock src/detection src/consent src/i18n   (never bare jest)
- Kotlin: cd android && ./gradlew :thumbwell-core:testDebugUnitTest --offline --console=plain  (~45 s warm)
- Commit hook: gitleaks + lint-staged + full tsc; header <= 72 chars; stage by path (package.json is unrelated, unstaged).
