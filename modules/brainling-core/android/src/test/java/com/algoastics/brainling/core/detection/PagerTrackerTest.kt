package com.algoastics.brainling.core.detection

import com.algoastics.brainling.core.rules.AppRule
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Event sequences shaped like the captured pagers, replayed through the same steps the service
 * runs: pager scroll -> PagerTracker -> page index -> ReelSession (settle 800 ms).
 */
class PagerTrackerTest {
  /** Mirrors BrainlingAccessibilityService: scroll handling plus throttled evaluations. */
  private class Feed(private val surfaceHeight: Int) {
    val tracker = PagerTracker()
    val reels = ReelSession(settleMs = 800)
    val player = PlayerKey(1, 1)
    val pageIndex: Int? get() = reels.index
    var counted = 0

    fun scroll(now: Long, from: Int, to: Int = from, deltaY: Int = 0) {
      tracker.onScroll(PagerScroll(from, to, 0, -1, deltaY), surfaceHeight, now)?.let { reels.onIndex(it, now) }
    }

    fun evaluate(now: Long) {
      val settling = tracker.isSettling(now)
      if (!settling) tracker.settle(pageIndex, surfaceHeight, now)?.let { reels.onStep(it - (pageIndex ?: 0), "swipe") }
      if (reels.evaluate(player, null, settling, now).decision == ReelSession.Decision.COUNTED) counted++
    }

    fun evaluateEvery(from: Long, to: Long, step: Long = 250) {
      var t = from
      while (t <= to) {
        evaluate(t)
        t += step
      }
    }
  }

  private val youtubeHeight = 1990 // reel_player_page_container [0,80][1080,2070]
  private val tiktokHeight = 1987 // player_view [0,80][1080,2067]

  @Test
  fun youtubeRecyclerCountsEverySettledShort() {
    val feed = Feed(youtubeHeight)
    feed.scroll(0, from = 0)
    feed.evaluateEvery(300, 1500)
    for (i in 1..4) {
      val t = i * 5_000L
      feed.scroll(t, from = i - 1, to = i) // two pages visible mid-swipe: no index
      feed.scroll(t + 100, from = i - 1, to = i)
      feed.scroll(t + 200, from = i) // settled on the next adapter position
      feed.evaluateEvery(t + 450, t + 4_000)
    }
    assertEquals(5, feed.counted)
    assertEquals(IndexSource.PAGER, feed.tracker.source)
  }

  @Test
  fun tiktokViewPagerCountsEverySettledReel() {
    val feed = Feed(tiktokHeight)
    feed.scroll(0, from = 0)
    feed.evaluateEvery(300, 1500)
    for (i in 1..3) {
      val t = i * 4_000L
      feed.scroll(t, from = i - 1) // dragging: ViewPager still reports the old item
      feed.scroll(t + 100, from = i) // released: onPageSelected moved mCurItem
      feed.scroll(t + 200, from = i)
      feed.evaluateEvery(t + 450, t + 3_000)
    }
    assertEquals(4, feed.counted)
  }

  @Test
  fun fastSwipesOnlyCountReelsThatReachTheDwell() {
    val feed = Feed(tiktokHeight)
    feed.scroll(0, from = 0)
    // Flick through 1..5 every 400 ms: none stays 800 ms.
    for (i in 1..5) {
      val t = i * 400L
      feed.scroll(t, from = i)
      feed.evaluate(t + 100) // still settling: ignored
      feed.evaluate(t + 250)
    }
    assertEquals(0, feed.counted)
    feed.evaluateEvery(2_250, 4_000)
    assertEquals(1, feed.counted)
  }

  @Test
  fun autoplayLoopOfTheSameReelCountsOnce() {
    val feed = Feed(youtubeHeight)
    feed.scroll(0, from = 7)
    // A 15 s short looping for a minute: only content changes, the pager never scrolls.
    feed.evaluateEvery(300, 60_000)
    assertEquals(1, feed.counted)
    assertEquals(7, feed.pageIndex)
  }

  @Test
  fun midSwipeEvaluationsAreSkipped() {
    val tracker = PagerTracker()
    tracker.onScroll(PagerScroll(3, 4, 0, -1, 0), youtubeHeight, 1_000)
    assertTrue(tracker.isSettling(1_100))
    assertFalse(tracker.isSettling(1_000 + PagerTracker.SETTLE_MS))
  }

