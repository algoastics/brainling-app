package com.algoastics.thumbwell.core.detection

import com.algoastics.thumbwell.core.rules.RuleSet
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** TikTok nests two obfuscated full-screen tab pagers around the feed pager, all id "viewpager". */
class NestedPagerTest {
  private val rules = RuleSet.parse(File("../rules/rules.json").readText())
  private val tiktok = requireNotNull(rules.ruleFor("com.zhiliaoapp.musically"))
  private val youtube = requireNotNull(rules.ruleFor("com.google.android.youtube"))
  private val layout = LayoutFixture.load("tiktok_nested_pagers.txt")

  private fun candidates(l: LayoutFixture, id: String) = l.withBareId(id).map {
    it to PagerCandidate(it.depth, it.className, it.visible, it.bounds.width, it.bounds.height)
  }

  @Test
  fun selectsInnermostFeedPager() {
    val c = candidates(layout, "viewpager")
    assertEquals(3, c.size)
    val chosen = c[PagerMatch.selectPager(tiktok, c.map { it.second })!!].first
    assertEquals("androidx.viewpager.widget.ViewPager", chosen.className)
    assertEquals(LayoutFixture.Bounds(0, 0, 1080, 2067), chosen.bounds)
  }

  @Test
  fun deepestWinsWithoutClassFilter() {
    val noFilter = tiktok.copy(pagerClassNames = emptyList())
    val c = candidates(layout, "viewpager")
    assertEquals(2067, c[PagerMatch.selectPager(noFilter, c.map { it.second })!!].first.bounds.bottom)
    // Obfuscated classes only: still the deepest.
    val obf = c.map { it.second.copy(className = "X.05rH") }
    assertEquals(2, PagerMatch.selectPager(noFilter, obf))
    // Class filter with no match: no pager rather than an outer one.
    assertEquals(null, PagerMatch.selectPager(tiktok, obf))
  }

  @Test
  fun outerPagerEventsAreDroppedNotCounted() {
    val id = "com.zhiliaoapp.musically:id/viewpager"
    assertFalse(PagerMatch.matches(tiktok, id, "X.05rH", "X.05rH"))
    assertTrue(PagerMatch.isOtherPager(tiktok, id, "X.05rH", "X.05rH"))
    assertTrue(PagerMatch.matches(tiktok, id, "androidx.viewpager.widget.ViewPager", null))
    assertFalse(PagerMatch.isOtherPager(tiktok, id, "androidx.viewpager.widget.ViewPager", null))
    // Event without a source node: the class alone identifies the feed pager.
    assertTrue(PagerMatch.matches(tiktok, null, "androidx.viewpager.widget.ViewPager", null))
    assertFalse(PagerMatch.matches(tiktok, null, "X.05rH", null))
  }

  @Test
  fun youtubeRecyclerIsSelected() {
    for (name in listOf("youtube_before.txt", "youtube_after.txt")) {
      val l = LayoutFixture.load(name)
      val c = candidates(l, "reel_recycler")
      assertEquals("reel_recycler", c[PagerMatch.selectPager(youtube, c.map { it.second })!!].first.bareId)
    }
  }

  @Test
  fun pageFlipsAdvanceOncePerSwipe() {
    val f = PageFlipDetector()
    assertEquals(0, f.observe(1, false)) // first page seen
    assertEquals(0, f.observe(1, false)) // autoplay loop: same view
    assertEquals(1, f.observe(2, false)) // swipe, no pager event (YouTube)
    assertEquals(1, f.observe(3, false))
    assertEquals(-1, f.observe(2, false)) // swipe back
    assertEquals(0, f.observe(null, false)) // mid swipe
    assertEquals(0, f.observe(3, true)) // pager already reported the index
    f.reset()
    assertEquals(0, f.observe(9, false))
  }

  @Test
  fun flipNeverOverridesPagerSource() {
    val t = PagerTracker()
    t.onScroll(PagerScroll(4, 4, 0, 0, 0), 2067, 0)
    t.markFlip()
    assertEquals(IndexSource.PAGER, t.source)
    val u = PagerTracker()
    u.markFlip()
    assertEquals(IndexSource.FLIP, u.source)
  }

  /** TikTok (10-23 22:31 PKT log): a settled swipe stepped, then its page view flipped later. */
  @Test
  fun flipAfterSettledSwipeIsTheSameSwipe() {
    val f = PageFlipDetector()
    assertEquals(0, f.observe(1, false, 0))
    assertEquals(1, f.stepped(1_000, 1))
    assertEquals(0, f.observe(2, false, 1_400)) // the swipe's own page view
    assertEquals(1, f.observe(3, false, 4_000)) // a later flip alone still counts
    assertEquals(-1, f.observe(2, false, 8_000)) // window expired: a plain swipe back
  }

  /** TikTok (10-23 23:09 PKT log): the page view flipped before the scroll settled. */
  @Test
  fun settledSwipeAfterFlipIsTheSameSwipe() {
    val f = PageFlipDetector()
    f.observe(1, false, 0)
    assertEquals(1, f.observe(2, false, 1_000))
    assertEquals(0, f.stepped(1_300, 1))
    assertEquals(1, f.stepped(5_000, 1)) // a later swipe alone still counts
  }

  /** YouTube (10-23 PKT log): a stray backward settle, then the real forward flip, nets +1. */
  @Test
  fun flipCorrectsAWrongWaySwipe() {
    val f = PageFlipDetector()
    f.observe(1, false, 0)
    assertEquals(-1, f.stepped(1_000, -1))
    assertEquals(2, f.observe(2, false, 1_200))
  }
}
