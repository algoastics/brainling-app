package com.algoastics.brainling.core.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Replays device-observed sequences through the same session logic as the accessibility service
 * (player attach, settle, dedupe keys) without Android.
 */
class PlayerTrackerTest {
  /** Minimal model of BrainlingAccessibilityService's session handling. */
  private class Harness(continuingAtStart: Boolean = false, startIndex: Int? = null) {
    val players = PlayerTracker()
    val counter = ReelCounter(dwellMs = 800, dedupeSize = 50)
    var id = 1
    var maxId = 1
    var pageIndex: Int? = startIndex
    var continuing = continuingAtStart
    var counted = 0
    var lastIndex: Int? = null
    var lastPageId: Long? = null
    var indexSinceExit: Int? = null
    var now = 0L

    fun key(index: Int?) = "$id|${index ?: "start"}"

    /** One evaluation with [player] on screen showing page [page] (pager index [index]). */
    fun show(player: PlayerKey?, page: Long?, index: Int? = pageIndex) {
      if (index != null) indexSinceExit = index // the pager's scroll events precede evaluation
      val attach = players.attach(player, PlayerTracker.State(id, pageIndex, lastPageId), now, continuing, page)
      if (player != null) continuing = false
      when (attach.kind) {
        PlayerTracker.Kind.NEW -> { maxId = maxOf(maxId, id) + 1; id = maxId; pageIndex = null }
        PlayerTracker.Kind.RESTORED -> { maxId = maxOf(maxId, id); id = attach.state!!.sessionId; pageIndex = attach.state.pageIndex }
        else -> Unit
      }
      if (attach.kind != PlayerTracker.Kind.SAME) { lastIndex = pageIndex; lastPageId = page }
      if (!players.isSettled(now)) { counter.observe(null, now); return }
      val wasUnindexed = pageIndex == null
      pageIndex = index ?: pageIndex
      if (players.restoreRefuted(indexSinceExit, now)) {
        maxId = maxOf(maxId, id) + 1; id = maxId
        lastIndex = pageIndex; lastPageId = page
      }
      if (players.pagerReset(lastIndex, pageIndex, page, now)) {
        maxId = maxOf(maxId, id) + 1; id = maxId
        lastIndex = pageIndex; lastPageId = page
        counter.observe(null, now)
        return
      }
      lastIndex = pageIndex
      lastPageId = page ?: lastPageId
      val k = key(pageIndex)
      if (wasUnindexed && pageIndex != null && players.firstIndexIsStartReel(page) && key(null) in counter.recentKeys()) {
        counter.suppress(k)
      }
      if (counter.observe(k, now) != null) counted++
    }

    fun hide(inApp: Boolean) = exit(if (inApp) PlayerTracker.Exit.CLOSED else PlayerTracker.Exit.BACKGROUND)

    /** Another in-app screen (profile, sheet) covers the player. */
    fun cover() = exit(PlayerTracker.Exit.COVERED)

    fun exit(how: PlayerTracker.Exit) {
      players.detach(PlayerTracker.State(id, pageIndex, lastPageId), how)
      indexSinceExit = null
      counter.observe(null, now)
    }

    /** Stays on screen for [ms], evaluating every 250 ms. */
    fun dwell(player: PlayerKey?, page: Long?, index: Int? = pageIndex, ms: Long = 3_000) {
      val end = now + ms
      while (now < end) { show(player, page, index); now += 250 }
    }
  }

  private val igReelsTab = PlayerKey(windowId = 10, nodeId = 111)
  private val igGridPlayer = PlayerKey(windowId = 11, nodeId = 222)
  private val fbPlayerA = PlayerKey(windowId = 20, nodeId = 333)
  private val fbPlayerB = PlayerKey(windowId = 21, nodeId = 444)

  @Test
  fun instagramGridOpenCountsTheFirstReel() {
    // Browsed the Reels tab to index 5, then opened a reel from a profile grid within the gap.
    val h = Harness()
    h.dwell(igReelsTab, page = 1, index = 0)
    for (i in 1..5) h.dwell(igReelsTab, page = 1L + i, index = i)
    assertEquals(6, h.counted)
    h.hide(inApp = true)
    h.dwell(igGridPlayer, page = 900, index = null)
    assertEquals(7, h.counted)
    // The pager later reports its position for the same reel: no double count.
    h.dwell(igGridPlayer, page = 900, index = 0)
    assertEquals(7, h.counted)
    h.dwell(igGridPlayer, page = 901, index = 1)
    assertEquals(8, h.counted)
  }

