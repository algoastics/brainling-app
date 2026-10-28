# NEEDS_DECISION

(Untracked on purpose. One entry = question, options, option taken, files affected.)

## T3-1: Where the sleeping Thumb sits at rest (Figma vs scope text)

Figma frames 57:977 (resting, Edge=right) and 57:996 (resting, Edge=left), rule 74:1952, put the
sleeping Thumb's centre on the pill end that FACES THE SCREEN CENTRE, outer half visible, inner half
tucked behind the pill (peek frame x = -25 on the right edge, x = 84 on the left edge; pill 84 x 38;
count at x 17 / 16; whole node opacity 0.7). The scope text (4.1 criterion 7, D-2, F07 3.1) says
"Thumb tucked half off the edge", and the older code (fa2e3b3) put the Thumb on the SCREEN-EDGE end
(+63 dp on the right edge, -21 dp on the left). With "Thumb faces the centre" that would make the
Thumb cross the pill to the far end when it falls asleep.
- Option A (taken): follow Figma on both edges. Rest = Thumb moves about 21.7 dp away from the pill
  (right edge -21.7, left edge +21.7), centred on the pill end that faces the centre, clipped to its
  outer half. Count: left edge stays, right edge moves -30 dp (count at 16 dp on both edges).
  Visible result matches 57:977 and 57:996.
- Option B: keep the old edge-end rest (Thumb crosses the pill, half off screen). Matches the scope
  words, not the Figma frames; the Thumb would swap ends when it sleeps.
- Option C: edit the scope text ("half off the edge") to "tucked behind the pill" (PM owns the scope).
Files: BadgeLogic.kt (`BadgePlacement.restShift`, `thumbClipLeft/Right`), CountBadge.kt,
BadgeLogicTest.kt, docs/modules/M03b-badge.md, docs/TESTING-phase0.md H.3.

## T3-2: Resting Thumb is clipped instead of drawn behind the pill

Figma says the inner half is "tucked behind the pill". D-4 / F07 item 6 says the Thumb is never behind
the pill (device bug). Taken: the Thumb stays above the pill (elevation 6 dp) and `View.clipBounds`
shows only its outer half at rest, animated in step with the slide. Same look as Figma, no layering
risk. Needs Ahsan's eyes on the device. Alternative: draw it truly behind (needs the pill above the
Thumb at rest only).
Files: CountBadge.kt (`updateThumbClip`).

## T3-3: Thumb art is not mirrored on the left edge

Figma uses the same Thumb art on both edges (the Thumb is nearly symmetric, eyes closed at rest). Taken:
no mirroring, no new drawables. If Ahsan wants the face turned toward the centre, mirror
`ic_thumb_badge_*` on the left edge (`scaleX = -1` on the art view).
Files: none changed.

## T3-4: Window is 16 dp wider on the centre side

The resting Thumb sticks out of the pill by about 25 dp, the old window only had 12 dp of padding.
Taken: padding 12 dp on the screen-edge side, 28 dp on the centre side (same total width on both
sides). The touchable window grows by 16 dp on one side, still only as big as the badge area (it
already included the Thumb height and padding). Alternative: leave 12 dp and clip the Thumb at the
window (only ~12 dp would show, Figma shows ~25 dp).
Files: CountBadge.kt (`awakeGeometry`, `INNER_PAD`), BadgePlacement.windowPads.

## T4-1: Home overlay notice removed (Figma "do not nag" vs the committed notice)

Figma S11 / S22 says the permission is asked once in onboarding and again only from Settings
("do not nag"). The earlier build (commit 1568644) showed a "Notifications may be hidden while
locked" banner on Home whenever the permission was missing. Taken: remove it; Settings has the
"Display over other apps" row ("Not enabled · lock uses the fallback") instead.
- Option A (taken): follow Figma, no banner on Home.
- Option B: keep the banner (scope F06 item 12 says the user "is told" when the lock falls back).
  Revert with `git revert` of the feat(onboarding) overlay commit, or restore the banner in
  HomeScreen only; the Settings row would stay.
Files: src/screens/HomeScreen.tsx, src/lock/overlayPermission.ts (overlayNoticeVisible removed),
src/i18n/locales/en.json (home.overlayNotice* removed), src/screens/__tests__/screens.test.tsx.

## T4-2: Disclosure version 3 text is pending legal review

