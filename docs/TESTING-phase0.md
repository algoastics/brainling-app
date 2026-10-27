# Phase 0 device test checklist

**Status: unverified on device.** Nothing below has been run on a phone yet. Every step is a
check to perform; tick it only when you saw it happen. Package `com.algoastics.thumbwell`,
branch `thumbwell/phase0`.

Per-case detail for the counting engine (IG-1, YT-1, TT-1 and so on) is in
`docs/phone-test-cases.md`. It predates the 1 s threshold (it says 0.75 s) and mentions the
badge, which is off in Phase 0. Use this file for the pass/fail.

## 0. Build and install on your own phone (not EAS)

This is a local Gradle build. No EAS, no AAB, no Play. The release APK is signed with the
debug keystore Expo generates, which is fine for side-loading.

```bash
cd ~/Documents/"Algoastics Github"/brainling-integrate
# 1. Regenerate android/ (git-ignored). Required once now: the existing android/ was generated
#    before the rename and the Sentry plugin removal, and still applies the Sentry gradle script
#    and lists Facebook/Snapchat packages in the accessibility service XML.
npx expo prebuild --platform android --clean --no-install
# 2. Build the arm64 release APK.
cd android && \
  JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home \
  ANDROID_HOME=$HOME/Library/Android/sdk \
  ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# 3. Install over USB.
~/Library/Android/sdk/platform-tools/adb -s RF8X605YFVM install -r app/build/outputs/apk/release/app-release.apk
```

Notes:

- `THUMBWELL_RULES_KEY_DIR` is **not needed** to build. Only `scripts/rules/sign-rules.mjs` reads it
  (when you re-sign the ruleset). The bundled `rules.signed.json` (v5, dev key
  `brainling-dev-2026-10`) is verified against `TrustedRuleKeys.kt` at runtime.
- `SENTRY_DISABLE_AUTO_UPLOAD` is not needed after the prebuild. `@sentry/react-native` is still
  in `package.json` but nothing initialises it and the config plugin is gone.
- No signing config to add: `release` uses `signingConfigs.debug`. A Play upload would need a
  real upload key; that is out of scope here.
- `THUMBWELL_TESTER_MODE` has no effect in Phase 0 (the count badge flag is off).
- Release builds have R8 minify and resource shrinking on (`app.json`). If the release app
  crashes at launch and debug does not, suspect missing keep rules and tell me the logcat.
- `THUMBWELL_RULES_URL` (https only) is optional remote rules; leave it unset for these tests.
- Install over a previous Thumbwell build keeps data. For test A, uninstall first.

## A. Install and first run

Start from a fresh install (`adb uninstall com.algoastics.thumbwell`, then install). Phone on
Android 13 or newer if you have one.

1. [ ] Launch. Splash (S01) shows about 1.2 s, then Welcome (S02, "Step 1 of 3"). Kill the app
   mid-onboarding and relaunch: you get Welcome again, not Home.
2. [ ] Welcome says it counts Instagram, YouTube and TikTok. Tap "Let's set it up".
3. [ ] Daily limit (S04, step 2 of 3): default 60. Presets 30, 60, 100 select. Stepper moves by 5.
   Set 30 for now. "Continue".
4. [ ] Disclosure (S06, step 3 of 3): text matches what the app really does. "Agree & continue"
   is disabled until the box is ticked. Scroll hint works.
5. [ ] "Not now": you land on Home with the "Counting is paused" banner (consent missing). Tapping
   "Turn it back on" shows the disclosure again, never goes straight to Android settings.
6. [ ] Agree: Guide (S07) opens. "Open Accessibility settings" lands in Android Accessibility.
7. [ ] Side-loaded Android 13+: if the Thumbwell switch is greyed or says "Restricted setting",
   use the guide's "Open App info" -> three dots -> **Allow restricted settings** -> back to
   Accessibility -> Thumbwell ON. Note whether this was needed after an `adb install`.
8. [ ] Return to Thumbwell: success screen "Thumbwell is on". Before switching it on, a check
   without it shows "Still off, try again".
9. [ ] "Go to Home": counts show 0 for each app, total vs limit 30, banner gone.
10. [ ] Stopwatch: first launch after install to the first reel counted on Home must be under 3
    minutes (also recorded in F).
11. [ ] Kill and relaunch: straight to Home (no onboarding).

## B. Counting (repeat for Instagram Reels, YouTube Shorts, TikTok)

Setup: Accessibility on, limit high enough not to lock (set 500), force-stop the app, note the
count `N` on Home.

