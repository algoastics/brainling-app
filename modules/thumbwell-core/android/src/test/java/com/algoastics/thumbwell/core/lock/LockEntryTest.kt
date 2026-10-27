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

  @Test fun aWindowStateEventWithNoActiveWindowYetIsAnEntry() {
    // Cold start (splash) and return from Recents: the new window is reported before the active
    // window query follows; waiting for it was the 1 to 2 s of sound.
    assertTrue(AppEntry.windowIsUp(null, tt, isWindowStateEvent = true))
    assertTrue(AppEntry.windowIsUp(tt, tt, isWindowStateEvent = false))
    assertTrue(AppEntry.windowIsUp(tt, tt, isWindowStateEvent = true))
  }

  @Test fun anotherAppInFrontOrAContentEventWithoutAWindowIsNotAnEntry() {
    assertFalse(AppEntry.windowIsUp("com.sec.android.app.launcher", tt, isWindowStateEvent = true))
    assertFalse(AppEntry.windowIsUp(null, tt, isWindowStateEvent = false))
  }

  @Test fun homeFallbackWaitsForTheDelayThenSendsOnce() {
    val h = HomeFallback()
    assertFalse(h.due(0, 5_000, false)) // no cover shown
    assertFalse(h.due(1_000, 1_000 + HomeFallback.DELAY_MS - 1, false))
    assertTrue(h.due(1_000, 1_000 + HomeFallback.DELAY_MS, false))
  }

  @Test fun homeFallbackIsSkippedWhileLeaveReelsRuns() {
    assertFalse(HomeFallback().due(1_000, 5_000, leaving = true))
  }

  @Test fun homeFallbackHasACooldownAndAMaxCountSoTheUserIsNeverTrapped() {
    val h = HomeFallback()
    var now = 10_000L
    h.record(now)
    // Inside the cooldown: no second HOME.
    assertFalse(h.due(now, now + HomeFallback.COOLDOWN_MS - 1, false))
    now += HomeFallback.COOLDOWN_MS
    assertTrue(h.due(now - 1_000, now, false))
    h.record(now)
    now += HomeFallback.COOLDOWN_MS
    assertTrue(h.due(now - 1_000, now, false))
    h.record(now)
    // Third sent: a fourth inside the window is refused, the lock just stays up.
    now += HomeFallback.COOLDOWN_MS
    assertFalse(h.due(now - 1_000, now, false))
    // After the window the fallback is available again.
    now += HomeFallback.WINDOW_MS
    assertTrue(h.due(now - 1_000, now, false))
  }

  @Test fun homeFallbackResetClearsTheHistory() {
    val h = HomeFallback()
    repeat(HomeFallback.MAX_COUNT) { h.record(1_000L + it) }
    assertFalse(h.due(900, 10_000, false))
    h.reset()
    assertTrue(h.due(900, 10_000, false))
  }
}
