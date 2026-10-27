# Phase 0 device test checklist

**Status: unverified on device.** Nothing below has been run on a phone yet. Every step is a
check to perform; tick it only when you saw it happen. Package `com.algoastics.thumbwell`,
branch `thumbwell/phase0`.

Per-case detail for the counting engine (IG-1, YT-1, TT-1 and so on) is in
`docs/phone-test-cases.md`. It predates the 1 s threshold (it says 0.75 s) and mentions the
badge, which is now the floating Thumb (see section H). Use this file for the pass/fail.

## 0. Build and install on your own phone (not EAS)

Short version with the Play AAB answer: `docs/BUILD-local.md`.

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
~/Library/Android/sdk/platform-tools/adb -s RF8X605YFVM install -r --user 0 app/build/outputs/apk/release/app-release.apk
```

Run the install once; see `docs/BUILD-local.md` if an icon shows twice (`scripts/check-android-identity.sh`).

Notes:

- `THUMBWELL_RULES_KEY_DIR` is **not needed** to build. Only `scripts/rules/sign-rules.mjs` reads it
  (when you re-sign the ruleset). The bundled `rules.signed.json` (v5, dev key
  `brainling-dev-2026-10`) is verified against `TrustedRuleKeys.kt` at runtime.
- `SENTRY_DISABLE_AUTO_UPLOAD` is not needed after the prebuild. `@sentry/react-native` is still
  in `package.json` but nothing initialises it and the config plugin is gone.
- No signing config to add: `release` uses `signingConfigs.debug`. A Play upload would need a
  real upload key; that is out of scope here.
- `THUMBWELL_TESTER_MODE` no longer gates the badge: it is on in every build and controlled by
  Settings -> Floating badge.
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
4. [ ] Disclosure (S06, step 3 of 3), **version 2** (F03, D42): the second paragraph reads "We use this
   only to count the short videos you watch and show you your count. While one of these apps is
   open, Thumbwell also shows a small movable counter on top of it, so you can see your count as you
   scroll; you can turn it off in Thumbwell settings. We also use it, when you reach your limit, to
   cover the reels screen or go back." It matches what the app really does. "Agree & continue" is
   disabled until the box is ticked. Scroll hint works.
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
12. [ ] **Version 1 consent is asked again.** On a phone that still has a build with disclosure
    version 1 accepted (install the new APK over it, `adb install -r`): Home shows "Counting is
    paused" (consent missing) and nothing is counted or covered. "Turn it back on" opens the
    disclosure (S06) with the version 2 text, never Android settings. Agree: counting resumes. The
    same happens from the "service turned off" notification (`thumbwell://reenable`). Consent is not
    carried over silently.

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

### C.1 Audio, instant lock on re-entry, instant hide on Home and Recents (Instagram AND TikTok)

Start over the limit (limit 5, count 5 or more). Do each check once on Instagram and once on TikTok.

11. [ ] **Audio paused on lock.** Play a reel with sound, swipe past the limit: the lock shows and the
    sound stops (no audio from the next reel under it). Music from another app also pauses (a media
    PAUSE key and audio focus are used). Tap Leave reels: nothing resumes by itself.
12. [ ] **Instant lock on re-entry.** With the lock active, press Home, then open the app again.
    TikTok: the lock is on the very first frame, the video never plays on screen or out loud, even
    for a second (a cover over the whole app first, then fitted to the reels area). Instagram: open
    it on the Reels tab: the lock shows on the first evaluation, no throttle. Instagram opening on
    the feed/Home tab shows no lock until you open Reels (the feed and DMs stay usable).
13. [ ] **TikTok on a non-reels first screen.** Open TikTok on Profile or Inbox while locked: the
    cover shows and is removed after about 3 s when no reels surface appears.
14. [ ] **Instant hide on Recents.** With the lock up, open Recents (button or swipe up and hold):
    the lock (and, in a count test, the badge) is gone within about 0.15 s and never shrinks into
    the app card. Swipe the app away or tap it again: the lock returns only once the reels surface
    is back and you are still over the limit.
15. [ ] **Instant hide on Home.** With the lock up (and again with the badge up under the limit),
    press Home: both are gone at once, not after a pause.
16. [ ] A notification shade, volume panel or a popup pulled over the app for under 0.4 s does not
    hide the lock (those windows are debounced); Settings still hides it at once.
17. [ ] Samsung / Xiaomi / ColorOS launchers: repeat 14 and 15 on the phone's own launcher. If the
    lock lingers on an OEM, note its launcher package (`adb shell cmd package resolve-activity -a
    android.intent.action.MAIN -c android.intent.category.HOME`).

## D. Settings

