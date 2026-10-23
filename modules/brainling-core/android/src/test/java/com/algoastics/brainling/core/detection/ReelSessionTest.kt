package com.algoastics.brainling.core.detection

import com.algoastics.brainling.core.detection.ReelSession.Exit
import org.junit.Assert.assertEquals
import org.junit.Test

/** Device-observed sequences replayed through the per-app counting state machine. */
class ReelSessionTest {
  private val s = ReelSession()
  private var now = 0L
  private var counted = 0

  /** Evaluates every 250 ms for [ms] (the service's polling while a reel is pending). */
  private fun stay(player: PlayerKey, sig: Long?, ms: Long = 1_500) {
    val end = now + ms
    while (now < end) {
      if (s.evaluate(player, sig, settling = false, nowMs = now, path = paths[player]).decision == ReelSession.Decision.COUNTED) counted++
      now += 250
    }
  }

  /** The pager reports [index] (scroll events), then the reel stays on screen. */
  private fun page(player: PlayerKey, index: Int, sig: Long? = 100L + index, ms: Long = 1_500) {
    s.onIndex(index, now)
    stay(player, sig, ms)
  }

  private fun away(how: Exit, ms: Long = 2_000) {
    s.exit(how)
    now += ms
  }

  private val reelsTab = PlayerKey(1, 0x10)
  private val paths = mutableMapOf(reelsTab to "12/ViewPager#clips_viewer_pager<FrameLayout#tab")
  private val other = PlayerKey(2, 0x20)

  @Test
  fun reelsThenBackThenProfileReelsReusingThePager() {
    for (i in 0..2) page(reelsTab, i)
    assertEquals(3, counted)
    page(reelsTab, 1) // swipe back to reel 2 in the same player
    assertEquals(3, counted)
    away(Exit.COVERED) // creator profile pushed over the player
    s.onIndex(0, now) // the reused pager gets the profile's reels, recycled page view
    stay(reelsTab, 101)
    assertEquals(4, counted)
    page(reelsTab, 1, sig = 101)
    page(reelsTab, 2, sig = 102)
    assertEquals(6, counted)
  }

  @Test
  fun reelsThenBackThenProfileReelsInANewPlayer() {
    for (i in 0..2) page(reelsTab, i)
    page(reelsTab, 1)
    away(Exit.CLOSED)
    for (i in 0..2) page(other, i, sig = 500L + i)
    assertEquals(6, counted)
  }

  @Test
  fun coveredReusedNodeIndexReportedAfterReturn() {
    for (i in 0..2) page(reelsTab, i)
    page(reelsTab, 1)
    away(Exit.COVERED)
    stay(reelsTab, 101, ms = 250) // same view hash, index not reported yet
    page(reelsTab, 0, sig = 101)
    assertEquals(4, counted)
  }

  /** Device run of df6350e: Reels 4, creator profile -> same reel (+1), back -> same reel. */
  @Test
  fun backToTheReelsTabRestoresItsSeenSet() {
    for (i in 0..3) page(reelsTab, i)
    page(reelsTab, 2) // back to reel 3
    assertEquals(4, counted)
    away(Exit.CLOSED) // the profile replaces the surface (logged exit=closed)
    stay(other, 777) // that reel opened from the profile: a new player
    assertEquals(5, counted)
    away(Exit.CLOSED) // back
    stay(reelsTab, 102) // same node, no index reported, same page view
    assertEquals(5, counted)
    page(reelsTab, 3) // swipe on: already seen in this player
    page(reelsTab, 4)
    assertEquals(6, counted)
  }

  @Test
  fun backToARebuiltReelsTabMatchesByWindowIndexAndPageView() {
    for (i in 0..3) page(reelsTab, i)
    away(Exit.CLOSED)
    stay(other, 777)
    away(Exit.CLOSED)
    val rebuilt = PlayerKey(reelsTab.windowId, 0x99)
    stay(rebuilt, 103)
    assertEquals(5, counted)
    page(rebuilt, 4)
    assertEquals(6, counted)
  }

  @Test
  fun reopenAfterCloseWithUnknownContentCounts() {
    stay(reelsTab, null)
    away(Exit.CLOSED)
    stay(reelsTab, null)
    assertEquals(2, counted)
  }