1. [ ] Open the reels surface and stay on the first reel 1.5 s: Home shows `N+1`.
2. [ ] Open it and leave within 0.5 s (swipe on at once): that reel does not count.
3. [ ] Swipe forward 10 reels, pausing 1.5 s on each: count rises by exactly 10 (plus the first).
4. [ ] Swipe back to an already counted reel and wait 3 s: no change. Swipe forward again over seen
   reels: no change. Swipe past the furthest seen reel onto a new one: +1.
5. [ ] Leave the app (Home button) and return to the same reel without moving: no change.
6. [ ] Open and close comments, open the creator profile and come back: no change.
7. [ ] Scroll the main feed (Instagram Home, YouTube Home, TikTok non-reel tabs) for 10 s: no change.
8. [ ] Ads: scroll until a sponsored reel appears, stay 3 s: no count; the next normal reel counts.
9. [ ] Home updates under 1 s: open Thumbwell right after a reel counts (app switcher) and the
   new count is already there; with Thumbwell visible in split screen it changes within 1 s.
10. [ ] Force-stop Thumbwell, then reopen: counts unchanged. Reboot the phone, reopen Thumbwell
    (Accessibility service re-enables itself): counts unchanged, and counting resumes.
11. [ ] Accessibility off: Home shows "Counting is paused" within a few seconds; scrolling a reel
    does not count; "Turn it back on" goes via the disclosure.
12. [ ] Consent missing (Settings -> Delete my data, skip consent on the second onboarding):
    banner shows the consent text and nothing counts even with Accessibility on.
13. [ ] Per-app totals add up to the total on Home. Facebook and Snapchat do not count.
14. [ ] Notification on service disabled (N04): turning Accessibility off posts a Thumbwell
    notification; tapping it opens the re-enable screen, not Android settings.

## C. Lock (docs/modules/M04-lock.md)

Replace the limit for each step as noted. Test on Instagram, YouTube and TikTok.

1. [ ] Set the limit to 5 in Settings and note Home's count. Scroll Reels, Shorts and TikTok in turn
   until the count hits 5.
2. [ ] The limit reel plays on. Swipe once: the lock covers the next item within half a second. The
   title says "That's 5 reels. Time for a break.", the body says "locked until 04:00" (or the
   day-start setting), light and dark both look right. A limit of 1 reads "1 reel".
3. [ ] Tap Leave reels: you leave Reels and the count does not grow while the lock is up. If the app
   lands back on Reels, wait about 2 s for HOME and the "Taking you to your home screen" toast.
4. [ ] While locked, open DMs or the feed (they work). Re-enter Reels: the lock is back at once. Try
   the bottom tab bar while the lock is up.
5. [ ] Open comments and focus the text field: the lock must not cover it or the keyboard.
6. [ ] Set the limit to 0: Reels lock on arrival. Then try split screen and check the BACK, then
   HOME behaviour.
7. [ ] Press power with the lock showing, then wake: it is gone, and back on a reels surface.
   Rotate once.
8. [ ] Turn Accessibility off: the lock disappears and Home shows counting paused.
9. [ ] TalkBack on: the title and "Leave reels" are read.
10. [ ] Day roll: change Day starts at to a time one minute ahead, wait: the lock lifts, count is 0.

## D. Settings

1. [ ] Limit lower: set 100, then 60. Applies at once, Home shows 60.
2. [ ] Limit raise: set 100 while the limit is 60. Dialog says it applies tomorrow, Settings shows
   "100 reels from tomorrow", Home still 60. Set the same value: "This is your current limit."
3. [ ] Limit below today's total locks at once (see C). Raising does not unlock until the day roll.
4. [ ] Day starts at: the dialog opens, pick a time; "Locked until" on the lock and the day roll
   follow it. Default 04:00.
5. [ ] Counting row shows On / Paused and matches reality.
6. [ ] Accessibility disclosure row opens the disclosure text again.
7. [ ] Privacy policy opens a browser. It is a placeholder (`https://example.com/thumbwell/privacy`)
   until the real URL is set in `src/config/appConfig.ts`.
8. [ ] Send feedback opens your mail app with subject "Thumbwell feedback", the intro line and
   no personal data. The recipient is the placeholder `support@example.com`.
9. [ ] About: version and build, privacy link, disclaimer "Not affiliated with or endorsed by
   Meta, Google/YouTube, TikTok or Snap Inc." Same disclaimer at the foot of Settings.
10. [ ] Delete my data: confirm. Counts, limit and settings are gone, Thumbwell returns to the
    splash and Welcome. Native counts are 0 too (Home after setup).

## E. Dark mode

