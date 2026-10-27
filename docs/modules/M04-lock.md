# M04 — Limit engine and the S22-P0 lock overlay

Native, inside the accessibility service process; nothing here depends on the JS runtime.
Code: `modules/thumbwell-core/android/src/main/java/com/algoastics/thumbwell/core/lock/`.

| File | Role |
|---|---|
| `LockLogic.kt` | Pure rules, unit-tested on the JVM: `LockRules` (limit boundary, zero mode, active window), `LockClock` (locked-until), `LockTrigger` (when to show), `OverlayGuard` (text input, multi-window, cover area), `LeaveFlow` (BACK / cooldown / HOME). |
| `LimitEngine.kt` | Today's total (counter store, Room) against the effective daily limit (`DailyLimit`: lower applies now, raise from the next logical day). Fires only on change. |
| `LockOverlay.kt` | The S22-P0 view, a `TYPE_ACCESSIBILITY_OVERLAY` window (no `SYSTEM_ALERT_WINDOW`). |
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
  choose to stop, and on Android 15 and up an app that targets API 35 (Thumbwell does) may request
  focus only as the top app or with a foreground service. An accessibility service is neither, so the
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
  `SYSTEM_ALERT_WINDOW`, excluded by design. So the opaque lock starts below a see-through strip: status bar
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

Overlay appears under 500 ms after the swipe past the limit reel on Instagram, YouTube and TikTok;
covers the surface bounds correctly on each (and not the tab bar); never over a focused comment field
or keyboard; "Leave reels" goes to the Home tab in Instagram and YouTube (no auto-exit, no HOME), BACK in TikTok; the strip at the top is even and a banner shows in it; split
screen behaviour; light and dark twins; rotate; screen off and on; day roll; TalkBack reads the
title and button; no counts while covered.
