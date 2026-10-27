package com.algoastics.thumbwell.core.detection

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertSame
import org.junit.Test

class BadgeCornersTest {
  private val full = 19f

  @Test fun rightEdgeDockedHasFlatRightCorners() {
    assertArrayEquals(
      floatArrayOf(full, full, 0f, 0f, 0f, 0f, full, full),
      BadgeCorners.radii(true, BadgeSide.RIGHT, full), 0f,
    )
  }

  @Test fun leftEdgeDockedHasFlatLeftCorners() {
    assertArrayEquals(
      floatArrayOf(0f, 0f, full, full, full, full, 0f, 0f),
      BadgeCorners.radii(true, BadgeSide.LEFT, full), 0f,
    )
  }

  @Test fun notDockedIsFullyRoundOnEitherSide() {
    val round = FloatArray(8) { full }
    assertArrayEquals(round, BadgeCorners.radii(false, BadgeSide.RIGHT, full), 0f)
    assertArrayEquals(round, BadgeCorners.radii(false, BadgeSide.LEFT, full), 0f)
  }

  @Test fun radiiFillsAndReturnsThePassedArray() {
    val out = FloatArray(8)
    assertSame(out, BadgeCorners.radii(true, BadgeSide.RIGHT, full, out))
    assertArrayEquals(floatArrayOf(full, full, 0f, 0f, 0f, 0f, full, full), out, 0f)
  }

  @Test fun lerpGoesFromRoundToFlat() {
    val from = BadgeCorners.radii(false, BadgeSide.RIGHT, full)
    val to = BadgeCorners.radii(true, BadgeSide.RIGHT, full)
    val out = FloatArray(8)
    assertArrayEquals(from, BadgeCorners.lerp(from, to, 0f, out), 0f)
    assertArrayEquals(
      floatArrayOf(full, full, 9.5f, 9.5f, 9.5f, 9.5f, full, full),
      BadgeCorners.lerp(from, to, 0.5f, out), 0.0001f,
    )
    assertArrayEquals(to, BadgeCorners.lerp(from, to, 1f, out), 0f)
  }

  @Test fun lerpClampsTheProgress() {
    val from = BadgeCorners.radii(false, BadgeSide.LEFT, full)
    val to = BadgeCorners.radii(true, BadgeSide.LEFT, full)
    val out = FloatArray(8)
    assertArrayEquals(from, BadgeCorners.lerp(from, to, -0.5f, out), 0f)
    assertArrayEquals(to, BadgeCorners.lerp(from, to, 1.5f, out), 0f)
  }

  @Test fun lerpReturnsThePassedArrayAndLeavesTheInputsAlone() {
    val from = BadgeCorners.radii(false, BadgeSide.RIGHT, full)
    val to = BadgeCorners.radii(true, BadgeSide.RIGHT, full)
    val out = FloatArray(8)
    assertSame(out, BadgeCorners.lerp(from, to, 0.3f, out))
    assertArrayEquals(BadgeCorners.radii(false, BadgeSide.RIGHT, full), from, 0f)
    assertArrayEquals(BadgeCorners.radii(true, BadgeSide.RIGHT, full), to, 0f)
  }
}
