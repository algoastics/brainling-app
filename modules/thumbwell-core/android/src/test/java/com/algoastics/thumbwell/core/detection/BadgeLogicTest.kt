package com.algoastics.thumbwell.core.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BadgeLogicTest {
  private fun machine(
    time: BadgeDisplayTime = BadgeDisplayTime.TWO, // most tests are about the timed (resting) modes
    hide: Boolean = false,
    reduced: Boolean = false,
  ) = BadgeMachine(BadgeSettings(true, time, hide)).also { it.reducedMotion = reduced }

  private fun shown(m: BadgeMachine, count: Int = 5): BadgeMachine = m.also { it.setVisible(true, count) }

  @Test fun displayTimeOptionsAndDefault() {
    assertEquals(listOf(1000L, 2000L, 3000L, null), BadgeDisplayTime.entries.map { it.ms })
    assertEquals(BadgeDisplayTime.ALWAYS, BadgeSettings().displayTime)
    assertEquals(BadgeDisplayTime.ALWAYS, BadgeDisplayTime.DEFAULT)
    assertEquals(BadgeDisplayTime.THREE, BadgeDisplayTime.fromKey("3s"))
    assertEquals(BadgeDisplayTime.ALWAYS, BadgeDisplayTime.fromKey("always"))
    assertEquals(BadgeDisplayTime.ALWAYS, BadgeDisplayTime.fromKey("bogus"))
    assertEquals(BadgeDisplayTime.ALWAYS, BadgeDisplayTime.fromKey(null))
    assertTrue(BadgeSettings().enabled)
    assertFalse(BadgeSettings().hideWhenResting)
  }

  @Test fun appearsRestingThenWakesOnTheFirstCountedReel() {
    val m = machine()
    assertEquals(listOf(BadgeAction.Add(5), BadgeAction.FadeInResting), m.setVisible(true, 5))
    assertEquals(BadgeMachine.Mode.RESTING, m.mode)
    val actions = m.onCount(6)
    assertEquals(BadgeMachine.Mode.AWAKE, m.mode)
    assertEquals(
      listOf(
        BadgeAction.PopOut(flick = true, fromGone = false, reduced = false),
        BadgeAction.Roll(5, 6),
        BadgeAction.StartBob(null),
        BadgeAction.StartBlink,
        BadgeAction.ScheduleRest(2000L),
      ),
      actions,
    )
  }

  @Test fun secondConsecutiveReelOnlyRollsAndRestartsTheTimer() {
    val m = shown(machine())
    m.onCount(6)
    val actions = m.onCount(7)
    assertTrue(actions.none { it is BadgeAction.PopOut })
    assertTrue(BadgeAction.Roll(6, 7) in actions)
    assertTrue(BadgeAction.ScheduleRest(2000L) in actions)
  }

  @Test fun restTimerSettlesToAHalfOffEdgeThumb() {
    val m = shown(machine(BadgeDisplayTime.ONE))
    val wake = m.onCount(6)
    assertTrue(BadgeAction.ScheduleRest(1000L) in wake)
    assertEquals(listOf(BadgeAction.SettleToRest(false)), m.onRestDue())
    assertEquals(BadgeMachine.Mode.RESTING, m.mode)
    // After resting, the next reel plays the full pop-out and flick again.
    assertTrue(m.onCount(7).any { it is BadgeAction.PopOut && it.flick })
  }

  @Test fun hideWhenRestingFadesOutAndTheNextReelReAdds() {
    val m = machine(hide = true)
    // Hidden between counts: nothing is added on arrival.
    assertEquals(emptyList<BadgeAction>(), m.setVisible(true, 5))
    assertEquals(BadgeMachine.Mode.GONE, m.mode)
    val first = m.onCount(6)
    assertEquals(BadgeAction.Add(5), first[0])
    assertEquals(BadgeAction.PopOut(flick = true, fromGone = true, reduced = false), first[1])
    assertEquals(listOf(BadgeAction.FadeOutRemove), m.onRestDue())
    assertEquals(BadgeMachine.Mode.GONE, m.mode)
    assertEquals(BadgeAction.Add(6), m.onCount(7)[0])
  }

  @Test fun turningHideWhenRestingOnOrOffAppliesAtOnce() {
    val m = shown(machine())
    assertEquals(
      listOf(BadgeAction.FadeOutRemove),
      m.onSettings(BadgeSettings(true, BadgeDisplayTime.TWO, true)),
    )
    assertEquals(
      listOf(BadgeAction.Add(5), BadgeAction.FadeInResting),
      m.onSettings(BadgeSettings(true, BadgeDisplayTime.TWO, false)),
    )
  }

  @Test fun alwaysNeverRestsAndTheBobStopsAfterTenSeconds() {
    val m = shown(machine(BadgeDisplayTime.ALWAYS))
    val actions = m.onCount(6)
    assertTrue(BadgeAction.StartBob(10_000L) in actions)
    assertTrue(BadgeAction.CancelRest in actions)
    assertTrue(actions.none { it is BadgeAction.ScheduleRest })
    assertEquals(emptyList<BadgeAction>(), m.onRestDue())
    assertEquals(BadgeMachine.Mode.AWAKE, m.mode)
    // The next count restarts the bob for another 10 s.
    assertTrue(BadgeAction.StartBob(10_000L) in m.onCount(7))
  }

  @Test fun changingTheDisplayTimeWhileAwakeReschedules() {
    val m = shown(machine())
    m.onCount(6)
    assertEquals(
      listOf(BadgeAction.ScheduleRest(3000L), BadgeAction.StartBob(null)),
      m.onSettings(BadgeSettings(true, BadgeDisplayTime.THREE, false)),
    )
  }

  @Test fun reducedMotionSwapsInstantlyWithNoBobBlinkOrFlick() {
    val m = shown(machine(reduced = true))
    val actions = m.onCount(6)
    assertEquals(BadgeAction.PopOut(flick = false, fromGone = false, reduced = true), actions[0])
    assertEquals(BadgeAction.SetCount(6), actions[1])
    assertTrue(actions.none { it is BadgeAction.Roll || it is BadgeAction.StartBob || it === BadgeAction.StartBlink })
    assertEquals(listOf(BadgeAction.SettleToRest(true)), m.onRestDue())
    assertTrue(ReducedMotion.isReduced(0f, 1f))
    assertTrue(ReducedMotion.isReduced(1f, 0f))
    assertFalse(ReducedMotion.isReduced(1f, 1f))
  }

  @Test fun tapOpensThumbwellWhenAwakeAndWakesWhenResting() {
    val m = shown(machine())
    val (restingTap, wake) = m.onTap()
    assertEquals(BadgeTap.WOKE, restingTap)
    assertTrue(wake.any { it is BadgeAction.PopOut })
    assertTrue(wake.none { it is BadgeAction.Roll })
    assertTrue(wake.contains(BadgeAction.ScheduleRest(2000L)))
    assertEquals(BadgeTap.OPEN_APP, m.onTap().first)
  }

  @Test fun midnightResetSwapsWithoutRolling() {
    val m = shown(machine(), count = 40)
    m.onCount(41)
    assertEquals(listOf(BadgeAction.SetCount(0)), m.onCount(0))
    assertEquals(emptyList<BadgeAction>(), m.onCount(0))
  }

  @Test fun gateRemovesImmediatelyAndLeaveFadesAfterTheDelay() {
    val m = shown(machine())
    assertEquals(listOf(BadgeAction.CancelHide, BadgeAction.RemoveNow), m.setVisible(false, 5))
    assertEquals(BadgeMachine.Mode.GONE, m.mode)
    assertEquals(emptyList<BadgeAction>(), m.setVisible(false, 5))

    val n = shown(machine())
    assertEquals(listOf(BadgeAction.ScheduleHide(600L)), n.leave())
    // Coming back inside 600 ms cancels the fade.
    assertEquals(listOf(BadgeAction.CancelHide), n.setVisible(true, 5))
    n.leave()
    assertEquals(listOf(BadgeAction.CancelRest, BadgeAction.FadeOutRemove), n.onHideDue())
    assertEquals(BadgeMachine.Mode.GONE, n.mode)
  }

  @Test fun countsWhileHiddenAreTrackedWithoutShowingTheBadge() {
    val m = machine()
    assertEquals(emptyList<BadgeAction>(), m.onCount(3))
    assertEquals(listOf(BadgeAction.Add(3), BadgeAction.FadeInResting), m.setVisible(true, 3))
  }

  @Test fun gateNeedsEverythingRight() {
    assertTrue(BadgeGate.visible(true, true, true, false, false))
    assertFalse(BadgeGate.visible(false, true, true, false, false))
    assertFalse(BadgeGate.visible(true, false, true, false, false))
    assertFalse(BadgeGate.visible(true, true, false, false, false))
    assertFalse(BadgeGate.visible(true, true, true, true, false))
    assertFalse(BadgeGate.visible(true, true, true, false, true))
  }

  @Test fun gateHidesOverSettingsAccessibilityAndInstallerWindows() {
    assertTrue(BadgeGate.visible(true, true, true, false, false, safetyWindow = false))
    assertFalse(BadgeGate.visible(true, true, true, false, false, safetyWindow = true))
    listOf("com.android.settings", "com.samsung.accessibility", "com.google.android.packageinstaller")
      .forEach { pkg ->
        val safety = com.algoastics.thumbwell.core.detection.OverlaySafetyPackages.matches(pkg)
        assertFalse(BadgeGate.visible(true, true, true, false, false, safetyWindow = safety))
      }
  }

  // Figma: resting-right 57:977 (pill 84 wide, count at 17, Thumb peek frame at -25) and resting-left
  // 57:996 (count at 16, Thumb peek frame at 84). In both the Thumb is centred on the pill end that faces
  // the screen centre and only its outer half shows; rule 74:1952.
  private val pillW = 84f
  private val thumbW = 53.333f
  private fun awakeThumbLeft(side: BadgeSide) = BadgePlacement.thumbLeftInPill(side, pillW, thumbW, 5f)
  private fun figmaShift(side: BadgeSide) =
    BadgePlacement.restShift(side, pillW, 38f, thumbW, 60f, awakeThumbLeft(side), 18f, 46f, 16f)
  private fun restCentre(side: BadgeSide) = awakeThumbLeft(side) + figmaShift(side).thumbDx + thumbW / 2f

  @Test fun restingRightMovesTheThumbAboutMinusTwentyOneAndTheCountThirtyLeft() {
    val r = figmaShift(BadgeSide.RIGHT)
    assertEquals(-21.67f, r.thumbDx, 0.05f)
    assertEquals(-30f, r.countDx, 0.01f)
    // the Thumb centre lands on the pill's left end (the end facing the screen centre)
    assertEquals(0f, restCentre(BadgeSide.RIGHT), 0.01f)
  }

  @Test fun restingLeftMovesTheThumbAboutPlusTwentyOneAndTheCountStays() {
    val r = figmaShift(BadgeSide.LEFT)
    assertEquals(21.67f, r.thumbDx, 0.05f)
    assertEquals(0f, r.countDx, 0.01f)
    // the Thumb centre lands on the pill's right end (Figma 57:996: peek frame at x = 84)
    assertEquals(pillW, restCentre(BadgeSide.LEFT), 0.01f)
  }

  @Test fun restingMovesAreMirrorImagesForTheThumb() {
    assertEquals(-figmaShift(BadgeSide.RIGHT).thumbDx, figmaShift(BadgeSide.LEFT).thumbDx, 0.01f)
  }

  @Test fun theCountSitsAtSixteenOnThePillsLeftAtRestOnBothEdges() {
    // padding left: RIGHT 46 (+ the -30 rest move) and LEFT 16 (+ 0): Figma count x 17 and 16
    val right = BadgePlacement.pillPadding(BadgeSide.RIGHT, 46f, 16f).first + figmaShift(BadgeSide.RIGHT).countDx
    val left = BadgePlacement.pillPadding(BadgeSide.LEFT, 46f, 16f).first + figmaShift(BadgeSide.LEFT).countDx
    assertEquals(16f, right, 0.01f)
    assertEquals(16f, left, 0.01f)
  }

  @Test fun restingThumbIsCentredOnThePill() {
    // Figma rest Thumb centre y 19 vs awake 13: about +6 dp (centre of a 38 dp pill)
    assertEquals(6f, figmaShift(BadgeSide.RIGHT).thumbDy, 1.1f)
    assertEquals(figmaShift(BadgeSide.RIGHT).thumbDy, figmaShift(BadgeSide.LEFT).thumbDy, 0f)
  }

  @Test fun theClippedRestingThumbNeverCoversTheCount() {
    // RIGHT: visible Thumb is its left half, ending at the pill's left end (x 0); the count starts at 16.
    // LEFT: visible Thumb starts at the pill's right end (x 84); the count (about 22 wide) ends at 38.
    val rightEnd = awakeThumbLeft(BadgeSide.RIGHT) + figmaShift(BadgeSide.RIGHT).thumbDx +
      BadgePlacement.thumbClipRight(BadgeSide.RIGHT, thumbW, 1f)
    assertEquals(0f, rightEnd, 0.01f)
    assertTrue(rightEnd <= 16f)
    val leftStart = awakeThumbLeft(BadgeSide.LEFT) + figmaShift(BadgeSide.LEFT).thumbDx +
      BadgePlacement.thumbClipLeft(BadgeSide.LEFT, thumbW, 1f)
    assertEquals(pillW, leftStart, 0.01f)
    assertTrue(leftStart >= 16f + 22f)
  }

  @Test fun thumbFacesTheScreenCentre() {
    assertTrue(BadgePlacement.thumbOnLeftOfPill(BadgeSide.RIGHT))
    assertFalse(BadgePlacement.thumbOnLeftOfPill(BadgeSide.LEFT))
    // RIGHT: sticks out 5 dp past the pill's left end; LEFT: 5 dp past the right end
    assertEquals(-5f, BadgePlacement.thumbLeftInPill(BadgeSide.RIGHT, 84f, 53.333f, 5f), 0.001f)
    assertEquals(84f - 53.333f + 5f, BadgePlacement.thumbLeftInPill(BadgeSide.LEFT, 84f, 53.333f, 5f), 0.001f)
    assertEquals(84f + 5f, BadgePlacement.thumbLeftInPill(BadgeSide.LEFT, 84f, 53.333f, 5f) + 53.333f, 0.001f)
  }

  @Test fun pillPaddingPutsTheSocketOnTheThumbSide() {
    assertEquals(46f to 16f, BadgePlacement.pillPadding(BadgeSide.RIGHT, 46f, 16f))
    assertEquals(16f to 46f, BadgePlacement.pillPadding(BadgeSide.LEFT, 46f, 16f))
  }

  @Test fun windowPadsGiveTheCentreSideRoomAndKeepTheWidth() {
    assertEquals(28f to 12f, BadgePlacement.windowPads(BadgeSide.RIGHT, 12f, 28f))
    assertEquals(12f to 28f, BadgePlacement.windowPads(BadgeSide.LEFT, 12f, 28f))
    val r = BadgePlacement.windowPads(BadgeSide.RIGHT, 12f, 28f)
    val l = BadgePlacement.windowPads(BadgeSide.LEFT, 12f, 28f)
    assertEquals(r.first + r.second, l.first + l.second, 0f)
    // the resting Thumb (scale 0.93) sticks out half its width past the pill end: it fits the inner pad
    assertTrue(thumbW * 0.93f / 2f < 28f)
  }

  @Test fun restProgressFollowsTheSlideBothWays() {
    assertEquals(0f, BadgePlacement.restProgress(0f, -21.67f), 0f)
    assertEquals(0.5f, BadgePlacement.restProgress(-10.835f, -21.67f), 0.001f)
    assertEquals(1f, BadgePlacement.restProgress(-21.67f, -21.67f), 0f)
    assertEquals(0.5f, BadgePlacement.restProgress(10.835f, 21.67f), 0.001f)
    assertEquals(1f, BadgePlacement.restProgress(40f, 21.67f), 0f) // clamped
    assertEquals(0f, BadgePlacement.restProgress(-3f, 21.67f), 0f) // wrong direction clamps to awake
    assertEquals(0f, BadgePlacement.restProgress(5f, 0f), 0f) // no rest distance
  }

  @Test fun thumbClipKeepsTheOuterHalfAtRestAndNothingAwake() {
    // awake: full width on both sides
    assertEquals(0f, BadgePlacement.thumbClipLeft(BadgeSide.RIGHT, 50f, 0f), 0f)
    assertEquals(50f, BadgePlacement.thumbClipRight(BadgeSide.RIGHT, 50f, 0f), 0f)
    assertEquals(0f, BadgePlacement.thumbClipLeft(BadgeSide.LEFT, 50f, 0f), 0f)
    assertEquals(50f, BadgePlacement.thumbClipRight(BadgeSide.LEFT, 50f, 0f), 0f)
    // rest: RIGHT keeps the left half, LEFT keeps the right half
    assertEquals(0f, BadgePlacement.thumbClipLeft(BadgeSide.RIGHT, 50f, 1f), 0f)
    assertEquals(25f, BadgePlacement.thumbClipRight(BadgeSide.RIGHT, 50f, 1f), 0f)
    assertEquals(25f, BadgePlacement.thumbClipLeft(BadgeSide.LEFT, 50f, 1f), 0f)
    assertEquals(50f, BadgePlacement.thumbClipRight(BadgeSide.LEFT, 50f, 1f), 0f)
    // halfway and clamped
    assertEquals(37.5f, BadgePlacement.thumbClipRight(BadgeSide.RIGHT, 50f, 0.5f), 0.001f)
    assertEquals(12.5f, BadgePlacement.thumbClipLeft(BadgeSide.LEFT, 50f, 0.5f), 0.001f)
    assertEquals(25f, BadgePlacement.thumbClipRight(BadgeSide.RIGHT, 50f, 3f), 0f)
    assertEquals(50f, BadgePlacement.thumbClipRight(BadgeSide.RIGHT, 50f, -1f), 0f)
  }

  @Test fun restingPillIsOnByDefaultAtSeventyPercent() {
    assertTrue(BadgeRest.PILL_VISIBLE)
    // one 70% node for the Thumb and the pill together (Figma 57:977), not 40% for the Thumb
    assertEquals(0.7f, BadgeRest.NODE_ALPHA, 0f)
  }

  @Test fun theCountIsNotDroppedWhileResting() {
    // A reel counted while the Thumb sleeps wakes it with the new count; nothing is lost.
    val m = BadgeMachine(BadgeSettings(displayTime = BadgeDisplayTime.TWO))
    m.setVisible(true, 5)
    assertEquals(BadgeMachine.Mode.RESTING, m.mode)
    m.onCount(6)
    assertEquals(BadgeMachine.Mode.AWAKE, m.mode)
    assertEquals(6, m.shownCount)
    m.onRestDue()
    assertEquals(BadgeMachine.Mode.RESTING, m.mode)
    assertEquals(6, m.shownCount) // the resting pill shows the last count
    // A tap wakes it without a roll and without opening the app.
    val (tap, actions) = m.onTap()
    assertEquals(BadgeTap.WOKE, tap)
    assertTrue(actions.any { it is BadgeAction.PopOut })
    assertTrue(actions.none { it is BadgeAction.Roll })
  }

  @Test fun alwaysNeverRestsAndHideWhenRestingStillHidesEverythingForTimedModes() {
    val always = BadgeMachine(BadgeSettings(displayTime = BadgeDisplayTime.ALWAYS))
    always.setVisible(true, 1)
    always.onCount(2)
    assertTrue(always.onRestDue().isEmpty())
    assertEquals(BadgeMachine.Mode.AWAKE, always.mode)
    val hide = BadgeMachine(BadgeSettings(displayTime = BadgeDisplayTime.TWO, hideWhenResting = true))
    hide.setVisible(true, 1)
    hide.onCount(2)
    assertEquals(listOf(BadgeAction.FadeOutRemove), hide.onRestDue())
    assertEquals(BadgeMachine.Mode.GONE, hide.mode)
  }

  @Test fun odometerRollsOnlyChangedDigitsWithAStagger() {
    assertEquals(listOf(DigitRoll(0, '2', '3', 0L)), Odometer.plan(12, 13).filter { it.fromRight == 0 })
    // 12 -> 13: only the ones digit.
    assertEquals(1, Odometer.plan(12, 13).size)
    // 19 -> 20: both digits, tens starts 30 ms later.
    val carry = Odometer.plan(19, 20)
    assertEquals(listOf(0L, 30L), carry.map { it.delayMs })
    // 99 -> 100: a new place rolls in from below (old = null).
    val grow = Odometer.plan(99, 100)
    assertEquals(3, grow.size)
    assertEquals(null, grow.first { it.fromRight == 2 }.old)
    assertEquals(210L, Odometer.totalMs(grow))
    assertTrue(Odometer.grows(99, 100))
    assertFalse(Odometer.grows(12, 13))
  }

  @Test fun odometerFourDigitsTakeAtMost240msAndFormatTheThousands() {
    assertEquals("1,248", Odometer.format(1248))
    val plan = Odometer.plan(1247, 1248)
    assertEquals(1, plan.size)
    val all = Odometer.plan(1999, 2000)
    assertEquals(4, all.size)
    assertEquals(240L, Odometer.totalMs(all))
    // The comma never rolls and does not count as a place.
    assertTrue(Odometer.plan(999, 1000).none { it.new == ',' })
    assertEquals(0L, Odometer.totalMs(emptyList()))
  }

  @Test fun snapPicksTheNearestEdgeAndClampsY() {
    assertEquals(BadgeSide.LEFT, BadgePlacement.sideFor(100f, 1080))
    assertEquals(BadgeSide.RIGHT, BadgePlacement.sideFor(540f, 1080))
    assertEquals(0, BadgePlacement.snappedX(BadgeSide.LEFT, 200, 1080))
    assertEquals(880, BadgePlacement.snappedX(BadgeSide.RIGHT, 200, 1080))
    assertEquals(300, BadgePlacement.clampY(50, 100, 2000, 300, 400))
    assertEquals(1500, BadgePlacement.clampY(1900, 100, 2000, 300, 400))
    assertEquals(800, BadgePlacement.clampY(800, 100, 2000, 300, 400))
    assertEquals(300, BadgePlacement.clampY(10, 5000, 2000, 300, 400))
  }


  @Test fun blinkGapIsThreeToFiveSeconds() {
    assertEquals(3000L, BadgeTiming.nextBlinkMs(0))
    assertEquals(5000L, BadgeTiming.nextBlinkMs(2000))
    assertEquals(5000L, BadgeTiming.nextBlinkMs(99_999))
  }

  @Test fun alwaysAppearsAwakeWithTheCountAndNeverRests() {
    val m = machine(BadgeDisplayTime.ALWAYS)
    assertEquals(
      listOf(
        BadgeAction.Add(7),
        BadgeAction.PopOut(flick = true, fromGone = true, reduced = false),
        BadgeAction.StartBob(BadgeTiming.BOB_STOP_ALWAYS_MS),
        BadgeAction.StartBlink,
        BadgeAction.CancelRest,
      ),
      m.setVisible(true, 7),
    )
    assertEquals(BadgeMachine.Mode.AWAKE, m.mode)
    assertTrue(m.onRestDue().isEmpty())
    // A later consecutive reel only rolls the digits (no pop, no flick).
    val next = m.onCount(8)
    assertTrue(next.none { it is BadgeAction.PopOut })
    assertTrue(next.contains(BadgeAction.Roll(7, 8)))
    assertTrue(next.none { it is BadgeAction.ScheduleRest })
  }

  @Test fun alwaysPopsAgainOnReturnAfterTheBadgeWasRemoved() {
    val m = machine(BadgeDisplayTime.ALWAYS)
    m.setVisible(true, 3)
    m.setVisible(false, 3)
    assertEquals(BadgeMachine.Mode.GONE, m.mode)
    val back = m.setVisible(true, 3)
    assertTrue(back.any { it is BadgeAction.PopOut })
  }

  @Test fun alwaysIgnoresHideWhenResting() {
    val m = machine(BadgeDisplayTime.ALWAYS, hide = true)
    m.setVisible(true, 1)
    assertEquals(BadgeMachine.Mode.AWAKE, m.mode)
    assertTrue(m.onRestDue().isEmpty())
  }

  @Test fun switchingToAlwaysWakesARestingBadgeAndSwitchingAwayRestsIt() {
    val m = shown(machine(BadgeDisplayTime.TWO))
    assertEquals(BadgeMachine.Mode.RESTING, m.mode)
    val up = m.onSettings(BadgeSettings(true, BadgeDisplayTime.ALWAYS, false))
    assertEquals(BadgeMachine.Mode.AWAKE, m.mode)
    assertTrue(up.any { it is BadgeAction.PopOut })
    val down = m.onSettings(BadgeSettings(true, BadgeDisplayTime.THREE, false))
    assertTrue(down.contains(BadgeAction.ScheduleRest(3000L)))
  }

  // ---- foreground debounce: no hide while scrolling, one hide when it really leaves ----

  private val ig = "com.instagram.android"

  @Test fun aTransientNonTrackedWindowWhileScrollingDoesNotHide() {
    val f = BadgeForeground()
    assertEquals(BadgeForeground.Verdict.KEEP, f.check(ig, ig, 0))
    // system UI / a null root for one sample, then Instagram again: nothing hides
    assertEquals(BadgeForeground.Verdict.KEEP, f.check("com.android.systemui.x", ig, 500))
    assertEquals(BadgeForeground.Verdict.KEEP, f.check(null, ig, 800))
    assertEquals(BadgeForeground.Verdict.KEEP, f.check(ig, ig, 900))
    // the away timer restarted: another sample 399 ms into a new away spell still keeps it
    assertEquals(BadgeForeground.Verdict.KEEP, f.check("com.some.popup", ig, 1_000))
    assertEquals(BadgeForeground.Verdict.KEEP, f.check("com.some.popup", ig, 1_399))
  }

  @Test fun aSafetyPackageHidesAtOnce() {
    val f = BadgeForeground()
    assertEquals(BadgeForeground.Verdict.HIDE_NOW, f.check("com.android.settings", ig, 0))
    val g = BadgeForeground()
    assertEquals(BadgeForeground.Verdict.HIDE_NOW, g.check("com.google.android.packageinstaller", ig, 0))
  }

  @Test fun aRealLeaveHidesAfterTheDebounceExactlyOnce() {
    val f = BadgeForeground()
    val other = "com.some.popup" // unknown window: debounced
    assertEquals(BadgeForeground.Verdict.KEEP, f.check(other, ig, 1_000))
    assertEquals(BadgeForeground.Verdict.KEEP, f.check(other, ig, 1_399))
    assertEquals(BadgeForeground.Verdict.HIDE, f.check(other, ig, 1_400))
    val hides = (1..5).map { f.check(other, ig, 1_400L + it * 500) }
    assertTrue(hides.all { it == BadgeForeground.Verdict.ALREADY_HIDDEN })
    // shown again (reset): the next leave works again
    f.reset()
    assertEquals(BadgeForeground.Verdict.KEEP, f.check(ig, ig, 9_000))
    assertEquals(BadgeForeground.Verdict.KEEP, f.check("x", ig, 9_100))
    assertEquals(BadgeForeground.Verdict.HIDE, f.check("x", ig, 9_500))
  }

  @Test fun homeAndRecentsLeaveAtOnceWithoutTheDebounce() {
    // a launcher package (Home, and Recents on Pixel / Samsung / Xiaomi / ColorOS) at the first sample
    for (launcher in listOf("com.sec.android.app.launcher", "com.google.android.apps.nexuslauncher", "com.miui.home")) {
      assertEquals(BadgeForeground.Verdict.LEAVE_NOW, BadgeForeground().check(launcher, ig, 0))
    }
    // the device's own home app, resolved at run time
    assertEquals(
      BadgeForeground.Verdict.LEAVE_NOW,
      BadgeForeground().check("com.custom.home", ig, 0, homePackages = setOf("com.custom.home")),
    )
    // a Recents window by class name, even in com.android.systemui
    assertEquals(
      BadgeForeground.Verdict.LEAVE_NOW,
      BadgeForeground().check("com.android.systemui", ig, 0, className = "com.android.systemui.recents.RecentsActivity"),
    )
    // one hide per show
    val f = BadgeForeground()
    assertEquals(BadgeForeground.Verdict.LEAVE_NOW, f.check("com.miui.home", ig, 0))
    assertEquals(BadgeForeground.Verdict.ALREADY_HIDDEN, f.check("com.miui.home", ig, 150))
  }

  @Test fun systemUiAlonePassingInFrontIsStillDebounced() {
    val f = BadgeForeground()
    assertEquals(BadgeForeground.Verdict.KEEP, f.check("com.android.systemui", ig, 0))
    assertEquals(BadgeForeground.Verdict.KEEP, f.check("com.android.systemui", ig, 399))
    assertEquals(BadgeForeground.Verdict.HIDE, f.check("com.android.systemui", ig, 400))
  }

  @Test fun hidingIsOneActionForThePillAndTheThumb() {
    // The machine emits a single RemoveNow (the window holds both); no second hide action.
    val m = shown(machine(BadgeDisplayTime.ALWAYS))
    val out = m.setVisible(false, 5)
    assertEquals(1, out.count { it == BadgeAction.RemoveNow })
    assertTrue(out.none { it == BadgeAction.FadeOutRemove })
    assertTrue(m.setVisible(false, 5).isEmpty())
  }

  @Test fun theBadgeHidesWhenTheLockAppears() {
    assertEquals(BadgeLockSync.Step.HIDE_BADGE, BadgeLockSync.onLockChange(true, true, true))
    assertEquals(BadgeLockSync.Step.NONE, BadgeLockSync.onLockChange(true, false, true))
  }

  @Test fun theBadgeComesBackWhenTheLockGoesAndTheSurfaceIsStillUp() {
    assertEquals(BadgeLockSync.Step.RE_EVALUATE, BadgeLockSync.onLockChange(false, false, true))
  }

  @Test fun theBadgeStaysAwayWhenTheLockGoesAndTheSurfaceIsGone() {
    assertEquals(BadgeLockSync.Step.NONE, BadgeLockSync.onLockChange(false, false, false))
    assertEquals(BadgeLockSync.Step.NONE, BadgeLockSync.onLockChange(false, true, true))
  }
}