  @Test
  fun instagramFeedVideoOpenedFullScreenCountsOnceSettled() {
    val h = Harness(continuingAtStart = true, startIndex = 3)
    h.dwell(igReelsTab, page = 1, index = 3) // adopted continuing session: reel 3 already counted
    h.counter.suppress(h.key(3))
    val before = h.counted
    h.now += 100
    h.show(igGridPlayer, page = 50, index = null)
    h.now += 500
    h.show(igGridPlayer, page = 50, index = null)
    assertEquals("not counted before the player settles", before, h.counted)
    h.dwell(igGridPlayer, page = 50, index = null)
    assertEquals(before + 1, h.counted)
  }

  @Test
  fun facebookReopenFromReelsRowCountsImmediately() {
    val h = Harness()
    h.dwell(fbPlayerA, page = 1, index = 0)
    for (i in 1..4) h.dwell(fbPlayerA, page = 1L + i, index = i)
    assertEquals(5, h.counted)
    h.hide(inApp = true)
    h.now += 3_000
    // New player whose pager restarts at 0: 0..3 used to hit the dedupe ring.
    h.dwell(fbPlayerB, page = 70, index = null)
    for (i in 1..3) h.dwell(fbPlayerB, page = 70L + i, index = i)
    assertEquals(9, h.counted)
  }

  @Test
  fun facebookReopenReusingTheSameNodeIsStillANewPlayer() {
    val h = Harness()
    for (i in 0..4) h.dwell(fbPlayerA, page = 1L + i, index = i)
    h.hide(inApp = true)
    h.dwell(fbPlayerA, page = 1, index = 0)
    h.dwell(fbPlayerA, page = 2, index = 1)
    assertEquals(7, h.counted)
  }

  @Test
  fun backgroundReturnToTheSamePlayerDoesNotRecount() {
    val h = Harness()
    for (i in 0..2) h.dwell(fbPlayerA, page = 1L + i, index = i)
    h.hide(inApp = false)
    h.now += 60_000
    h.dwell(fbPlayerA, page = 3, index = 2)
    assertEquals(3, h.counted)
  }

  @Test
  fun selectorFlappingBetweenPagersRestoresInsteadOfRecounting() {
    // TikTok-style nested pagers: if the selection briefly lands on an outer pager and back.
    val outer = PlayerKey(30, 1)
    val inner = PlayerKey(30, 2)
    val h = Harness()
    h.dwell(inner, page = 10, index = 4)
    h.dwell(outer, page = 99, index = null, ms = 250)
    h.dwell(inner, page = 10, index = 4)
    assertEquals(1, h.counted)
  }

  /** Device run of 9ca240f: feed player -> creator profile -> first reel of the profile grid. */
  private fun feedPlayerToProfileGrid(profile: Harness.() -> Unit, gridIndex: Int?, sameNode: Boolean) {
    val h = Harness()
    for (i in 0..2) h.dwell(igReelsTab, page = 1L + i, index = i)
    h.hide(inApp = true)
    h.dwell(igGridPlayer, page = 500, index = 0)
    h.dwell(igGridPlayer, page = 501, index = 1)
    h.hide(inApp = true)
    val feedPlayer = PlayerKey(12, 700)
    h.dwell(feedPlayer, page = 600, index = null)
    for (i in 1..6) h.dwell(feedPlayer, page = 600L + i, index = i)
    assertEquals(12, h.counted)
    h.profile()
    h.dwell(if (sameNode) feedPlayer else PlayerKey(12, 701), page = 800, index = gridIndex)
    assertEquals(13, h.counted)
    h.dwell(if (sameNode) feedPlayer else PlayerKey(12, 701), page = 801, index = gridIndex?.plus(1) ?: 1)
    assertEquals(14, h.counted)
  }

  @Test
  fun feedPlayerProfileGridReusingPagerWhileCovered() =
    // Profile covers the player without a window change (pager invisible), same node reused.
    feedPlayerToProfileGrid({ cover(); now += 2_000 }, gridIndex = 0, sameNode = true)

  @Test
  fun feedPlayerProfileGridWithNullRoot() =
    // Root unavailable during the transition, so the exit looked like a background.
    feedPlayerToProfileGrid({ hide(inApp = false) }, gridIndex = null, sameNode = true)

