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
- **Leave reels:** BACK. After 700 ms, if a reels surface of the app is still in front (BACK loops),
  the button stays disabled for a 1.5 s cooldown, then HOME with a toast. Presses meanwhile are ignored.
- The overlay covers the reels surface bounds when they are most of the screen (the tab bar below stays
  tappable), else the app window, else the screen. It is touchable but not focusable, so the system
  BACK gesture and the keyboard still work.
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
or keyboard; "Leave reels" leaves in each app, and a BACK loop ends at HOME with the toast; split
screen behaviour; light and dark twins; rotate; screen off and on; day roll; TalkBack reads the
title and button; no counts while covered.
