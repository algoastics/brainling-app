package com.algoastics.thumbwell.core.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FrameCoalescerTest {
  @Test fun onlyTheFirstMoveOfAFrameSchedulesACallback() {
    val c = FrameCoalescer()
    assertTrue(c.submit(10, 20))
    assertFalse(c.submit(11, 21))
    assertFalse(c.submit(12, 22))
  }

  @Test fun theLatestPositionWins() {
    val c = FrameCoalescer()
    c.submit(10, 20)
    c.submit(11, 21)
    c.submit(12, 22)
    assertTrue(c.take())
    assertEquals(12, c.x)
    assertEquals(22, c.y)
  }

  @Test fun takeIsTrueOnceThenFalse() {
    val c = FrameCoalescer()
    c.submit(1, 2)
    assertTrue(c.take())
    assertFalse(c.take())
  }

  @Test fun takeWithoutASubmitIsFalse() {
    assertFalse(FrameCoalescer().take())
  }

  @Test fun aNewFrameSchedulesAgainAfterTake() {
    val c = FrameCoalescer()
    c.submit(1, 2)
    c.take()
    assertTrue(c.submit(3, 4))
    assertTrue(c.take())
    assertEquals(3, c.x)
    assertEquals(4, c.y)
  }

  @Test fun noWindowUpdateWhenThePositionDidNotChange() {
    val c = FrameCoalescer()
    c.submit(5, 6)
    assertTrue(c.take())
    c.submit(5, 6)
    assertFalse(c.take())
    // a different position is applied again
    c.submit(5, 7)
    assertTrue(c.take())
  }

  @Test fun cancelDropsAPendingFrameAndForgetsTheAppliedPosition() {
    val c = FrameCoalescer()
    c.submit(5, 6)
    c.cancel()
    assertFalse(c.take())
    assertTrue(c.submit(5, 6))
    assertTrue(c.take())
    c.cancel()
    // the same position is applied again after a cancel (the window was moved by something else)
    assertTrue(c.submit(5, 6))
    assertTrue(c.take())
  }
}
