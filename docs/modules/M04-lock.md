# M04 — Limit engine and the S22-P0 lock overlay

Native, inside the accessibility service process; nothing here depends on the JS runtime.
Code: `modules/thumbwell-core/android/src/main/java/com/algoastics/thumbwell/core/lock/`.

| File | Role |
|---|---|
| `LockLogic.kt` | Pure rules, unit-tested on the JVM: `LockRules` (limit boundary, zero mode, active window), `LockClock` (locked-until), `LockTrigger` (when to show), `OverlayGuard` (text input, multi-window, cover area), `LeaveFlow` (BACK / cooldown / HOME). |
| `LimitEngine.kt` | Today's total (counter store, Room) against the effective daily limit (`DailyLimit`: lower applies now, raise from the next logical day). Fires only on change. |
| `LockOverlay.kt` | The S22-P0 view. A `TYPE_APPLICATION_OVERLAY` window when "Display over other apps" is granted, else the `TYPE_ACCESSIBILITY_OVERLAY` fallback (see "Lock window" below). |
| `LockController.kt` | Glue inside the service: when to cover, guards, "Leave reels", watchdog, screen-off. |
| `LockAudio.kt` | Stops the sound while the lock is up: `LockAudio` (pure, over an `AudioPort`) and `SystemAudioPort` (AudioManager). |
| `LockEntry.kt` | `AppEntry` (first event of an opened app) and `EarlyCover` (which apps are covered on entry). |

## Behaviour

