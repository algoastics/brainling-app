# M04 — Limit engine and the S22-P0 lock overlay

Native, inside the accessibility service process; nothing here depends on the JS runtime.
Code: `modules/thumbwell-core/android/src/main/java/com/algoastics/thumbwell/core/lock/`.

| File | Role |
|---|---|
| `LockLogic.kt` | Pure rules, unit-tested on the JVM: `LockRules` (limit boundary, zero mode, active window), `LockClock` (locked-until), `LockTrigger` (when to show), `OverlayGuard` (text input, multi-window, cover area), `LeaveFlow` (BACK / cooldown / HOME). |
| `LimitEngine.kt` | Today's total (counter store, Room) against the effective daily limit (`DailyLimit`: lower applies now, raise from the next logical day). Fires only on change. |
| `LockOverlay.kt` | The S22-P0 view, a `TYPE_ACCESSIBILITY_OVERLAY` window (no `SYSTEM_ALERT_WINDOW`). |
| `LockController.kt` | Glue inside the service: when to cover, guards, "Leave reels", watchdog, screen-off. |

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
  instead. Hidden when the surface is gone, the app is no longer in front (500 ms watchdog), the screen
  turns off, the service is interrupted or unbound, or the lock lifts. `show` and `hide` are idempotent;
  main thread only.
- A reel seen while the overlay covers the surface is not counted (evaluation returns before the
  count). Counting continues everywhere else, and Room stays the source of truth.
- Needs a valid consent record, like counting. No consent, no lock.
- Turning Accessibility off to escape is allowed; Home shows the counter-off state.

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
