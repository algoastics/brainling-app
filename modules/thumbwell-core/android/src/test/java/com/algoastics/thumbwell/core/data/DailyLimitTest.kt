package com.algoastics.thumbwell.core.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DailyLimitTest {
  private val today = "2026-10-27"
  private val tomorrow = "2026-10-28"

  @Test
  fun lowerAppliesAtOnce() {
    val s = DailyLimit.set(LimitState(60), 30, today, tomorrow)
    assertEquals(LimitState(30), s)
  }

  @Test
  fun raiseWaitsForTheNextDay() {
    val s = DailyLimit.set(LimitState(60), 100, today, tomorrow)
    assertEquals(60, s.effective)
    assertEquals(100, s.pending)
    assertEquals(tomorrow, s.pendingFromDay)
  }

  @Test
  fun pendingBecomesEffectiveOnItsDay() {
    val waiting = LimitState(60, 100, tomorrow)
    assertEquals(waiting, DailyLimit.resolve(waiting, today))
    assertEquals(LimitState(100), DailyLimit.resolve(waiting, tomorrow))
    assertEquals(LimitState(100), DailyLimit.resolve(waiting, "2026-11-02"))
  }

  @Test
  fun lowerThanPendingButAboveEffectiveUpdatesThePendingRaise() {
    val s = DailyLimit.set(LimitState(60, 100, tomorrow), 80, today, tomorrow)
    assertEquals(LimitState(60, 80, tomorrow), s)
  }

  @Test
  fun lowerThanEffectiveDropsThePendingRaise() {
    assertEquals(LimitState(30), DailyLimit.set(LimitState(60, 100, tomorrow), 30, today, tomorrow))
  }

  @Test
  fun backToTheCurrentLimitCancelsThePendingRaise() {
    assertEquals(LimitState(60), DailyLimit.set(LimitState(60, 100, tomorrow), 60, today, tomorrow))
  }

  @Test
  fun aSetAfterThePendingDayStartsFromThePromotedLimit() {
    val s = DailyLimit.set(LimitState(60, 100, tomorrow), 90, tomorrow, "2026-10-29")
    assertEquals(LimitState(90), s)
  }

  @Test
  fun zeroModeIsAllowedAndOutOfRangeIsNot() {
    assertEquals(0, DailyLimit.set(LimitState(60), 0, today, tomorrow).effective)
    assertTrue(DailyLimit.valid(1000))
    assertFalse(DailyLimit.valid(-1))
    assertFalse(DailyLimit.valid(1001))
    assertTrue(runCatching { DailyLimit.set(LimitState(60), -5, today, tomorrow) }.isFailure)
  }

  @Test
  fun theFirstChoiceAppliesAtOnceEvenWhenHigherThanTheDefault() {
    assertEquals(LimitState(100), DailyLimit.initial(100))
    assertTrue(runCatching { DailyLimit.initial(5000) }.isFailure)
  }

  @Test
  fun mapShape() {
    val m = LimitState(60, 100, tomorrow).toMap()
    assertEquals(60, m["effective"])
    assertEquals(100, m["pending"])
    assertEquals(tomorrow, m["pendingFromDay"])
    assertNull(LimitState(60).toMap()["pending"])
  }
}