1. [ ] Phone in dark mode: Splash, Welcome, Limit, Disclosure, Guide, Home, Settings, About and
   the dialogs are readable (contrast, no white flashes, status bar icons visible).
2. [ ] Switch light/dark while the app is open: it follows without a restart.
3. [ ] Lock overlay in both themes (C2), and the Thumb art on Home looks right in both.

## F. Exit-criteria matrix (scope 4.1)

Phones: Pixel, Samsung A-series, Redmi, Oppo/realme, Vivo, OnePlus. One row per phone and app.
Record the Android version, OEM skin and the Instagram, YouTube and TikTok versions.

**Accuracy** (≥ 95% Instagram and YouTube, ≥ 90% TikTok):

1. Fresh state: force-stop the app, set the limit to 500, note Home's count `N0`.
2. Watch 100 distinct reels by hand: swipe forward only, 1.5 to 2 s on each, first reel included.
   Keep a tally counter. No back swipes in this run. Skip nothing.
3. Read `N1`. `counted = N1 - N0`.
4. `accuracy % = (1 - |counted - 100| / 100) * 100`. Record under- and over-counts separately
   (counted < 100 is a miss, counted > 100 is a false count; both reduce accuracy).
5. Repeat a second run for a different app. Log app version and OEM skin on every row.
   (A 200-reel scripted run is the allowed alternative; there is no script in this repo yet.)

**Lock overlay** (works on ≥ 5 of 6 phones, appears under 500 ms, Leave reels always works):

6. Run C1 to C3 on each app. Record the swipe-to-overlay time from a screen recording at 60 fps:
   swipe release frame to first overlay frame, under 30 frames. Record whether Leave reels
   worked on each app and whether HOME fallback was needed.

**Fresh install to counting** (under 3 minutes on all 6):

7. Uninstall, install, start the stopwatch at first launch, stop when Home shows the first
   counted reel (after the whole of A, including Accessibility). Record the time.

**Battery** (target under 2% per day):

8. Full charge, `adb shell dumpsys batterystats --reset`, use the phone normally for a day with
   Thumbwell on, unplug throughout. Then `adb shell dumpsys batterystats --charged com.algoastics.thumbwell`
   and read the estimated power use in mAh; divide by the battery capacity. Cross-check with
   Settings -> Battery usage -> Thumbwell. The scope says "with the badge on"; the badge is off in
   Phase 0, so this is the no-badge number.

**Result table** (copy per phone):

| Phone / Android / skin | IG acc % | YT acc % | TT acc % | Lock ok | Overlay ms | Leave ok | Install to count | Battery %/day |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

The closed-track criteria (≥ 12 testers, crash-free ≥ 99.5%) are measured in Play Console, not here.

## G. Known issues for Phase 0

- **Feed refresh after going back to reel 1 undercounts.** If the app reloads the feed after you
  swipe back to the first reel, new reels can look like seen ones. This cannot be detected from
  the accessibility tree; expect small undercounts.
- **Facebook Reels and Snapchat Spotlight are off** by flag (ruleset v5 also keeps TikTok Lite
  disabled). They do not count and are not in the service's package list.
- **Split screen / small windows:** the overlay cannot cover a partial window reliably, so the lock
  uses BACK, then HOME with a toast. Counting in split screen is untested.
- **Cloned apps** (Samsung Secure Folder, Dual Messenger, Xiaomi Second Space, work profile) have a
  different user, a different package visibility and are not expected to count or lock.
- **Other forks:** only `com.instagram.android`, `com.google.android.youtube` and the two main
  TikTok packages are in the service config. YouTube Kids, ReVanced and Lite apps are not.
- **Count badge is off** (`FeatureFlags.countBadgeEnabled = false`) and there are no badge
  settings (on/off, display time, hide when resting). Scope exit criterion 7 (S50-P0) cannot
  be tested in this build.
- **Placeholders:** privacy policy URL and support email in `src/config/appConfig.ts`.
- **Sentry is not initialised**; crash data comes only from logcat.
- "Today: 1 reels" on the lock caption still uses the plural form (title is fixed).
- **Dev key:** rules are signed with `brainling-dev-2026-10`; replace with an offline production key
  before release.

**Not verified on a device at all:** everything in this file. In particular: the overlay
timing and bounds on each app, the BACK/HOME leave loop, split screen, keyboard and comment
focus, screen off/on and rotation, TalkBack, the day roll, boot persistence, the release (R8)
build, "Allow restricted settings" after `adb install`, the disclosure and guide flow on a real
Accessibility settings screen, Instagram, YouTube and TikTok counting at current app versions,
mailto and privacy link handoff, and battery.
