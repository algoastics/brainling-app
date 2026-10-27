# M03b — The floating Thumb badge (F07, S50-P0)

Native, inside the accessibility service process. Code:
`modules/thumbwell-core/android/src/main/java/com/algoastics/thumbwell/core/detection/`.

| File | Role |
|---|---|
| `BadgeLogic.kt` | Pure Kotlin, unit-tested (`BadgeLogicTest`): `BadgeMachine` (gone / resting / awake and the actions each step emits), `BadgeGate`, `Odometer` (digit plan, 150 ms + 30 ms stagger), `BadgePlacement` (snap side, clamp, Thumb side, pill and window padding, `restShift`: Figma A42 rest offsets, the rest clip), `BadgeCorners` (per-corner radii and their blend), `FrameCoalescer` (one window update per frame while dragging), `BadgeRest` (resting look constants, `NODE_ALPHA` 0.7), `BadgeTiming`, `ReducedMotion`, `BadgeSettings`. |
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
  closed, 0.93 scale) on the pill end that faces the screen centre, and **the count pill stays on
  screen**, the whole resting node (Thumb and pill) at **70% opacity** as one group (PM decision,
  option B; the original spec hid the pill and dimmed the Thumb to 40%). Geometry is the Figma A42
  frames (57:977, 57:996, rule 74:1952): pill 84 wide, never changing size or position; the Thumb
  moves about 21.7 dp (`thumbW / 2 - 5`) away from the pill, so its centre sits on the pill's end
  facing the centre (left end on the right edge, right end on the left edge: mirror images), and
  drops about 7 dp to the pill's centre line. Only its outer half shows (Figma "Thumb peek": the
  inner half is tucked behind the pill; the app keeps the Thumb above the pill and clips it to the
  outer half instead, in step with the slide, so it can never vanish behind the pill and never
  covers the count). The count sits at 16 dp from the pill's left in both frames: on the left edge
  it never moves, on the right edge it moves 30 dp left (out of the Thumb's socket). Translate and
  alpha only (plus the clip). Each counted reel restarts the timer. "Hide completely when resting"
  hides the whole badge (Thumb and count) instead. "Always" never rests. Flip
  `BadgeRest.PILL_VISIBLE` to false for the Thumb alone.
  Earlier builds put the resting Thumb on the screen-edge end, half off screen (rest +63 dp on the
  right edge, -21 dp on the left); the Figma frames show it on the centre-facing end, so that was
  changed (see `NEEDS_DECISION.md`, the scope text says "half off the edge").
- Thumb side: the Thumb is always on the side that faces the screen centre. Badge on the LEFT edge:
  Thumb right of the pill, count on the left; on the RIGHT edge: Thumb left of the pill, count on
  the right. The pill's 46 dp socket is on the Thumb's side and the 16 dp gap on the other. The
  Thumb art is not mirrored (Figma 57:977 and 57:996 use the same artwork on both edges).
- Corners: docked on an edge, the corners on the screen-edge side are flat (radius 0) and the inner
  ones fully round (`BadgeCorners`); while dragging all four are fully round with the violet ring.
  On release the radii blend from round to flat during the snap.
- Layering: the Thumb is drawn in front of the pill (elevation 6 dp vs the pill's 2 dp, 3 dp when
  dragged). Android orders views by elevation before child order; with the pill higher the Thumb used
  to be hidden behind it (device bug).
- Drag: lifts (scale 1.2, violet ring) and follows the finger. Touch events are coalesced: the last
  position of a frame goes to the window manager in ONE `updateViewLayout` from a `Choreographer`
  callback (`FrameCoalescer`), nothing is allocated per touch or frame. Release (A31) glides the SAME
  window to the nearer edge in 220 ms (`SNAP_MS`, decelerate, no overshoot) by animating its layout x
  and y; the badge is never hidden, removed or re-added. If the side flips, the Thumb and the count
  slide to their new places in the same animation (the window is as wide on both sides, so it does
  not resize). The final layout is committed once and the position saved natively once. A touch
  during the snap finishes it at once. Rest waits (retry every 300 ms) while a drag or a snap runs.
  The window reaches 12 dp past the screen edge and 28 dp past the centre-facing pill end (room for
  the resting Thumb); it is still only as big as the badge. Vertical keep-outs: 96 dp top, 120 dp bottom. A tap or drag on the resting badge wakes it (A40 with the current count, no roll);
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

## Fresh open always shows it (regression fix)

Whether the badge "was already shown" lives only in `BadgeMachine` (`onSurface(count)`, `visible`
cleared by `setVisible(false)` and by `onHideDue`). It used to be a second flag in `CountBadge` that
stayed true after the 600 ms leave fade, so a return to the reels surface (or a reopen after a kill
from Recents) added nothing. Also: a window still fading out is removed before a new one is added, a
window the system detached is dropped and re-added, a fresh app entry starts from a clean badge, and
events that arrive while the seen state loads after a process start are replayed once it is loaded
(no scroll needed). Tests: `BadgeReopenTest`.

## Known limits

- No keyboard-window check: the service does not request interactive windows. A focused text input
  (and the foreground package check every second) hides the badge instead.
- Springs are approximated with `OvershootInterpolator` (pop-out and flick) and `DecelerateInterpolator` (the snap) (no new deps).
- Not yet measured on a device: animation smoothness, drag lag, the snap glide, the rest clip, battery with the badge on.
- Every window update during the 220 ms snap is still one window-manager call per frame; a screen-wide window would avoid it but would block touches (F07 item 6).