1. [ ] Limit lower: set 100, then 60. Applies at once, Home shows 60.
2. [ ] Limit raise: set 100 while the limit is 60. Dialog says it applies tomorrow, Settings shows
   "100 reels from tomorrow", Home still 60. Set the same value: "This is your current limit."
3. [ ] Limit below today's total locks at once (see C). Raising does not unlock until the day roll.
4. [ ] Day starts at: the dialog opens, pick a time; "Locked until" on the lock and the day roll
   follow it. Default 04:00.
5. [ ] Counting row shows On / Paused and matches reality.
6. [ ] Accessibility disclosure row opens the disclosure text again, the version 2 text with the
   on-screen counter sentence.
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
   Settings -> Battery usage -> Thumbwell. The scope says "with the badge on": leave Floating badge
   on for this run, then repeat one day with it off and compare the two numbers.

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
- **Badge has no keyboard-window check** (a focused text input hides it) and its animations are not
  verified on a device; see section H.
- **Placeholders:** privacy policy URL and support email in `src/config/appConfig.ts`.
- **Sentry is not initialised**; crash data comes only from logcat.
- **Dev key:** rules are signed with `brainling-dev-2026-10`; replace with an offline production key
  before release.

**Not verified on a device at all:** everything in this file. In particular: the overlay
timing and bounds on each app, the BACK/HOME leave loop, split screen, keyboard and comment
focus, screen off/on and rotation, TalkBack, the day roll, boot persistence, the release (R8)
build, "Allow restricted settings" after `adb install`, the disclosure and guide flow on a real
Accessibility settings screen, Instagram, YouTube and TikTok counting at current app versions,
mailto and privacy link handoff, and battery.

## H. Floating Thumb badge (F07, S50-P0)

Needs the accessibility service on and the disclosure accepted. Settings -> Floating badge is on by
default. Check each on Instagram Reels, YouTube Shorts and TikTok:

1. Open the reels surface. Default display time is **Always**: the Thumb pops out awake (with the
   flick) next to the white count pill and stays. No platform icon.
2. Swipe to a counted reel: in Always only the changed digits roll (no pop). Leave the app and come
   back: the Thumb pops and flicks again. The count equals that app's count on Home. In Always the
   bob stops after about 10 s (the Thumb then stays still) and the blink continues every 3 to 5 s.
