package com.algoastics.thumbwell.core.lock

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LockWindowTest {
  private val w = 1080
  private val status = 72
  private val band = OverlayGuard.topBandPx(status, 3f)
  private val picked = Box(0, 80, w, 2052) // a reels container starting inside the strip

  // --- which window type ---

  @Test fun grantedOnApi26AndUpUsesTheApplicationOverlay() {
    assertEquals(LockWindowKind.APPLICATION_OVERLAY, LockWindowChoice.choose(true, 26))
    assertEquals(LockWindowKind.APPLICATION_OVERLAY, LockWindowChoice.choose(true, 36))
  }

  @Test fun notGrantedUsesTheAccessibilityOverlay() {
    assertEquals(LockWindowKind.ACCESSIBILITY_OVERLAY, LockWindowChoice.choose(false, 36))
    assertEquals(LockWindowKind.ACCESSIBILITY_OVERLAY, LockWindowChoice.choose(false, 26))
  }

  @Test fun belowApi26AlwaysUsesTheAccessibilityOverlay() {
    assertEquals(LockWindowKind.ACCESSIBILITY_OVERLAY, LockWindowChoice.choose(true, 25))
  }

  // --- the frame each type needs ---

  @Test fun theApplicationOverlayIsEdgeToEdgeFromTheTopOfTheScreenWithNoStrip() {
    val frame = LockWindowChoice.frame(LockWindowKind.APPLICATION_OVERLAY, picked, status, band)
    assertEquals(Box(0, 0, w, 2052), frame.window)
    assertEquals(0, frame.strip)
    assertEquals(frame.window, frame.cover)
  }

  @Test fun theApplicationOverlayStopsAtTheTabBarTop() {
    val frame = LockWindowChoice.frame(LockWindowKind.APPLICATION_OVERLAY, picked, status, band)
    assertEquals(picked.bottom, frame.window.bottom)
  }

  @Test fun theAccessibilityFallbackKeepsTheTouchAbsorbingStrip() {
    val frame = LockWindowChoice.frame(LockWindowKind.ACCESSIBILITY_OVERLAY, picked, status, band)
    assertEquals(Box(0, status, w, 2052), frame.window)
    assertEquals(band - status, frame.strip)
    assertEquals(band, frame.cover.top)
  }

  // --- the permission probe ---

  @Test fun theProbeReadsOnceWithinItsPeriod() {
    val probe = OverlayPermissionProbe(1000)
    var reads = 0
    val read = { reads++; true }
    assertTrue(probe.granted(0, read))
    assertTrue(probe.granted(999, read))
    assertEquals(1, reads)
    assertTrue(probe.granted(1000, read))
    assertEquals(2, reads)
  }

  @Test fun aRevokedPermissionIsSeenAtTheNextRead() {
    val probe = OverlayPermissionProbe(1000)
    var granted = true
    assertTrue(probe.granted(0) { granted })
    granted = false
    assertTrue(probe.granted(500) { granted }) // cached
    assertFalse(probe.granted(1500) { granted })
  }

  @Test fun aGrantIsSeenAtTheNextRead() {
    val probe = OverlayPermissionProbe(1000)
    var granted = false
    assertFalse(probe.granted(0) { granted })
    granted = true
    assertTrue(probe.granted(1000) { granted })
  }

  @Test fun aRefusedAddReadsAsNotGrantedForAWhileThenReadsAgain() {
    val probe = OverlayPermissionProbe(1000)
    assertTrue(probe.granted(0) { true })
    probe.denied(100)
    assertFalse(probe.granted(200) { true })
    assertFalse(probe.granted(100 + OverlayPermissionProbe.DENY_MS - 1) { true })
    assertTrue(probe.granted(100 + OverlayPermissionProbe.DENY_MS) { true })
  }

  @Test fun theChoiceFollowsTheProbeSoARefusedAddSwitchesToTheFallback() {
    val probe = OverlayPermissionProbe(1000)
    val kind = { LockWindowChoice.choose(probe.granted(0) { true }, 36) }
    assertEquals(LockWindowKind.APPLICATION_OVERLAY, kind())
    probe.denied(0)
    assertEquals(LockWindowKind.ACCESSIBILITY_OVERLAY, kind())
  }
}
