# M01 — Detection: status

Branch: `module/01-detection-native` (from `module/01-detection`). Native code lives in
`modules/thumbwell-core/android`; JS consumes it through `thumbwell-core` and `src/detection/`.

> **Build status:** none of the Kotlin in this branch has been compiled or unit-tested yet (no JDK
> or Android SDK on the authoring Mac). The first Gradle build and `testDebugUnitTest` run are
> pending; see "Open".

## Architecture

| Piece | File(s) | Notes |
|---|---|---|
| AccessibilityService | `detection/ThumbwellAccessibilityService.kt` | Events → 250 ms throttle → evaluate on the main thread. Narrows `packageNames` at runtime to the active ruleset. |
| Node matching | `detection/NodeInspector.kt` | View ids → exact content-description constants → structural fallback. Never reads text. |
| Counting | `detection/ReelCounter.kt` | 800 ms dwell, 20-key salted de-dupe ring. |
| Session + de-dupe persistence | `detection/DetectionState.kt` | Per-package snapshot (session id, page index, last seen, de-dupe keys) and the item-key salt in app-private prefs. A return within `sessionGapMs` continues the session; a feed restarted from the top starts a new one. |
| Ruleset | `rules/RuleSet.kt`, `rules/RulesVerifier.kt`, `rules/RulesManager.kt`, `rules/TrustedRuleKeys.kt` | Ed25519 (BouncyCastle) verify **before** parse; bundled default + remote copy, keep last good, rollback/expiry rejected. |
| Storage | `data/*` | Room `thumbwell.db`: `count_events`, `daily_aggregates`, `health_events`. |
| Day close | `data/ThumbwellDay.kt` | Day runs 04:00 → 04:00 local; each count stores the day key computed in its own time zone. |
| Watchdog | `health/HealthMonitor.kt`, `health/HealthWorker.kt`, `health/ReenableNotifier.kt`, `ThumbwellWork.kt` | 15 min WorkManager check + on app open + on service connect/unbind. |
| Ruleset refresh | `rules/RulesRefreshWorker.kt`, `ThumbwellWork.kt` | Every 6 h (network) and once on app open. |
| Bridge | `ThumbwellCoreModule.kt`, `modules/thumbwell-core/src/index.ts` | All `AsyncFunction`; `openAccessibilitySettings` runs on the main queue. Events `onCountChange`, `onHealthChange`. |
| Hooks | `src/detection/hooks.ts` | `useTodayCounts`, `useServiceStatus`: read on mount + foreground, event pushes in between, stale async reads dropped. |
| Debug tools | `src/debug/.../DetectionDebug.kt`, `src/app/detection-debug.tsx` | Last detection + capture-layout (see below). Release twin in `src/release` is a no-op. |
| Config plugin | `modules/thumbwell-core/app.plugin.js` | Service declaration + XML, `THUMBWELL_RULES_URL` meta-data, strips foreground service. |

## Ruleset format (schema 3)

Source: `modules/thumbwell-core/rules/rules.json`. Shipped: `android/src/main/assets/thumbwell/rules.signed.json`
(`{"alg":"Ed25519","keyId","payload":<base64 JSON>,"signature"}`). Top level: `schema`, `version`,
`issuedAt`, `expiresAt` (UTC), `dwellMs`, `dedupeSize`, `sessionGapMs`, `surfaceRetryDelaysMs`,
`apps[]`. Per app: `key`, `packageNames[]`, `enabled`, and at least one signal when enabled:
`surfaceIds[]` (view ids without `pkg:id/`), `contentDescriptions[]` (exact component labels),
`structure` (class names, min width/height fraction of the window, scrollable/long-clickable,
optional `descendant`, max depth 4). Optional `dmSignatureIds[]`: when all are visible the reel was
opened from a DM and is not counted.

Schema 3 (parser accepts 2 and 3) adds optional `pagerIds[]` and `pagerClassNames[]`: the paging
container whose `TYPE_VIEW_SCROLLED` events carry the reel position, for apps whose surface id is a
page child rather than the pager (YouTube `reel_recycler`, TikTok `viewpager`).
`pagerClassNames` disambiguates reused ids (TikTok has three `viewpager`s; only the vertical feed
is `androidx.viewpager.widget.ViewPager`) and is matched against the event or source class. Without
`pagerIds`, scroll events must come from a `surfaceIds` view (Instagram) or from anywhere when the
app has no surface ids (Facebook).

Item keys are a salted hash of (package, session, page index). The index comes from the pager
event's adapter position (`fromIndex == toIndex`), else `scrollY / surface height`
(`detection/PagerTracker.kt`). Evaluations are skipped while the pager is still scrolling (200 ms
settle), so a half-visible page never starts a dwell. If a pager emits scroll events without any
position, each settled swipe of at least half a page steps a synthetic index (debug screen shows
`(swipe)`); autoplay loops scroll nothing and keep the key.

