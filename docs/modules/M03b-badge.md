# M03b — The floating Thumb badge (F07, S50-P0)

Native, inside the accessibility service process. Code:
`modules/thumbwell-core/android/src/main/java/com/algoastics/thumbwell/core/detection/`.

| File | Role |
|---|---|
| `BadgeLogic.kt` | Pure Kotlin, unit-tested (`BadgeLogicTest`): `BadgeMachine` (gone / resting / awake and the actions each step emits), `BadgeGate`, `Odometer` (digit plan, 150 ms + 30 ms stagger), `BadgePlacement` (snap side, clamp, resting x), `BadgeTiming`, `ReducedMotion`, `BadgeSettings`. |
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
- After the display time (1 s, 2 s default, 3 s, Always) the Thumb settles (240 ms) to a half
  off-edge sleeping Thumb at 40% opacity in a 48 dp wide window. Each counted reel restarts the timer.
  "Hide completely when resting" fades it out instead.
- Drag: lifts (scale 1.2, violet ring), release snaps to the nearer edge (220 ms) and the position is
  saved natively. Vertical keep-outs: 96 dp top, 120 dp bottom. A tap on a resting Thumb wakes it;
  a tap on an awake badge opens Thumbwell.
- Reduced motion (animator or transition scale 0): fades and instant swaps, no spring, bob, blink or roll.
- Nothing runs while resting or hidden. No haptics, no sound, no analytics event.

## Settings and API

Stored in `CorePrefs`: `badge_enabled` (default true), `badge_display_time` (`1s`/`2s`/`3s`/`always`,
default `2s`), `badge_hide_when_resting` (false), `badge_side`, `badge_y_dp`.
JS (`thumbwell-core`): `getBadgeSettings()` and `setBadgeSettings(patch)` (typed `BadgeSettings`).
S43-P0 rows: "Floating badge", "Badge display time" (chips dialog), "Hide completely when resting".
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