The S06 text (en.json disclosure.p2), the service description in modules/thumbwell-core/app.plugin.js
and the version bump to 3 follow scope F03 / F18 (D43) word for word. The scope marks the
"Display over other apps" and "may pause the video" sentences as the Researcher's wording, not legal
advice, pending Ahsan's and legal review (D9). Version 3 re-asks every user. Nothing may go to Play
before that review. A copy of the diff is in thumbwell-handoff/other-tool-disclosure-v3.patch.
Files: src/consent/version.ts, CorePrefs.kt, app.plugin.js, en.json, tests.

## T4-3: Small Figma deviations in the overlay step and Settings

- Settings row is placed after the disclosure row (Figma) and the day-start row is kept.
- The ghost buttons ("Skip — use fallback overlay", "How to turn it off", "Continue with fallback")
  are rendered as the existing text button (`kind="text"`), no new ghost button kind.
- Step indicator shows "n of 4": the scope says whether S11 joins the stepper is the designer's call;
  Figma shows 4 steps.

## T4-4 TikTok count lands 1 to 2 s after the swipe: RESOLVED in Task 6 (TikTok dwell 750 ms, rules v6; IG/YT stay 1,000 ms; pager 200 ms left as is)

Found from code only. The count is the watch threshold, not a bug: `ReelSession.SETTLE_MS` is 1,000 ms
(D36: "1,000 ms default from P0"), and rules.json `dwellMs` is 1000; the service uses
`maxOf(SETTLE_MS, rules.dwellMs)`, so the signed rules can only raise it. On top of that the pager
must settle first (`PagerTracker.SETTLE_MS` 200 ms), and the check runs on a scheduled evaluation,
so the count appears about 1.2 to 1.5 s after the swipe; a slow TikTok accessibility event adds more.
The brief says a reel counts after settling 0.75 s, but the scope (F02 item 4, D36) says 1,000 ms.
A fix means lowering the default to 750 ms in `ReelSession.SETTLE_MS`, rules.json `dwellMs` (signed,
version bump and re-sign), `RuleSetTest`, `CountingStateTest` and the M01 doc. That is a scope
decision (D36), and it changes every app, so it was not guessed. Decide: keep 1,000 ms, or move to 750 ms.

## T5-1 Colours left outside the theme tokens (design call)

