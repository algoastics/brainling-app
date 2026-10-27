package com.algoastics.thumbwell.core.lock

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LockEntryTest {
  private val tt = "com.zhiliaoapp.musically"

  @Test fun theFirstEventOfTheActiveAppIsAnEntryOnce() {
    val e = AppEntry()
    assertTrue(e.onEvent(tt, true))
    assertFalse(e.onEvent(tt, true))
    assertEquals(tt, e.current)
  }

  @Test fun anEventFromAWindowThatIsNotActiveIsNoEntry() {
    val e = AppEntry()
    assertFalse(e.onEvent(tt, false))
    assertNull(e.current)
  }

  @Test fun leavingMakesTheNextOpenAFreshEntry() {
    val e = AppEntry()
    e.onEvent(tt, true)
    e.left()
    assertNull(e.current)
    assertTrue(e.onEvent(tt, true))
  }

  @Test fun reelsFirstAppsAreCoveredOnEntry() {
    assertTrue(EarlyCover.coversOnEntry("tiktok"))
    assertFalse(EarlyCover.coversOnEntry("instagram"))
    assertFalse(EarlyCover.coversOnEntry("youtube"))
  }

  @Test fun aProvisionalCoverExpiresAfterTheGrace() {
    assertFalse(EarlyCover.expired(1_000, 1_000 + EarlyCover.GRACE_MS - 1))
    assertTrue(EarlyCover.expired(1_000, 1_000 + EarlyCover.GRACE_MS))
  }

  @Test fun anEntryWhileLockedIsNotDeferredButTheLiveLimitReelIs() {
    // Live limit reel: the lock turns on while the user is on the surface, so it waits for a swipe.
    val live = LockTrigger()
    live.onState(locked = true, onSurface = true)
    assertFalse(live.mayShow(true, true))
    assertTrue(live.onSwipe())
    // Re-entry while already locked: no surface yet, then the entry clears any wait.
    val reentry = LockTrigger()
    reentry.onState(locked = true, onSurface = false)
    reentry.onSurfaceEntered()
    assertTrue(reentry.mayShow(true, true))
  }
}