- Locked when `total >= limit`. A limit of 0 ("zero mode") locks every reels surface from the start.
  The lock lifts by itself at the next day start (`lockedUntilMs`, from the day-start setting, in the
  phone's time zone). The twin of `src/lock/lockTime.ts`; both are tested with the same cases.
- **Show timing (chosen).** The limit reel itself is never covered. When its count reaches the limit
  while the user is on a reels surface, the lock waits for the next swipe on that surface and covers
  the next item: the first scroll event releases it, so it appears within one frame or two of the
  swipe, far under 500 ms. Arriving on a reels surface while already locked (reopening the app,
  re-entering Reels, zero mode, limit lowered in Settings) covers it on the first evaluation.
  If the user never swipes, the limit reel plays on (no mid-video cover).
- Copy: "That's {limit} reels. Time for a break.", "Locked until HH:MM" (in the body text),
  "Leave reels", "Today: {total} reels". Strings live in
  `res/values/thumbwell_lock_strings.xml`; a Jest test (`src/lock/__tests__/lockCopy.test.ts`)
  keeps them identical to `lock.*` in `en.json`, and a Kotlin test pins the headline.
- Colours: `values/thumbwell_lock_colors.xml` and `values-night/` carry the Figma light and dark
  semantic tokens. The mascot is the fried Thumb (`drawable-nodpi/thumbwell_lock_fried.png`, rendered
  from `assets/mascot/thumb-fried.svg`). Fonts are the system sans (Nunito and Inter are JS-only).
- **Leave reels** (`LeaveFlow`, `HomeTab`, `LockTree`): taps the app's Home tab and stays in the app.
  Instagram: `feed_tab`; YouTube: the first item of `pivot_bar` (rightmost in RTL); the ids are code
  constants, so the signed rules are unchanged (moving them into the rules needs a schema bump and a
  re-sign). TikTok has no Home tab: BACK. If the tab is not found, or after 700 ms a reels surface is
  still in front, BACK; if BACK loops, a 1.5 s cooldown, then HOME with a toast. That chain is the last
  resort, never the default for Instagram or YouTube. Presses meanwhile are ignored.
- **Bounds** (`LockBounds`, pure, tested). The overlay covers the reels container bounds from the
  accessibility tree, minus the bottom tab bar (known bar id, else a wide low row of 3+ clickables
  near the bottom) and, in the whole-screen fallback only, the navigation bar. Fallbacks: the app
  window minus a default 56 dp tab bar, then the screen. A cover that follows its container: when the
  container bounds change (rotate, tab bar shown or hidden) it is fitted again. It is touchable but not
  focusable, so the system BACK gesture, the keyboard and the tab bar still work.
- **Safety:** never shown while a text input has input focus (node `isEditable` or an `EditText`
  class; the text is never read). Split screen or any window clearly smaller than the screen
  (under 90% wide or 75% tall) does not get an overlay; the service uses the same BACK-then-HOME flow
  instead. Hidden when the surface is gone, the app is no longer in front (watchdog; another window must stay in front 400 ms, one odd sample never hides it, `LockWatch` + `BadgeForeground`), the screen
  turns off, the service is interrupted or unbound, or the lock lifts. `show` and `hide` are idempotent;
  main thread only.
- A reel seen while the overlay covers the surface is not counted (evaluation returns before the
  count). Counting continues everywhere else, and Room stays the source of truth.
- Needs a valid consent record, like counting. No consent, no lock.
- Turning Accessibility off to escape is allowed; Home shows the counter-off state.

## Audio, re-entry and leaving (real-phone fixes)

- **Audio.** When the lock shows, `LockAudio.engage()` requests audio focus (`AudioFocusRequest`,
  `AUDIOFOCUS_GAIN`, `USAGE_MEDIA`) and dispatches a media PAUSE key (down and up, again 400 ms
  later). `release()` abandons the focus whenever the lock hides, so nothing is held past it. Both
  are idempotent. `AUDIOFOCUS_GAIN` is permanent on purpose: with a transient request the reels app
  may resume by itself when the focus is abandoned. No new permission. Disclosure and Data safety:
  this is a local audio-focus request and a media key, nothing is collected or sent, so no change.
  It pauses other apps' media too (music), as any focus request does.
- **Late lock on re-entry (root cause).** The lock was only evaluated after a reels surface was
  detected (event, 250 ms throttle, then the surface retry delays), so TikTok showed a video for
  1 to 2 s first. Now the first event of an app that is the active window is an *entry*
  (`AppEntry`). While locked, a reels-first app (`EarlyCover.COVER_ON_ENTRY_KEYS`, TikTok) is covered
  at once with a provisional cover over the app window, the sound stops, and the reels surface when
  found re-fits it to the reels area (`maybeShow`); with no surface after 3 s it is removed. Every
  app is evaluated at once instead of after the throttle. The "lock covers the NEXT item after the
  first swipe" rule is only for the live limit reel (`LockTrigger.onState`), never for an entry.
  Guards are unchanged: never over a text input, split screen or a small window takes the normal
  path, safety packages. Instagram and YouTube open on a feed, so they are not covered before the
  surface is seen; add their rule key to `COVER_ON_ENTRY_KEYS` to change that.
- **Lingering after leaving (root cause).** Only safety packages hid at once; Home, Recents and
  everything else waited for the 400 ms debounce plus a 500 ms (badge) or 250 ms (lock) poll, and the
  service only receives events from the tracked apps, so a launcher is never reported by an event.
  Now `ForegroundWindows` classifies the window in front: the tracked app keeps, safety, **home /
  launcher packages** (resolved with the HOME intent, `resolveActivity` plus `queryIntentActivities`,
  with a `<queries>` entry and no permission, plus a built-in list) and **Recents class names**
  (`RecentsActivity`, `RecentsTransitionActivity`) are an *immediate leave* (`BadgeForeground`
  verdict `LEAVE_NOW`, `LockWatch.Action.LEAVE_HIDE`): the lock and the badge hide at once, the
  surface is forgotten, and the lock returns only on a fresh reels entry while still over the limit.
  Unknown or transient windows keep the 400 ms debounce. `com.android.systemui` as a package is not an
  immediate leave. A 150 ms service watch (and 150 ms badge and lock watches) makes "at once" about
  one tick. Recents on Pixel, Samsung, Xiaomi and ColorOS lives in the launcher package, so the package
  rule catches it; the class-name rule needs the class name, which only events carry (the service
  does not subscribe to launcher or SystemUI events).

## Audio on Samsung, notifications, TikTok cover (second device round)

- **Why the audio fix did not work (root cause).** Audio focus is only a request: the other app must
  choose to stop, and on Android 15 and up an app that targets API 35 or higher (Thumbwell targets 36) may
  request focus only as the top app or with a foreground service. An accessibility service is neither, so the
  call returns `AUDIOFOCUS_REQUEST_FAILED` (now logged: `audio focus request result=0`) and Instagram
  and TikTok are never told. The media PAUSE key only reaches an app with an active `MediaSession`;
  reels players mostly have none. `MediaSessionManager.getActiveSessions` would need a notification
  listener (or the system-only `MEDIA_CONTENT_CONTROL`): not used, no new permission is added.
- **HOME fallback removed.** The 700 ms HOME after every cover (`HomeFallback`) closed the app by
  itself and is gone. HOME remains only as the last step of Leave reels (see above). Sound is now
  handled in place by the layers in `LockAudio` (in-app pause or mute control, focus plus PAUSE key,
  then a music-stream mute with exact restore); none of them leaves the app. Unverified on device.
- **Notifications over the lock.** A `TYPE_ACCESSIBILITY_OVERLAY` window is drawn ABOVE heads-up
  banners (AOSP window layers: accessibility overlay 31, status bar 15, notification shade 17), so a
  banner can only show if the lock does not cover its area: layering "under" banners is not possible
  with this window type, and `TYPE_APPLICATION_OVERLAY` (which would be below) needs
  `SYSTEM_ALERT_WINDOW`. **This is the fallback now** (permission not granted; see "Lock window" below). The opaque lock starts below a see-through strip: status bar
  height plus 96 dp (`OverlayGuard.HEADS_UP_BAND_DP`, one constant, the only place to change it). The
  strip is full width, the lock's top corners are rounded (20 dp), and no
  window inset moves it (`setFitInsetsTypes(0)`), so it reads as the lock's top edge, not a gap.
  **The strip is see-through but absorbs every touch** (`LockFrame`): the lock is ONE window that
  runs from the bottom of the status bar to the cover's bottom, with a transparent touch-consuming
  area on top and the cover below it. Reels cannot be scrolled or tapped through it, and there is no
  second window to add, remove or leak. The status bar area is left out on purpose: SystemUI's own
  window gets the touches there (nothing reaches the reel) and the notification shade pull-down keeps
  working. Banner trade-off: the lock window is above banners, so a banner is VISIBLE through the
  strip, but a touch on it lands on the lock, so it cannot be tapped or swiped away while the lock is
  up (it times out by itself). An opaque edge-to-edge top was rejected because it would hide every banner.
  Split screen and landscape keep the full cover when cutting would leave under half.
- **TikTok cover on entry.** An event of a window-state change with no active window known yet (cold
  start splash, return from Recents) now counts as the entry (`AppEntry.windowIsUp`), and events
  that arrive while the seen state is still loading after a process start are replayed once it is
  loaded, so the first frames are covered. Device-only: how many frames TikTok draws before the first
  accessibility event (about 100 ms notification timeout), which no code can remove.
- **Not possible: covering the Recents card.** The Recents window belongs to the system launcher; no
  accessibility overlay can draw over or change it. The lock hides the moment Recents opens.

## Lock window: "Display over other apps" (SYSTEM_ALERT_WINDOW) and the fallback

Decision (Ahsan): the lock uses `TYPE_APPLICATION_OVERLAY`. This replaces the earlier "no
`SYSTEM_ALERT_WINDOW`" design. The accessibility service stays for detection only; the badge stays on
its accessibility overlay unchanged. All of it is unverified on device.

- **Why.** AOSP layers: application overlay 11, status bar 15, notification shade 17, navigation bar
  24, accessibility overlay 31. A layer-11 lock is below banners and the shade, so banners show and
  stay tappable and the shade pull-down is unaffected, while the lock itself can be fully opaque and
  edge to edge with no see-through strip.
- **Window (permission granted, API 26+).** Type `TYPE_APPLICATION_OVERLAY`; flags
  `FLAG_NOT_FOCUSABLE | FLAG_LAYOUT_IN_SCREEN | FLAG_LAYOUT_NO_LIMITS | FLAG_HARDWARE_ACCELERATED`
  (no `FLAG_NOT_TOUCHABLE`, so every touch is absorbed); `PixelFormat.OPAQUE`; gravity `TOP|START`;
  `layoutInDisplayCutoutMode` ALWAYS (API 30+, `SHORT_EDGES` before); `setFitInsetsTypes(0)` (API 30+).
  Frame: x and width from the reels container, **y = 0** (status bar area included) down to the top of
  the bottom tab bar (container bounds from the accessibility tree, as before), clamped to the
  display bounds (`maximumWindowMetrics` on API 30+). The tab bar stays free. No strip, no top gap.
  Square corners; the strip's rounded top is for the fallback only.
- **Window context.** The service's own `WindowManager` carries the accessibility window token, so
  the application overlay is added through a window context (`createWindowContext(display,
  TYPE_APPLICATION_OVERLAY, null)` on API 30+, the application context before). `hide()` removes the
  view through the manager that added it.
- **Choice (`LockWindowChoice.choose(canDrawOverlays, sdk)`, pure, tested).** Application overlay when
  the permission is granted and the API level is 26 or more, else the accessibility overlay. The
  permission is read with `Settings.canDrawOverlays` through `OverlayPermissionProbe` (cached 1.5 s).
  The choice is made each time the lock is shown, and re-checked on the watch tick while it shows.
- **Fallback (permission not granted, or the add is refused).** The previous behaviour, unchanged:
  `TYPE_ACCESSIBILITY_OVERLAY`, status bar height plus 96 dp touch-absorbing see-through strip,
  rounded top. Limits: banners and heads-up are visible through the strip but cannot be tapped while
  the lock is up. If adding the application overlay throws (the permission is refused at add time),
  the probe reads as denied for 30 s (`DENY_MS`) and the fallback window is added at once, so the two
  types never flicker.
- **Revoked while showing.** The watch tick sees the permission gone, removes the view through the
  manager that added it, and shows the fallback on the same frame. A single window is alive at any
  time. Safety packages, leave (Home, Recents, another app), screen off and service destroy hide the
  overlay exactly as before, whichever type it is.
- **Permission plumbing.** `SYSTEM_ALERT_WINDOW` is added by the thumbwell-core config plugin
  (`withOverlayPermission` in `modules/thumbwell-core/app.plugin.js`), so every prebuild regenerates
  it in the manifest; `android/` is not edited by hand. It is no longer blocked in release
  (`plugins/withReleaseBlockedPermissions` has nothing to block, and removes a stale release manifest
  left by an earlier prebuild). Bridge: `canDrawOverlays(): Promise<boolean>` and
  `openOverlaySettings()` (`Settings.ACTION_MANAGE_OVERLAY_PERMISSION` for the package, app info as a
  fallback).
- **Onboarding step** (`src/screens/OverlayPermissionStep.tsx`, shown by the Guide screen). After
  Accessibility is on, onboarding is marked complete and, unless the permission is already granted,
  the step "Show the lock under your notifications" explains what it is for (only drawing the lock
  over reels; it does not read other apps; can be turned off in Settings), what happens if skipped,
  and the path in system settings. "Open settings" opens the system page for Thumbwell. On return the
  permission is re-read (app foreground, and every 1.5 s while the user is away); granted shows a
  success state with "Continue", still off shows "Still off". "Skip for now" goes Home.
- **Settings entry.** Settings, Lock section, row "Display over other apps" (`row-overlay`): value
  Allowed or Not allowed, an explanation, and a tap that opens the same system page, which is the
  way to turn it off. Re-read on focus and on return.
- **In-app fallback note.** While the permission is not granted, Home shows a note (`overlay-notice`)
  that notifications may be hidden or not tappable while locked, with an "Allow" button to the system
  page. It has no dismiss; it goes away when the permission is granted.
- **Disclosure.** The permission is explained in its own onboarding step and in Settings, outside the
  S06 text. The S06 disclosure text and its version are not changed (no bump): the lock's behaviour
  and the data handled are the same, and the new permission collects nothing. Flag for review: if
  Play or legal wants the S06 text to name the overlay permission, that is a version 3 bump
  (`src/consent/version.ts` and native `Disclosure.CURRENT_VERSION` together, with a re-consent).
- **Play declaration note (SYSTEM_ALERT_WINDOW).** Play Console, App content: declare the
  "Display over other apps" permission use and the matching Permissions declaration if the form asks.
  Wording to propose: "Thumbwell shows a full-screen lock over Instagram Reels, YouTube Shorts and
  TikTok after the user reaches the daily limit they set. The window is drawn below system
  notifications so they stay usable. The user grants the permission in a dedicated onboarding step,
  can skip it (a limited fallback is used) and can turn it off in Settings. Nothing is collected or
  sent." Also add this to the demo video (grant step, lock over the reels, banner on top, revoke in
  Settings) and to the Accessibility declaration's core-feature text. Wording is proposed, pending
  Ahsan's and legal review. Keep the release manifest audit: `SYSTEM_ALERT_WINDOW` is now expected.

