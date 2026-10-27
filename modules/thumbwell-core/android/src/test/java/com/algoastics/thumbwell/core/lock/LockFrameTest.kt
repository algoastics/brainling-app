package com.algoastics.thumbwell.core.lock

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LockFrameTest {
  private val w = 1080
  private val status = 72
  private val d = 3f
  private val band = OverlayGuard.topBandPx(status, d)

  @Test fun theStripRunsFromTheStatusBarToTheCoverAndTheStatusBarIsLeftOut() {
    val frame = LockFrame.of(Box(0, band, w, 2052), status)
    assertEquals(Box(0, status, w, 2052), frame.window)
    assertEquals(band - status, frame.strip)
    assertEquals(Box(0, band, w, 2052), frame.cover)
  }

  @Test fun everyPointBetweenTheStatusBarAndTheCoverBottomIsInTheWindow() {
    val cover = OverlayGuard.leaveTopBand(Box(0, 0, w, 2205), band)
    val frame = LockFrame.of(cover, status)
    // No row of the app below the status bar and above the cover bottom is left to the reel.
    assertEquals(status, frame.window.top)
    assertEquals(cover.bottom, frame.window.bottom)
    assertEquals(0, frame.window.left)
    assertEquals(w, frame.window.width)
    assertEquals(frame.strip + frame.cover.height, frame.window.height)
  }

  @Test fun aCoverThatReachesTheTopHasNoStripAndKeepsItsBounds() {
    val full = Box(0, 0, w, 2205)
    val frame = LockFrame.of(full, status)
    assertEquals(full, frame.window)
    assertEquals(0, frame.strip)
  }

  @Test fun aCoverStartingInsideTheStatusBarHasNoStrip() {
    val frame = LockFrame.of(Box(0, 40, w, 2000), status)
    assertEquals(0, frame.strip)
    assertEquals(Box(0, 40, w, 2000), frame.window)
  }

  @Test fun aContainerStartingLowerGetsALongerAbsorbingStrip() {
    // A reel container below an app header: the header gap is absorbed too.
    val frame = LockFrame.of(Box(0, 500, w, 2000), status)
    assertEquals(500 - status, frame.strip)
    assertEquals(Box(0, 500, w, 2000), frame.cover)
  }

  @Test fun theWindowNeverGrowsBeyondTheCoverBottomOrSides() {
    val cover = Box(10, 600, 1070, 1900)
    val frame = LockFrame.of(cover, status)
    assertEquals(cover.left, frame.window.left)
    assertEquals(cover.right, frame.window.right)
    assertEquals(cover.bottom, frame.window.bottom)
    assertTrue(frame.window.top <= cover.top)
  }

  @Test fun anUnknownStatusBarHeightFallsBackToTheCoverTop() {
    val frame = LockFrame.of(Box(0, band, w, 2000), 0)
    assertEquals(0, frame.window.top)
    assertEquals(band, frame.strip)
  }
}