- `src/components/mascot/AliveThumb.tsx` `LID` (#C8B9FD): the blink eyelid, painted to match the Thumb
  artwork skin. The artwork (`thumbArt.ts` SVG fills) is the same in light and dark, so it stays a
  fixed art colour. Say if the artwork should get dark-mode variants.
- Switch, Slider and the overlay-step preview knob were `#FFFFFF`; they now use `brandOnPrimary`
  (white in both modes). There is no dedicated "control knob" token; add one if the knob should differ
  in dark mode.
- Status bar follows the theme (`RootStack`: light icons on dark, dark icons on light). No other
  hard-coded fonts or sizes were found in src (Wordmark takes its size as a prop).

## Batch A (Figma match, 28 Oct)

- B-1 Step content transition (A53): spec says 30 dp slide + fade, 300 ms. The native stack only does
  slide_from_right (300 ms), so there is no fade and the slide is full width. Needs a design call if the
  exact 30 dp slide + fade is required (custom transition).
- B-2 Counter wording: Figma shows "1 of 4"; the brief said "2/4". Built as "Step n of 4" ("n of 4" visible).
- B-3 Type scale: Counter XL, Counter M and Display have only their sizes in Figma (64, 32, 36). Line
  height and tracking are inferred from the old ratios (64/64, 32/36, 36/40). Please confirm in Figma.
- B-4 Global component changes made for S02/S04: Screen spread bottom padding 32, Card gap 8, Chip
  (1.5 dp border, 16 x 8 padding, primary text when selected), Wordmark tracking. They also reach About,
  the overlay view and the Settings limit sheet (presets now show numbers only). Not checked against
  their own Figma frames.
- B-5 Native lock overlay and floating badge (Kotlin) keep their own sizes; the JS type scale does not
  reach them.

## Batch B (Figma match, 28 Oct)

- C-1 S06 copy: Figma (34:130) and the built strings differ. Title "Thumbwell needs Accessibility to count your
  reels" (built "...uses...reels."). Figma scroll text has 3 paragraphs (Reels, Shorts, TikToks and Spotlight;
  Instagram Lite, Facebook, Facebook Lite, Snapchat; Chrome browser reels; "We use this only to..."; "What we
  never do...") while the built text has 4 other paragraphs (overlay, pause-tap, Leave reels). Disclosure text
  is the consent text (DISCLOSURE_VERSION, Play declaration), so I did not change it. Needs a legal/design call
  on which wording ships, and a DISCLOSURE_VERSION bump if the text changes.
- C-2 S06 disclaimer line added from Figma ("... Not a medical device."), new key disclosure.disclaimer; the
  Settings disclaimer string has no "Not a medical device." Needs one shared wording.

## Batch C (S14, S43, About)

- D-1 (S14): Figma Home has no "Counting on" dot beside the summary line. The built Home still shows
  it. Kept; remove if the Designer drops it. The Dark frame 38:1873 was not read (token-based).
- D-2 (S14): the hero glow is a radial gradient (React Native has no blur); Figma is a 190 dp
  circle at 20% violet with blur 48. "of 60 reels today" is now "of 60 today" as in Figma.
- D-3 (S43): the built Settings has rows Figma does not: "Day starts at" (Counting group), the
  Version row (About group) and the disclaimer under Data. Kept.
- D-4 (S43): Figma "Counting" row has a chevron while On; there was no action. The row now opens
  Android Accessibility settings while On, and the disclosure when paused. Confirm the target.
- D-5 (S43): Figma badge-time sheet shows a check on all four options (mock). The build checks
  only the chosen one. Option labels are "1 second", "2 seconds", "3 seconds", "Always"; the row
  value keeps "1 s / 2 s / 3 s / Always". Sheet body and footer now use the Figma copy.
- D-6 (S43): list-row leading icons are Phosphor Regular (Figma) instead of Fill; "shield" is the
  plain Shield (was ShieldCheck); the Privacy row uses the external-link icon with a chevron.
- D-7 (About): Figma has an "Open-source licences" row with a chevron above the licence card. Not
  built: the card is already on the same page and there is no licences screen. Say if the row
  should scroll to the card or open its own screen. The licence text from Task 3 is unchanged;
  only the card title "Phosphor Icons 2.1.1 · MIT License" was added. The version moved from the
  header into a "This app" row; "Send feedback" was added (shared hook with Settings).

## Batch C addenda (2026-10-28)

- D-8 Ghost vs text: `Button` ghost has its Figma border again. Figma shows the S06 "Not now" /
  "Privacy details" and the Guide "Need help?" buttons borderless, so those three now use kind="text".
  Detection-debug was not changed (it keeps ghost with the border). Please confirm.
- D-9 C-1 resolved: built S06 consent text kept, no version bump. Designer updates Figma.
- D-10 A53 done as a layout-level slide (30 dp + fade, 300 ms, decelerate; reduced motion = instant).
  Stack animation is 'none', so the old screen disappears instantly and the new content slides in;
  the step header stays fixed. Back navigation uses the same direction (slides in from the right).
- D-11 Tab bar: Home and Settings only. Active icons are drawn with react-native-svg from the Figma
  layers (glyph + chimney / knob). Inactive stays Phosphor Regular via Icon. Limits, stats, alerts,
  friends and me icons (286:52/83/114/176/207) are not built (no such tabs in Phase 0).
  Part animations: chimney scaleY 0.02 -> 1 from the roof line, knob slides 3 dp in from the left
  with opacity 0 -> 1, 220 ms ease-out cubic. Pill A55: scaleX 0 -> 1 from the centre, 180 ms,
  Easing.out(cubic), no overshoot. The old icon bounce was removed (Figma has the part animation
  instead). Inactive icon/label colour is now textSecondary (Figma #4A4378), was textMuted.
  The 88 dp height is a minHeight; with a large nav inset (3-button nav) the bar grows by the inset.
  SVG scaleY/translateX on animated Path props are unverified on a real device.

## Batch D (S22 lock, S50 badge)

- D-12 S22: Inter Regular, Medium and SemiBold are bundled in the module assets (about 1 MB) for native lock text.
- D-13 S22: the dark chip dot uses token #FFC233; the Figma dark dot colour was not checked.
- D-14 S22: the dev-only JS preview src/screens/lock/LockView.tsx still has the old layout (no paused note).
- D-15 S22: added thumbwell_lock_note_title/body ("Video paused" / "Resume tomorrow or leave reels.");
  the fallback strip and window bounds were left as built (Figma only annotates the free top band).
- D-16 S50: the pill shadow is Android elevation 2 (an approximation of Figma 0/4/8, rgba(42,28,122,0.14)).
- D-17 S50: Figma has no mood colours on the badge; none were added.
- D-18 S50: spec cards 53:2239, 104:4681 and 127:6849 were read at metadata level only.
- D-19 S50: commit 918de53 carries "Refs: M3b" (the badge milestone) instead of M4; a commit-msg hook
  forbids amending, so this stays as is.