## Overlay safety (F07 item 10)

The lock never stays over Android Settings, Accessibility settings or the package installer /
uninstall dialog (`OverlaySafetyPackages`, same list as the badge). `LockController.onSafetyWindow()`
hides it (hide only: no BACK, no HOME, "Leave reels" is unchanged), forgets the surface, and the lock
is not shown again until a tracked reels surface is on screen again (a new entry). The 500 ms watch
is now 250 ms and checks the list on each tick: a safety package hides at once, any other window only after it has stayed in front 400 ms (the same debounce as the badge).

## JS API

- `getLockState(): Promise<{ locked, limit, total, lockedUntilMs | null }>`, recomputed on call.
- Event `lockStateChanged` with the same payload, on every change (count, limit, day start, day roll).
- `setDailyLimit`, `setDayStartMinutes` and `clearAllData` refresh the engine, so lowering the limit
  below today's total locks at once.

## Must be verified on a device

The device checks for the lock window and the permission are in `docs/TESTING-phase0.md` section J. Overlay appears under 500 ms after the swipe past the limit reel on Instagram, YouTube and TikTok;
covers the surface bounds correctly on each (and not the tab bar); never over a focused comment field
or keyboard; "Leave reels" goes to the Home tab in Instagram and YouTube (no auto-exit, no HOME), BACK in TikTok; the strip at the top is even and a banner shows in it; split
screen behaviour; light and dark twins; rotate; screen off and on; day roll; TalkBack reads the
title and button; no counts while covered.
