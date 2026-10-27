package com.algoastics.thumbwell.core.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BadgeLogicTest {
  private fun machine(
    time: BadgeDisplayTime = BadgeDisplayTime.TWO,
    hide: Boolean = false,
    reduced: Boolean = false,
  ) = BadgeMachine(BadgeSettings(true, time, hide)).also { it.reducedMotion = reduced }

  private fun shown(m: BadgeMachine, count: Int = 5): BadgeMachine = m.also { it.setVisible(true, count) }

  @Test fun displayTimeOptionsAndDefault() {
    assertEquals(listOf(1000L, 2000L, 3000L, null), BadgeDisplayTime.entries.map { it.ms })
    assertEquals(BadgeDisplayTime.TWO, BadgeSettings().displayTime)
    assertEquals(BadgeDisplayTime.THREE, BadgeDisplayTime.fromKey("3s"))
    assertEquals(BadgeDisplayTime.ALWAYS, BadgeDisplayTime.fromKey("always"))
    assertEquals(BadgeDisplayTime.TWO, BadgeDisplayTime.fromKey("bogus"))
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

  @Test fun restingThumbSitsHalfOffTheEdge() {
    assertEquals(-25, BadgePlacement.restingThumbX(BadgeSide.LEFT, 48, 50, 25))
    assertEquals(23, BadgePlacement.restingThumbX(BadgeSide.RIGHT, 48, 50, 25))
  }

  @Test fun blinkGapIsThreeToFiveSeconds() {
    assertEquals(3000L, BadgeTiming.nextBlinkMs(0))
    assertEquals(5000L, BadgeTiming.nextBlinkMs(2000))
    assertEquals(5000L, BadgeTiming.nextBlinkMs(99_999))
  }
}