  /**
   * Device run of 2c753d6: Reels to 25 with profile visits in between, feed video, swipe, back,
   * Reels tab. Five other players opened meanwhile and evicted the Reels pager (log: e778 came
   * back with reason=open and swipes back counted).
   */
  @Test
  fun reelsTabSurvivesManyOtherPlayers() {
    // Reels 0..21 = 22 reels, with 3 profile visits (one reel each) returning to the same reel.
    var n = 0
    for (i in 0..21) {
      page(reelsTab, i)
      if (i % 7 == 6) {
        away(Exit.CLOSED); stay(PlayerKey(3, 0x100L + n++), 800L + n); away(Exit.CLOSED)
        stay(reelsTab, 100L + i) // back: same reel, no count
      }
    }
    assertEquals(25, counted)
    away(Exit.CLOSED) // Feed tab
    val feedVideo = PlayerKey(4, 0x400)
    stay(feedVideo, 1)
    assertEquals(26, counted)
    page(feedVideo, 1, sig = 2)
    assertEquals(27, counted)
    away(Exit.CLOSED) // back to the feed
    away(Exit.CLOSED)
    stay(reelsTab, 555) // Reels tab resumes on the same reel, recycled page view
    assertEquals(27, counted)
    for (i in 20 downTo 18) page(reelsTab, i)
    assertEquals(27, counted)
    for (i in 19..21) page(reelsTab, i)
    page(reelsTab, 22)
    assertEquals(28, counted)
  }

  @Test
  fun rebuiltReelsTabMatchesByStructureAndIndexRange() {
    for (i in 0..5) page(reelsTab, i)
    away(Exit.CLOSED); stay(PlayerKey(2, 1), 900); away(Exit.CLOSED)
    page(reelsTab, 5) // restored once: now a long-lived tab player
    away(Exit.CLOSED)
    val rebuilt = PlayerKey(reelsTab.windowId, 0x77)
    paths[rebuilt] = paths.getValue(reelsTab)
    s.onIndex(6, now)
    stay(rebuilt, 4242)
    assertEquals(8, counted) // 6 + profile reel + index 6 (new, continues the range)
    page(rebuilt, 3)
    assertEquals(8, counted)
  }

  @Test
  fun profilePlayerSharingTheTabPathStartsFresh() {
    for (i in 0..5) page(reelsTab, i)
    away(Exit.CLOSED)
    val profile = PlayerKey(reelsTab.windowId, 0x55)
    paths[profile] = paths.getValue(reelsTab)
    s.onIndex(30, now)
    stay(profile, 9)
    assertEquals(7, counted)
  }

  /**
   * Replays the 0815f8f device log (14:31-14:35 PKT). The profile pager c5b10d shares the Reels
   * pager's window and structure; it was matched by path, took over the Reels history, and its
   * pager reset wiped it, so back on the Reels tab 19, 18, 17 counted again.
   */
  @Test
  fun loggedReelsProfileFeedSequence() {
    val tab = PlayerKey(1668, 0xe7a1)
    val feed = PlayerKey(1697, 0xb7e4bd)
    val profile = PlayerKey(1668, 0xc5b10d)
    val path = "14/ViewPager#clips_viewer_view_pager<FrameLayout#"
    paths[tab] = path
    paths[profile] = path
    s.onIndex(18, now); stay(tab, 18)
    page(tab, 19, sig = 19); page(tab, 20, sig = 20)
    for (i in 19 downTo 15) page(tab, i, sig = i.toLong()) // swipes back never count
    for (i in 16..21) page(tab, i, sig = i.toLong())
    page(tab, 17, sig = 17); page(tab, 18, sig = 18)
    assertEquals(4, counted)
    away(Exit.CLOSED)
    s.onIndex(19, now); stay(feed, 1)
    for (i in 20..22) page(feed, i, sig = i.toLong())
    assertEquals(8, counted)
    away(Exit.CLOSED)
    stay(tab, 18); page(tab, 19, sig = 19); page(tab, 20, sig = 20)
    assertEquals(8, counted)
    away(Exit.CLOSED)
    stay(profile, 9_000) // the creator's profile reels, same window and structure
    for (i in 0..6) page(profile, i, sig = 9_000L + i)
    assertEquals(15, counted)
    away(Exit.CLOSED)
    stay(tab, 20) // back to the Reels tab
    for (i in 19 downTo 17) page(tab, i, sig = i.toLong())
    assertEquals(15, counted)
    page(tab, 21, sig = 21); page(tab, 22, sig = 22)
    assertEquals(16, counted)
  }

