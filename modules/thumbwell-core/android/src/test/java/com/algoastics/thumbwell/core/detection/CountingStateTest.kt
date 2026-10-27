package com.algoastics.thumbwell.core.detection

import com.algoastics.thumbwell.core.CountingStatus
import com.algoastics.thumbwell.core.FeatureFlags
import com.algoastics.thumbwell.core.PausedReason
import com.algoastics.thumbwell.core.health.ServiceState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Dwell data, ads, persisted seen state, day-start clearing and the Phase 0 flags. */
class CountingStateTest {
  private val tab = PlayerKey(1, 0x10)
  private val path = "12/ViewPager#clips_viewer_pager<FrameLayout#tab"

  private fun counted(s: ReelSession, key: PlayerKey, from: Long, isAd: () -> Boolean = { false }): ReelSession.Result {
    var now = from
    var last: ReelSession.Result? = null
    while (now <= from + 2_000) {
      last = s.evaluate(key, 100L, settling = false, nowMs = now, path = path, isAd = isAd)
      if (last.decision != ReelSession.Decision.SETTLING) return last
      now += 250
    }
    return last!!
  }

  @Test
  fun thresholdIsOneSecond() {
    assertEquals(1_000L, ReelSession.SETTLE_MS)
    val s = ReelSession()
    s.onIndex(0, 0)
    assertEquals(ReelSession.Decision.SETTLING, s.evaluate(tab, 100L, false, 0, path).decision)
    assertEquals(ReelSession.Decision.SETTLING, s.evaluate(tab, 100L, false, 999, path).decision)
    val r = s.evaluate(tab, 100L, false, 1_000, path)
    assertEquals(ReelSession.Decision.COUNTED, r.decision)
    assertEquals(1_000L, r.dwellMs)
    assertEquals(0L, r.startedAtMs)
    assertEquals("i0", r.reelKey)
  }

  @Test
  fun adsAreExcludedAndReportedOnce() {
    val s = ReelSession()
    s.onIndex(0, 0)
    val ad = counted(s, tab, 0) { true }
    assertEquals(ReelSession.Decision.SEEN, ad.decision)
    assertTrue(ad.isAd)
    assertEquals(1, s.adsSeen)
    assertFalse(s.evaluate(tab, 100L, false, 5_000, path).isAd)
  }

  @Test
  fun seenStateSurvivesProcessDeathWithoutRecounting() {
    val before = ReelSession()
    for (i in 0..2) {
      before.onIndex(i, i * 2_000L)
      assertEquals(ReelSession.Decision.COUNTED, counted(before, tab, i * 2_000L).decision)
    }
    val json = before.snapshot()
    assertNotNull(json)
    assertFalse("snapshot holds no text", json!!.contains("text"))

    // New process: new node and window ids, same structural path.
    val after = ReelSession()
    after.restore(json)
    val reborn = PlayerKey(7, 0x99)
    after.onIndex(1, 0)
    // Index 1 was already counted: swiping back to it does not count again.
    assertEquals(ReelSession.Decision.SEEN, counted(after, reborn, 0).decision)
    // The next, unseen reel counts once.
    after.onIndex(3, 4_000)
    assertEquals(ReelSession.Decision.COUNTED, counted(after, reborn, 4_000).decision)
  }

  @Test
  fun restoreIgnoresGarbage() {
    val s = ReelSession()
    s.restore("not json")
    s.restore("{\"v\":2}")
    assertNull(s.snapshot())
  }

  @Test
  fun dayStartClearsHistoryButNotTheReelOnScreen() {
    val s = ReelSession()
    s.onIndex(0, 0)
    assertEquals(ReelSession.Decision.COUNTED, counted(s, tab, 0).decision)
    s.onIndex(1, 3_000)
    assertEquals(ReelSession.Decision.COUNTED, counted(s, tab, 3_000).decision)
    s.clearHistory()
    // The reel on screen (1) is not counted twice; the next forward reel counts as usual.
    assertEquals(ReelSession.Decision.SEEN, s.evaluate(tab, 100L, false, 8_000, path).decision)
    s.onIndex(2, 9_000)
    assertEquals(ReelSession.Decision.COUNTED, counted(s, tab, 9_000).decision)
  }

  @Test
  fun phase0FlagsAreOff() {
    assertFalse(FeatureFlags.facebookEnabled)
    assertFalse(FeatureFlags.snapchatEnabled)
    assertTrue(FeatureFlags.countBadgeEnabled)
    assertFalse(FeatureFlags.allowsApp("facebook"))
    assertFalse(FeatureFlags.allowsApp("facebook_lite"))
    assertFalse(FeatureFlags.allowsApp("snapchat"))
    assertTrue(FeatureFlags.allowsApp("instagram"))
  }

  @Test
  fun pausedReasonOrder() {
    assertEquals(PausedReason.SERVICE_DISABLED, CountingStatus.pausedReason(ServiceState.DISABLED, false))
    assertEquals(PausedReason.SERVICE_NOT_RUNNING, CountingStatus.pausedReason(ServiceState.NOT_RUNNING, true))
    assertEquals(PausedReason.CONSENT_MISSING, CountingStatus.pausedReason(ServiceState.OK, false))
    assertNull(CountingStatus.pausedReason(ServiceState.OK, true))
  }
}