  @Test
  fun indexlessPagerAdvancesOncePerSettledSwipe() {
    val feed = Feed(tiktokHeight)
    feed.evaluateEvery(0, 1_500)
    assertEquals(1, feed.counted)
    for (i in 1..3) {
      val t = i * 4_000L
      feed.scroll(t, from = -1, deltaY = 900)
      feed.scroll(t + 100, from = -1, deltaY = 1087)
      feed.evaluateEvery(t + 400, t + 3_000)
    }
    assertEquals(4, feed.counted)
    assertEquals(3, feed.pageIndex)
    assertEquals(IndexSource.SWIPE, feed.tracker.source)
  }

  @Test
  fun dragThatSnapsBackIsNotASwipe() {
    val feed = Feed(tiktokHeight)
    feed.evaluateEvery(0, 1_500)
    feed.scroll(2_000, from = -1, deltaY = 400)
    feed.scroll(2_100, from = -1, deltaY = -400)
    feed.evaluateEvery(2_400, 5_000)
    assertEquals(1, feed.counted)
    assertNull(feed.pageIndex)
  }

  @Test
  fun swipingBackDoesNotRecountTheEarlierReel() {
    val feed = Feed(tiktokHeight)
    feed.evaluateEvery(0, 1_500)
    feed.scroll(2_000, from = -1, deltaY = 1987) // -> 1
    feed.evaluateEvery(2_400, 4_000)
    feed.scroll(5_000, from = -1, deltaY = 1987) // -> 2
    feed.evaluateEvery(5_400, 7_000)
    feed.scroll(8_000, from = -1, deltaY = -1987) // back to 1, already counted
    feed.evaluateEvery(8_400, 11_000)
    assertEquals(3, feed.counted)
    assertEquals(1, feed.pageIndex)
  }

  @Test
  fun pagerPositionsAreNeverMixedWithSyntheticSwipes() {
    val tracker = PagerTracker()
    assertEquals(2, tracker.onScroll(PagerScroll(2, 2, 0, -1, 0), youtubeHeight, 0))
    assertNull(tracker.onScroll(PagerScroll(2, 3, 0, -1, 1990), youtubeHeight, 1_000))
    assertNull(tracker.settle(2, youtubeHeight, 2_000))
  }

  @Test
  fun matchingFallsBackToSurfaceIdsWithoutPagerIds() {
    val instagram = AppRule(
      key = "instagram", packageNames = listOf("com.instagram.android"), enabled = true,
      surfaceIds = listOf("clips_viewer_view_pager"), contentDescriptions = emptyList(),
      structure = null, dmSignatureIds = emptyList(),
    )
    assertTrue(PagerMatch.matches(instagram, "com.instagram.android:id/clips_viewer_view_pager", null, null))
    assertFalse(PagerMatch.matches(instagram, "com.instagram.android:id/other", null, null))
    val facebook = instagram.copy(surfaceIds = emptyList())
    assertTrue(PagerMatch.matches(facebook, null, null, null))
    val tiktok = instagram.copy(
      surfaceIds = listOf("player_view"),
      pagerIds = listOf("viewpager"),
      pagerClassNames = listOf("androidx.viewpager.widget.ViewPager"),
    )
    assertTrue(PagerMatch.matches(tiktok, "p:id/viewpager", "androidx.viewpager.widget.ViewPager", "X.05rH"))
    assertTrue(PagerMatch.matches(tiktok, "p:id/viewpager", null, "androidx.viewpager.widget.ViewPager"))
    assertFalse(PagerMatch.matches(tiktok, "p:id/viewpager", "X.05rH", "X.05rH"))
    assertFalse(PagerMatch.matches(tiktok, "p:id/player_view", "androidx.viewpager.widget.ViewPager", null))
  }

  @Test
  fun pageIndexPrefersTheSettledAdapterPosition() {
    assertEquals(4, PagerMatch.pageIndex(PagerScroll(4, 4, 0, -1, 0), 1990))
    assertEquals(4, PagerMatch.pageIndex(PagerScroll(4, -1, 0, -1, 0), 1990))
    assertNull(PagerMatch.pageIndex(PagerScroll(4, 5, 0, -1, 0), 1990))
    assertEquals(2, PagerMatch.pageIndex(PagerScroll(-1, -1, 3980, 10_000, 0), 1990))
  }
}