  @Test
  fun backwardSwipeNeverCountsEvenIfUnseen() {
    s.onIndex(10, now); stay(other, 10)
    page(other, 9, sig = 9); page(other, 8, sig = 8)
    s.onStep(-1, "swipe"); stay(other, 7)
    assertEquals(1, counted)
    page(other, 11, sig = 11)
    assertEquals(2, counted)
  }

  @Test
  fun feedVideoOpensFullScreenThenSwipes() {
    stay(other, 1)
    assertEquals(1, counted)
    for (i in 1..3) page(other, i)
    assertEquals(4, counted)
  }

  @Test
  fun feedPlayerThenProfileReel() {
    stay(other, 1)
    for (i in 1..6) page(other, i)
    assertEquals(7, counted)
    away(Exit.COVERED)
    s.onIndex(0, now)
    stay(other, 900)
    assertEquals(8, counted)
  }

  @Test
  fun facebookCloseAndReopenRepeatedly() {
    repeat(3) {
      stay(reelsTab, 1)
      for (k in 1..4) { s.onStep(1, "flip"); stay(reelsTab, 1L + k) }
      away(Exit.CLOSED)
    }
    assertEquals(15, counted)
  }

  @Test
  fun swipeBackInTheSamePlayerDoesNotCount() {
    for (i in 0..4) page(reelsTab, i)
    for (i in 3 downTo 0) page(reelsTab, i)
    page(reelsTab, 5)
    assertEquals(6, counted)
  }

  @Test
  fun noRecountForBackgroundCommentsScreenOffShade() {
    page(reelsTab, 0)
    page(reelsTab, 1)
    away(Exit.BACKGROUND, 60_000)
    stay(reelsTab, 101)
    away(Exit.COVERED) // comment / share sheet
    stay(reelsTab, 101)
    away(Exit.COVERED, 30_000) // screen off / shade: no active root
    stay(reelsTab, 101)
    assertEquals(2, counted)
  }

  @Test
  fun nestedPagerJumpDoesNotRecount() {
    page(reelsTab, 0)
    stay(other, 7, ms = 250) // selector briefly lands on the outer pager
    stay(reelsTab, 100)
    assertEquals(1, counted)
  }

  @Test
  fun firstIndexOfANewPlayerNamesTheReelAlreadyCounted() {
    stay(other, 42)
    page(other, 3, sig = 42)
    assertEquals(1, counted)
  }

  @Test
  fun loopsDoNotCountAndFastFlickCountsOnlySettledReels() {
    page(reelsTab, 0, ms = 10_000)
    for (i in 1..3) page(reelsTab, i, ms = 250)
    page(reelsTab, 4)
    assertEquals(2, counted)
  }

  @Test
  fun midSwipeNeverCounts() {
    repeat(10) { s.evaluate(reelsTab, null, settling = true, nowMs = now); now += 250 }
    assertEquals(0, counted)
  }

  @Test
  fun youtubeShortsFlips() {
    stay(reelsTab, 1)
    s.onStep(1, "flip"); stay(reelsTab, 2)
    s.onStep(1, "flip"); stay(reelsTab, 3)
    s.onStep(-1, "flip"); stay(reelsTab, 2) // back: seen
    s.onStep(1, "flip"); stay(reelsTab, 3)
    s.onStep(1, "flip"); stay(reelsTab, 4)
    assertEquals(4, counted)
  }

  @Test
  fun tiktokPagerIndicesWithTabJump() {
    for (i in 0..3) page(reelsTab, i)
    stay(other, 9, ms = 250)
    page(reelsTab, 3)
    page(reelsTab, 4)
    assertEquals(5, counted)
  }

  @Test
  fun pagerResetUnderTheSameNodeStartsFresh() {
    for (i in 0..4) page(reelsTab, i)
    page(reelsTab, 0, sig = 999) // new adapter: unseen reel view at index 0
    page(reelsTab, 1, sig = 998)
    assertEquals(7, counted)
  }
}
