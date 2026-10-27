package com.algoastics.thumbwell.core.data

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Calendar
import java.util.TimeZone

class ThumbwellDayTest {
  private val karachi = TimeZone.getTimeZone("Asia/Karachi")
  private val berlin = TimeZone.getTimeZone("Europe/Berlin")

  private fun at(zone: TimeZone, y: Int, m: Int, d: Int, h: Int, min: Int = 0): Long =
    Calendar.getInstance(zone).apply {
      clear()
      set(y, m - 1, d, h, min)
    }.timeInMillis

  @Test
  fun beforeFourBelongsToThePreviousDay() {
    assertEquals("2026-10-21", ThumbwellDay.key(at(karachi, 2026, 10, 22, 3, 59), karachi))
    assertEquals("2026-10-22", ThumbwellDay.key(at(karachi, 2026, 10, 22, 4, 0), karachi))
    assertEquals("2026-10-22", ThumbwellDay.key(at(karachi, 2026, 10, 22, 23, 59), karachi))
  }

  @Test
  fun dayCloseIsNextFourAm() {
    assertEquals(at(karachi, 2026, 10, 23, 4), ThumbwellDay.nextCloseMs(at(karachi, 2026, 10, 22, 4), karachi))
    assertEquals(at(karachi, 2026, 10, 22, 4), ThumbwellDay.nextCloseMs(at(karachi, 2026, 10, 22, 1), karachi))
  }

  @Test
  fun monthAndYearBoundaries() {
    assertEquals("2026-12-31", ThumbwellDay.key(at(karachi, 2027, 1, 1, 2), karachi))
    assertEquals("2026-02-28", ThumbwellDay.key(at(karachi, 2026, 3, 1, 3), karachi))
  }

  @Test
  fun dstShiftKeepsFourAmClose() {
    // Europe/Berlin leaves DST on 2026-10-25 at 03:00 local; the day still closes at 04:00.
    val evening = at(berlin, 2026, 10, 24, 22)
    assertEquals("2026-10-24", ThumbwellDay.key(evening, berlin))
    assertEquals(at(berlin, 2026, 10, 25, 4), ThumbwellDay.nextCloseMs(evening, berlin))
    assertEquals("2026-10-24", ThumbwellDay.key(at(berlin, 2026, 10, 25, 3, 30), berlin))
  }
}