View ids are tried qualified with the observed package first, then every package of the family
(so ReVanced builds that keep YouTube's resource package still match).

| Key | Packages | Signal |
|---|---|---|
| `instagram` | `com.instagram.android` | `clips_viewer_view_pager`; DM signature `sender_username_or_fullname` + `sender_timestamp` + `reply_bar_edittext` |
| `youtube` | `com.google.android.youtube`, `app.revanced.android.youtube`, `com.google.android.apps.youtube.kids` | `reel_player_page_container`; pager `reel_recycler` |
| `tiktok` | `com.zhiliaoapp.musically`, `com.ss.android.ugc.trill`, `com.ss.android.ugc.aweme` | `player_view`; pager `viewpager` (class `androidx.viewpager.widget.ViewPager`) |
| `tiktok_lite` | `com.zhiliaoapp.musically.go`, `com.tiktok.lite.go` | `simplayer_api_player_view` |
| `facebook` | `com.facebook.katana` | `FbShortsComposerAttachmentComponentSpec_STICKER` / `_GIF`; fallback: full-window scrollable RecyclerView/ViewPager2 containing a ≥60 % TextureView/SurfaceView |
| `facebook_lite` | `com.facebook.lite` | `video_view` |
| `snapchat` | `com.snapchat.android` | `spotlight_container` |

All are enabled in ruleset v4. The service XML `packageNames` is generated from the enabled apps of
the **signed** bundled payload at prebuild, so the service only ever receives events from these
packages. `isAccessibilityTool` is always `false` (Thumbwell is not an accessibility tool under
Play policy); never change it.

### Signing and rotation

```bash
# from a worktree, point at the key in the main checkout (never copy .secrets/ around)
BRAINLING_RULES_KEY_DIR=<main checkout>/.secrets/rules-signing \
  node scripts/rules/sign-rules.mjs sign brainling-dev-2026-10 \
  modules/thumbwell-core/rules/rules.json \
  modules/thumbwell-core/android/src/main/assets/thumbwell/rules.signed.json
node scripts/rules/sign-rules.mjs verify <publicKeyB64> brainling-dev-2026-10 <file>
```

- Bump `version` on every change; the app never applies a version lower than the highest it has
  accepted (rollback) or one that is expired.
- `.secrets/` is git-ignored; private keys never enter the repo, EAS or CI.
- Rotation: `keygen <newKeyId>`, add the public key to `TrustedRuleKeys.kt`, ship an app update,
  then sign with the new key. The dev key `brainling-dev-2026-10` must be replaced by an offline
  production key before release.
- Remote rules: host the signed envelope at `THUMBWELL_RULES_URL` (https only, see `docs/EAS.md`).

## Watchdog and re-enable reminder

`HealthMonitor` derives `ok` / `disabled` / `not_running` and records each change in
`health_events` (30-day retention). When the state goes from `ok` or `not_running` to `disabled`
(typically a banking app asked the user to turn accessibility off) it posts a local notification
on channel `thumbwell-service-health`. One tap opens Thumbwell itself on `thumbwell://reenable`
(an explicit `ACTION_VIEW` intent to our own package), never system settings directly: the
`src/app/reenable.tsx` route explains why the AccessibilityService is needed (Play
prominent-disclosure rule) and only its button calls `openAccessibilitySettings()`. The route
re-checks `isServiceEnabled()` on foreground and shows a confirmation once it is back on. It is
cleared when the service is back to `ok`. It uses the platform notification API (the JS runtime is
not running in the worker) and the `POST_NOTIFICATIONS` permission declared by expo-notifications;
without the runtime grant on Android 13+ it is skipped. No new dependency was added.

## Debug capture-layout tool (debug builds only)

Detection debug screen → **Capture next window**, then open the target app on the screen to study.
The service writes the node tree of the next window it evaluates to
`<cache>/thumbwell-layouts/<package>-<time>.txt` (class, view id, bounds, flags; content
descriptions only when they look like component labels such as `…Spec_…`; never text). **Share
capture** sends the file via expo-sharing. The code lives in `src/debug` and is not compiled into
release.

## Room schema

`ksp { arg("room.schemaLocation", "$projectDir/schemas") }` exports to
`modules/thumbwell-core/android/schemas/com.algoastics.thumbwell.core.data.ThumbwellDatabase/1.json`.
Every schema bump: raise `version`, add `Migration(n, n + 1)` to `Migrations.ALL`, commit the new
schema JSON, add a migration test. There is no destructive fallback.

## Release manifest

- No `SYSTEM_ALERT_WINDOW` in release (removed by `plugins/withReleaseBlockedPermissions`; debug
  keeps it for the RN dev menu).
- No foreground service in any build: the plugin removes WorkManager's
  `SystemForegroundService` and `FOREGROUND_SERVICE*` permissions with `tools:node="remove"`.
- Service: `exported=false`, `permission=BIND_ACCESSIBILITY_SERVICE`.

## Tests

JVM unit tests in `modules/thumbwell-core/android/src/test`: ruleset parsing/validation, signature
verify (bundled asset, tampering, unknown key, malformed, rollback/expiry policy), dwell and
de-dupe (`ReelCounter`, restored keys), session persistence and policy, structural matching, day
close (incl. DST), reminder trigger. Run with `./gradlew :thumbwell-core:testDebugUnitTest` after
`npx expo prebuild -p android`. Jest covers the hooks and the re-enable route (`src/detection/__tests__`).

## Open

| Item | Notes |
|---|---|
| First compile + unit test run | Not run: no JDK/Android SDK on the authoring Mac. |
| Room schema JSON | Generated by the first KSP build; commit `android/schemas/` from that build. |
| Device accuracy (DoD ≥95 % on 6 phones) | No device testing done for any of the five apps. View ids for TikTok, Facebook, Snapchat come from the spec, not from captures. |
| Page index for apps without scroll indices | Item identity relies on scroll events (`fromIndex`/`scrollY`); apps that emit neither will count at most one item per surface session. Verify with capture-layout + logcat. |
| YouTube autoplay advance | Not handled separately; depends on scroll events being emitted. |
| Re-enable route vs M2 disclosure | The reminder now opens `thumbwell://reenable` (minimal disclosure + settings button, M1 i18n/UI). M2's full disclosure screen is not on this branch; when M2 merges, have the route reuse M2's disclosure component and copy so there is one disclosure text. |
| Production signing key | Replace the dev key in `TrustedRuleKeys.kt`. |
