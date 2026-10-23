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
    var now = 0L

    fun key(index: Int?) = "$id|${index ?: "start"}"

    /** One evaluation with [player] on screen showing page [page] (pager index [index]). */
    fun show(player: PlayerKey?, page: Long?, index: Int? = pageIndex) {
      val attach = players.attach(player, PlayerTracker.State(id, pageIndex), now, continuing, page)
      if (player != null) continuing = false
      when (attach.kind) {
        PlayerTracker.Kind.NEW -> { maxId = maxOf(maxId, id) + 1; id = maxId; pageIndex = null }
        PlayerTracker.Kind.RESTORED -> { maxId = maxOf(maxId, id); id = attach.state!!.sessionId; pageIndex = attach.state.pageIndex }
        else -> Unit
      }
      if (!players.isSettled(now)) { counter.observe(null, now); return }
      val wasUnindexed = pageIndex == null
      pageIndex = index ?: pageIndex
      val k = key(pageIndex)
      if (wasUnindexed && pageIndex != null && players.firstIndexIsStartReel(page) && key(null) in counter.recentKeys()) {
        counter.suppress(k)
      }
      if (counter.observe(k, now) != null) counted++
    }

    fun hide(inApp: Boolean) {
      players.detach(PlayerTracker.State(id, pageIndex), closedInApp = inApp)
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

  @Test
  fun samePlayerIsNotReattached() {
    val t = PlayerTracker()
    assertEquals(PlayerTracker.Kind.NEW, t.attach(fbPlayerA, PlayerTracker.State(1, null), 0, false, null).kind)
    assertEquals(PlayerTracker.Kind.SAME, t.attach(fbPlayerA, PlayerTracker.State(2, 3), 10, false, null).kind)
    assertFalse(t.isSettled(999))
    assertTrue(t.isSettled(1_000))
  }
}