  @Test
  fun feedPlayerProfileGridPagerResetInPlace() =
    // Player never left the tree; its pager just got a new adapter starting at 0.
    feedPlayerToProfileGrid({ now += 2_000 }, gridIndex = 0, sameNode = true)

  @Test
  fun commentSheetOverPlayerDoesNotRecount() {
    val h = Harness()
    for (i in 0..3) h.dwell(fbPlayerA, page = 1L + i, index = i)
    h.cover() // pager covered by the sheet
    h.dwell(fbPlayerA, page = 4, index = 3)
    assertEquals(4, h.counted)
  }

  @Test
  fun swipingBackOnePageIsNotAReset() {
    val h = Harness()
    for (i in 0..3) h.dwell(fbPlayerA, page = 1L + i, index = i)
    h.dwell(fbPlayerA, page = 3, index = 2)
    h.dwell(fbPlayerA, page = 2, index = 1)
    assertEquals(4, h.counted)
  }

  /**
   * Device run of 6fcd018: Reels tab 3 reels, swipe back to reel 2, creator profile -> Reels grid
   * -> a reel. IG reuses the pager and a recycled page view, so the reel looked like the
   * remembered reel 2 (same node, same page view hash) and its index was already deduped.
   */
  private fun swipeBackThenOpen(backTo: Int, reels: Int, openedIndex: Int, reusedPage: Long?) {
    val h = Harness()
    for (i in 0 until reels) h.dwell(igReelsTab, page = 1L + i, index = i)
    assertEquals(reels, h.counted)
    for (i in reels - 2 downTo backTo) h.dwell(igReelsTab, page = 1L + i, index = i)
    assertEquals("swiping back never counts", reels, h.counted)
    h.cover() // profile, then its Reels tab, pushed over the player
    h.now += 3_000
    h.dwell(igReelsTab, page = reusedPage ?: (1L + backTo), index = openedIndex)
    assertEquals(reels + 1, h.counted)
    h.dwell(igReelsTab, page = 900, index = openedIndex + 1)
    assertEquals(reels + 2, h.counted)
  }

  @Test
  fun swipeBackOneThenProfileReelCounts() = swipeBackThenOpen(backTo = 1, reels = 3, openedIndex = 0, reusedPage = null)

  @Test
  fun swipeBackSeveralThenProfileReelCounts() = swipeBackThenOpen(backTo = 1, reels = 6, openedIndex = 0, reusedPage = null)

  @Test
  fun swipeBackThenProfileReelAtLaterIndexCounts() = swipeBackThenOpen(backTo = 1, reels = 3, openedIndex = 4, reusedPage = 2)

  @Test
  fun swipeBackThenFeedVideoPlayerCounts() {
    val h = Harness()
    for (i in 0..2) h.dwell(igReelsTab, page = 1L + i, index = i)
    h.dwell(igReelsTab, page = 2, index = 1)
    h.hide(inApp = true) // back to the feed
    h.dwell(igGridPlayer, page = 2, index = null) // feed video opens full screen
    assertEquals(4, h.counted)
  }

  @Test
  fun swipeBackThenBackgroundReturnDoesNotRecount() {
    val h = Harness()
    for (i in 0..2) h.dwell(igReelsTab, page = 1L + i, index = i)
    h.dwell(igReelsTab, page = 2, index = 1)
    h.hide(inApp = false)
    h.now += 60_000
    h.dwell(igReelsTab, page = 2, index = 1)
    assertEquals(3, h.counted)
  }

  @Test
  fun swipeBackThenCommentSheetDoesNotRecount() {
    val h = Harness()
    for (i in 0..2) h.dwell(igReelsTab, page = 1L + i, index = i)
    h.dwell(igReelsTab, page = 2, index = 1)
    h.cover()
    h.dwell(igReelsTab, page = 2, index = 1)
    assertEquals(3, h.counted)
  }

  @Test
  fun samePlayerIsNotReattached() {
    val t = PlayerTracker()
    assertEquals(PlayerTracker.Kind.NEW, t.attach(fbPlayerA, PlayerTracker.State(1, null), 0, false, null).kind)
    assertEquals(PlayerTracker.Kind.SAME, t.attach(fbPlayerA, PlayerTracker.State(2, 3), 10, false, null).kind)
    assertFalse(t.isSettled(999))
    assertTrue(t.isSettled(1_000))
  }
}
