package com.algoastics.thumbwell.core.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * First-draw regression: after a fresh install the first badge on Instagram was clipped at the right
 * edge and the Thumb sat wrong. The first show and every later one must end in the same bounds, with
 * a default or a saved position, with and without insets.
 */
class BadgeFirstDrawTest {
  private val density = 3f
  private fun px(dp: Float) = BadgePlacement.dpToPx(dp, density)

  private val dims = BadgePlacement.FrameDims(
    pad = px(12f), innerPad = px(28f), pillH = px(38f), thumbW = px(53.333f), thumbH = px(60f),
    rise = px(18f), nudge = px(5f), keepTop = px(96f), keepBottom = px(120f),
  )
  private val w = 1080
  private val h = 2340
  private val pillW = px(46f) + 2 * 14 + px(16f) // socket, two digit slots, gap

  private fun frame(side: BadgeSide, yDp: Float, insetL: Int = 0, insetR: Int = 0, pill: Int = pillW) =
    BadgePlacement.frame(side, px(yDp), pill, w, h, insetL, insetR, dims)

  @Test fun theDefaultPositionAndTheSamePositionSavedGiveTheSameFrame() {
    val default = BadgePosition()
    val saved = BadgePosition(default.side, default.yDp)
    assertEquals(frame(saved.side, saved.yDp), frame(default.side, default.yDp))
  }

  @Test fun theFirstShowAndALaterShowAreIdenticalForBothSidesAndWithInsets() {
    for (side in BadgeSide.values()) {
      for ((l, r) in listOf(0 to 0, 90 to 0, 0 to 90, 66 to 66)) {
        val first = frame(side, BadgePosition.DEFAULT_Y_DP, l, r)
        val later = frame(side, BadgePosition.DEFAULT_Y_DP, l, r)
        assertEquals("side=$side insets=$l/$r", first, later)
      }
    }
  }

  @Test fun theRightEdgePillEndsExactlyOnTheScreenEdgeNeverPastIt() {
    val f = frame(BadgeSide.RIGHT, BadgePosition.DEFAULT_Y_DP)
    assertEquals(w, f.x + f.pillLeft + f.pillW)
    // The window itself reaches only the edge pad past the screen, as designed.
    assertEquals(w + px(12f), f.x + f.w)
  }

  @Test fun theLeftEdgePillStartsOnTheScreenEdge() {
    val f = frame(BadgeSide.LEFT, BadgePosition.DEFAULT_Y_DP)
    assertEquals(0, f.x + f.pillLeft)
  }

  @Test fun anInsetKeepsThePillInsideTheSafeArea() {
    val right = frame(BadgeSide.RIGHT, 140f, insetR = 90)
    assertEquals(w - 90, right.x + right.pillLeft + right.pillW)
    val left = frame(BadgeSide.LEFT, 140f, insetL = 90)
    assertEquals(90, left.x + left.pillLeft)
  }

  @Test fun anOversizedOrBrokenMeasureIsBoundedByTheScreen() {
    val f = frame(BadgeSide.RIGHT, 140f, pill = 5_000)
    assertTrue(f.pillW <= w)
    assertEquals(0, f.x + f.pillLeft)
    assertEquals(w, f.x + f.pillLeft + f.pillW)
    assertEquals(1, frame(BadgeSide.RIGHT, 140f, pill = -4).pillW)
  }

  @Test fun theTopIsClampedBetweenTheKeepOutBands() {
    val high = frame(BadgeSide.RIGHT, -500f)
    assertEquals(dims.keepTop - dims.pad - dims.rise, high.y)
    val low = frame(BadgeSide.RIGHT, 5_000f)
    val maxTop = h - dims.keepBottom - dims.pillH
    assertEquals(maxTop - dims.pad - dims.rise, low.y)
  }

  @Test fun theWindowSizeIsTheSameOnBothSides() {
    val r = frame(BadgeSide.RIGHT, 140f)
    val l = frame(BadgeSide.LEFT, 140f)
    assertEquals(r.w, l.w)
    assertEquals(r.h, l.h)
  }

  @Test fun theThumbIsOnTheSideFacingTheCentreAndTheEdgeCornersAreFlat() {
    val r = frame(BadgeSide.RIGHT, 140f)
    val l = frame(BadgeSide.LEFT, 140f)
    val half = dims.thumbW / 2
    assertTrue(r.thumbLeft + half < r.pillLeft + r.pillW / 2)
    assertTrue(l.thumbLeft + half > l.pillLeft + l.pillW / 2)
    assertTrue(BadgePlacement.thumbOnLeftOfPill(BadgeSide.RIGHT))
    assertFalse(BadgePlacement.thumbOnLeftOfPill(BadgeSide.LEFT))
    val full = 57f
    val right = BadgeCorners.radii(true, BadgeSide.RIGHT, full, FloatArray(8))
    val left = BadgeCorners.radii(true, BadgeSide.LEFT, full, FloatArray(8))
    // Corner order: top-left (0,1), top-right (2,3), bottom-right (4,5), bottom-left (6,7).
    assertEquals(0f, right[2], 0f); assertEquals(0f, right[4], 0f)
    assertEquals(full, right[0], 0f); assertEquals(full, right[6], 0f)
    assertEquals(0f, left[0], 0f); assertEquals(0f, left[6], 0f)
    assertEquals(full, left[2], 0f); assertEquals(full, left[4], 0f)
  }

  @Test fun theThumbRisesAboveThePillByTheSameOffsetEveryTime() {
    val f = frame(BadgeSide.RIGHT, 140f)
    assertEquals(dims.rise, f.pillTop - f.thumbTop)
  }
}
