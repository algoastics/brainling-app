package com.algoastics.brainling.core.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MascotMotionTest {
  @Test
  fun blinkDelayStaysInsideEachMoodsRange() {
    for (mood in MascotMood.values()) {
      val spec = MascotMotion.blink(mood)
      for (unit in listOf(-1.0, 0.0, 0.25, 0.5, 0.99, 1.0, 2.0)) {
        val delay = MascotMotion.nextBlinkDelayMs(mood, unit)
        assertTrue("$mood $unit -> $delay", delay in spec.minDelayMs..spec.maxDelayMs)
      }
      assertEquals(spec.minDelayMs, MascotMotion.nextBlinkDelayMs(mood, 0.0))
      assertEquals(spec.maxDelayMs, MascotMotion.nextBlinkDelayMs(mood, 1.0))
    }
  }

  @Test
  fun calmMoodsBlinkLikeAPerson() {
    for (mood in listOf(MascotMood.GLOWING, MascotMood.HAPPY)) {
      val spec = MascotMotion.blink(mood)
      assertTrue(spec.minDelayMs >= 2000 && spec.maxDelayMs <= 5000)
      assertTrue(spec.closeMs in 120..150)
    }
  }

  @Test
  fun tiredMoodsBlinkSlowerAndFriedBlinksFaster() {
    val happy = MascotMotion.blink(MascotMood.HAPPY)
    val fried = MascotMotion.blink(MascotMood.FRIED)
    val zombie = MascotMotion.blink(MascotMood.ZOMBIE)
    assertTrue(fried.maxDelayMs < happy.minDelayMs + 1000 && fried.minDelayMs < happy.minDelayMs)
    assertTrue(zombie.minDelayMs > happy.maxDelayMs)
    assertTrue(zombie.closeMs >= 300)
    assertTrue(MascotMotion.blink(MascotMood.MEH).closeMs > happy.closeMs)
  }

  @Test
  fun doubleBlinkFollowsChance() {
    assertTrue(MascotMotion.isDoubleBlink(MascotMood.FRIED, 0.0))
    assertFalse(MascotMotion.isDoubleBlink(MascotMood.FRIED, 0.99))
    assertFalse(MascotMotion.isDoubleBlink(MascotMood.ZOMBIE, 0.0))
  }
}
