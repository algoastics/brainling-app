package com.algoastics.brainling.core.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ReelCounterTest {
  private val counter = ReelCounter(dwellMs = 800, dedupeSize = 3)

  @Test
  fun countsOnlyAfterDwell() {
    assertNull(counter.observe("a", 0))
    assertNull(counter.observe("a", 799))
    assertEquals("a", counter.observe("a", 800))
  }

  @Test
  fun skippingBeforeDwellDoesNotCount() {
    counter.observe("a", 0)
    assertNull(counter.observe("b", 500))
    assertNull(counter.observe("b", 1000))
    assertEquals("b", counter.observe("b", 1300))
  }

  @Test
  fun countsEachItemOnce() {
    counter.observe("a", 0)
    assertEquals("a", counter.observe("a", 900))
    assertNull(counter.observe("a", 2000))
    assertFalse(counter.hasPending())
  }

  @Test
  fun leavingTheSurfaceResetsTheDwell() {
    counter.observe("a", 0)
    counter.observe(null, 500)
    assertNull(counter.observe("a", 900))
    assertTrue(counter.hasPending())
    assertEquals("a", counter.observe("a", 1700))
  }

  @Test
  fun dedupeWindowIsBounded() {
    var t = 0L
    for (key in listOf("a", "b", "c", "d")) {
      counter.observe(key, t)
      t += 1000
      assertEquals(key, counter.observe(key, t))
    }
    counter.observe("a", t)
    assertEquals("a", counter.observe("a", t + 1000))
  }

  @Test
  fun suppressedDmItemNeverCounts() {
    counter.suppress("dm")
    counter.observe("dm", 0)
    assertNull(counter.observe("dm", 5000))
    assertFalse(counter.hasPending())
  }

  @Test
  fun restoredKeysAreTrimmedToTheWindow() {
    val restored = ReelCounter(dwellMs = 800, dedupeSize = 2, restoredKeys = listOf("a", "b", "c"))
    assertEquals(listOf("b", "c"), restored.recentKeys())
    restored.observe("a", 0)
    assertEquals("a", restored.observe("a", 800))
  }
}