3. Set Badge display time to 2 s. After 2 s with no new reel the Thumb goes to sleep: eyes closed, half past the screen edge
   **and the white count pill stays on screen, still showing the count.** The whole resting badge
   (Thumb and pill together) is at about 70% opacity. The pill does not move or resize; the Thumb slides onto its edge end (over
   the pill's end, half off screen), and on the right edge the count moves a little inward. Bob and
   blink stop and nothing moves while it rests. Compare with Figma 52:1000 / 52:1508.
   Awake: the Thumb is fully visible **in front of** the pill's left end, never hidden behind it.
4. Settings -> Badge display time: try 1 s, 3 s, then back to Always. 1 s, 2 s and 3 s pop out on a counted reel (rolling the digits) and then sleep with the 70% pill; a swipe within the time only rolls the digits.
5. With Always selected the "Hide completely when resting" switch is dimmed and cannot be turned on.
   With 1, 2 or 3 s: Hide completely when resting on: the whole badge (Thumb and count) disappears between counts instead of resting. "Always" never rests.
6. Drag the badge: it lifts, follows the finger and snaps to the nearer edge. Kill and reopen the
   app: the position is kept. Tap or drag the resting badge (Thumb or pill): it wakes, no roll. Tap an awake badge: Thumbwell opens.
7. Hidden: Android Settings, Accessibility settings and the uninstall dialog (section I), home screen, another app, DMs inside Instagram, a focused text field or keyboard, counting
   paused (accessibility off or no consent), Floating badge off, and while the lock overlay shows.
8. Android Settings -> Accessibility -> remove animations (or animator scale 0): the badge fades and
   swaps instantly, no bob, blink or roll.
9. Frame check (optional): record at 60 fps during a count; the roll and pop-out should not drop frames.
10. Battery with the badge on: section F, step 8.
11. **Fresh open always shows the badge (regression check).** On the reels surface of Instagram,
    then TikTok: open Recents and swipe the app away, then open it again and go to the reels
    surface. The badge must show (no counted reel needed). Repeat after Home then reopen, and after
    switching Reels to Feed to Reels (the badge fades out after 600 ms on the Feed and must come back).
12. **After Thumbwell itself is killed.** Swipe Thumbwell away from Recents (do not force stop it),
    then open Instagram, YouTube or TikTok on the reels surface: the accessibility service restarts
    on its own and the badge shows as soon as the surface is on screen, before any reel is counted.
    (Settings -> Accessibility -> Thumbwell must still read On.)
13. **Samsung One UI 8 battery settings.** If 11 or 12 fail only on the phone, check, in this order:
    Settings -> Battery -> Background usage limits: turn **Put unused apps to sleep** off, and make
    sure Thumbwell is not in **Sleeping apps** or **Deep sleeping apps** (remove it). Settings ->
    Apps -> Thumbwell -> Battery: choose **Unrestricted** (not Optimized or Restricted). A **Force
    stop** of Thumbwell (App info) switches the
    accessibility service off until it is turned on again in Settings -> Accessibility -> Installed
    apps -> Thumbwell; swiping the card in Recents does not. Note the result in the test log.

## I. Overlay safety guard (F07 item 10) and store-text consistency (F18)

### I.1 Badge and lock never over Settings, Accessibility settings or the uninstall dialog

The badge and the lock overlay are hidden as soon as the foreground window is Android Settings, the
Accessibility settings screens or a package installer / uninstall dialog (list:
`OverlaySafetyPackages.kt`; hide only, nothing is pressed). Run it twice, once with the badge on a
reels surface and once with the lock showing (limit reached; or limit 0):

1. [ ] On a reels surface with the badge visible, pull the notification shade and tap the Settings
   cog: Settings opens and **no badge** is drawn over it (hidden within about a quarter of a second).
2. [ ] Open Settings -> Accessibility (and Thumbwell's entry in it) from the same state: no badge.
3. [ ] Start an uninstall of Thumbwell while a reels app is in front (long-press the Thumbwell icon
   -> App info -> Uninstall, or `adb shell am start -a android.intent.action.DELETE -d
   package:com.algoastics.thumbwell`): the package installer's confirm dialog shows with **no badge
   and no lock** over it. Cancel it.
4. [ ] Repeat 1 to 3 with the lock overlay up: the lock disappears, Settings and the dialog are fully
   usable, and **the lock does not come back** while you stay in Settings.
5. [ ] Go back to the reels app: the badge returns (no lock) or, if the limit is reached, the lock
   returns on the reels surface. It never returns before you are back on the reels surface.
6. [ ] BACK and HOME are not pressed by the guard. "Leave reels" still does BACK, then HOME.
7. [ ] Other-OEM phones (not on the Samsung RF8X605YFVM): repeat on Xiaomi, OPPO/realme, vivo, Huawei
   or Honor if you have one. Note the real package of any screen where the overlay still shows, and
   add it to `OverlaySafetyPackages`. (`adb shell dumpsys window | grep mCurrentFocus` while on it.)
8. [ ] Pull down the notification shade over a reels app: the badge goes after about half a second (a
   normal leave) and comes back when you close it. SystemUI is deliberately not in the safety list,
   so it cannot make the badge flicker while you scroll.

Known limit: the service config only lists the tracked apps, so it gets no events from Settings
itself. The guard therefore checks the active window on every event from a tracked app and every
250 ms while an overlay is up, not on Settings' own window events.

9. [ ] **No hide while scrolling (Always, the default).** Scroll Reels, Shorts and TikTok for a minute,
   with the volume buttons and a notification arriving: the Thumb and the count stay on screen the
   whole time, with no flicker or re-pop. It hides only when you leave the app (about 0.4 s later),
   focus a text field, open Settings/an installer, or counting is paused.

### I.2 Play and store text must match the build (F18)

1. [ ] Service description: Android Settings -> Accessibility -> Thumbwell shows exactly "Thumbwell
   counts the Instagram Reels, YouTube Shorts and TikTok videos you watch, shows your count on a
   small on-screen counter you can switch off, and, at your limit, covers the reels screen or goes
   back. Everything is processed on your phone." (needs a prebuild; an old `android/` still has the
   old text.)
2. [ ] The S06 text (version 2), the service description above, the Play declaration core-feature
   text (F18 item 7) and the listing sentence (F18 item 4, "While Instagram Reels, YouTube Shorts or
   TikTok is open, Thumbwell shows a small movable counter on top of it. You can turn it off in
   settings.") all say the same thing: an on-screen counter, switchable off, lock at the limit,
   processed on the phone. All of this wording is proposed and pending Ahsan's and legal review.
3. [ ] Demo video (about 60 to 90 s) records: open the app, the full S06 disclosure scrolled slowly,
   consent, enabling the service, the decline flow and re-trigger, the count rising in a reels app,
   **the badge appearing and updating inside a reels app, then switching it off in Settings ->
   Floating badge and showing it removed**, and the lock overlay.
4. [ ] Data safety answers unchanged (the counter shows numbers already on the phone).
