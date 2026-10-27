# M03b — The floating Thumb badge (F07, S50-P0)

Native, inside the accessibility service process. Code:
`modules/thumbwell-core/android/src/main/java/com/algoastics/thumbwell/core/detection/`.

| File | Role |
|---|---|
| `BadgeLogic.kt` | Pure Kotlin, unit-tested (`BadgeLogicTest`): `BadgeMachine` (gone / resting / awake and the actions each step emits), `BadgeGate`, `Odometer` (digit plan, 150 ms + 30 ms stagger), `BadgePlacement` (snap side, clamp, `restShift`: Figma A42 rest offsets), `BadgeRest` (resting look constants, `NODE_ALPHA` 0.7), `BadgeTiming`, `ReducedMotion`, `BadgeSettings`. |
| `CountBadge.kt` | One `TYPE_ACCESSIBILITY_OVERLAY` window. Turns `BadgeAction`s into framework animators and timers on one main `Handler`. Drag, snap, tap. |
| `OdometerView.kt` | The count: one clipped slot per character, rolling digits. |
| `ThumbwellAccessibilityService.kt` | Decides the gate (`updateBadge`), feeds the count, hides on lock / input / surface gone. |

Art: `res/drawable/ic_thumb_badge_{open,half,closed}.xml` (vector, from the Figma "Badge Thumb"
set 57:932), colours `thumbwell_badge_*` (light and night), font `assets/fonts/nunito_extrabold.ttf`.

## Rules

- Thumb plus the foreground app's count today. No platform icon.
- Shown only on an Instagram Reels, YouTube Shorts or TikTok reels surface, with that app's count.
- Hidden when: counting is paused or consent is missing, off the surface, the lock overlay is
  showing (the lock wins), a text field has input focus, or the "Floating badge" switch is off.
  Leaving the surface fades the badge out after 600 ms unless the surface returns.
- A counted reel: pop-out (200 ms) and flick (140 + 160 ms) from rest; when already awake only the
  changed digits roll (150 ms each, 30 ms stagger, ones first). Bob 1.6 s, plus or minus 2 dp, stops
  after 10 s in "Always". Blink about 120 ms every 3 to 5 s while awake.
- Display time defaults to **Always** (PM decision): the Thumb pops out awake on arrival (and on return) and
  stays awake with the count while a tracked app is in front; later reels only roll the digits. The bob
  stops after 10 s, the blink continues. A leave hides it after a 400 ms debounce (`BadgeForeground`), so
  a transient window never hides it while scrolling; a safety package hides at once.
- After the display time (1 s, 2 s, 3 s) the Thumb settles (240 ms): it sleeps (eyes
  closed, 0.93 scale) half past the screen edge, and **the count pill stays on screen**, the whole
  resting node (Thumb and pill) at **70% opacity** as one group (PM decision, option B; the original
  spec hid the pill and dimmed the Thumb to 40%). Geometry is the Figma
  A42 frames (57:977, 57:996, rule 74:1952): the pill never changes size or position; the Thumb
  slides ONTO the pill's edge end (about +63 dp on the right edge, -21 dp on the left, centre on the
  screen edge, centred vertically on the pill) over the pill's 46 dp socket, in front of it; on the
  right edge the count also moves 30 dp inward, on the left it stays. Translate and alpha only. Each counted
  reel restarts the timer. "Hide completely when resting" hides the whole badge (Thumb and count)
  instead. "Always" never rests. Flip `BadgeRest.PILL_VISIBLE` to false for the Thumb alone.
- Layering: the Thumb is drawn in front of the pill (elevation 6 dp vs the pill's 2 dp, 3 dp when
  dragged). Android orders views by elevation before child order; with the pill higher the Thumb used
  to be hidden behind it (device bug).
- Drag: lifts (scale 1.2, violet ring), release snaps to the nearer edge (220 ms) and the position is
  saved natively. Vertical keep-outs: 96 dp top, 120 dp bottom. A tap or drag on the resting badge wakes it (A40 with the current count, no roll);
  a tap on an awake badge opens Thumbwell.
- Reduced motion (animator or transition scale 0): fades and instant swaps, no spring, bob, blink or roll.
- Nothing runs while resting or hidden. No haptics, no sound, no analytics event.

## Overlay safety (F07 item 10)

Never over Android Settings, Accessibility settings or the package installer / uninstall dialog.
`OverlaySafetyPackages` (pure, tested) holds the exact and prefix package list including OEM
variants. The service checks it on every event, on window changes against the active window, and
every 500 ms while the badge is up (`BadgeGate.visible(..., safetyWindow)`); a match hides the badge
at once. Only the foreground package name is read.

## Settings and API

Stored in `CorePrefs`: `badge_enabled` (default true), `badge_display_time` (`1s`/`2s`/`3s`/`always`,
default `always`), `badge_hide_when_resting` (false), `badge_side`, `badge_y_dp`.
JS (`thumbwell-core`): `getBadgeSettings()` and `setBadgeSettings(patch)` (typed `BadgeSettings`).
S43-P0 rows: "Floating badge", "Badge display time" (chips dialog with a "Default: Always" caption), "Hide completely when resting" (dimmed and disabled while the time is Always).
`FeatureFlags.countBadgeEnabled` is on; `THUMBWELL_TESTER_MODE` no longer gates the badge.

## Lifecycle

The service builds the badge on connect and calls `release()` in `shutdown()`. `hideNow()` and
`release()` cancel all animators and Handler callbacks and call `removeViewImmediate`, so add and
remove are idempotent and nothing leaks. A settings change reaches the service through a `CorePrefs`
listener posted to the main thread.

## Known limits

- No keyboard-window check: the service does not request interactive windows. A focused text input
  (and the foreground package check every second) hides the badge instead.
- Springs are approximated with `OvershootInterpolator` / `DecelerateInterpolator` (no new deps).
- Not yet measured on a device: animation smoothness, drag/snap, battery with the badge on.
