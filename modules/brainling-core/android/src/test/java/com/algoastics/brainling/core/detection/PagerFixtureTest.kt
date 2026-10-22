package com.algoastics.brainling.core.detection

import com.algoastics.brainling.core.rules.AppRule
import com.algoastics.brainling.core.rules.RuleSet
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Built from Ahsan's Samsung captures (TikTok and YouTube Shorts, one before and one after a
 * swipe). They show why the surface alone cannot key a reel and which pager carries the position.
 */
class PagerFixtureTest {
  private val rules = RuleSet.parse(File("../rules/rules.json").readText())
  private val tiktokRule = requireNotNull(rules.ruleFor("com.zhiliaoapp.musically"))
  private val youtubeRule = requireNotNull(rules.ruleFor("com.google.android.youtube"))

  private val tiktok = listOf("tiktok_before.txt", "tiktok_after.txt").map(LayoutFixture::load)
  private val youtube = listOf("youtube_before.txt", "youtube_after.txt").map(LayoutFixture::load)

  /** What NodeInspector.findById returns: the first visible, non-empty node with a surface id. */
  private fun surface(layout: LayoutFixture, rule: AppRule): LayoutFixture.Node =
    rule.surfaceIds.firstNotNullOf { id ->
      layout.withBareId(id).firstOrNull { it.visible && it.bounds.width > 0 && it.bounds.height > 0 }
    }

  /** Nodes whose scroll events the rule accepts (event class = node class for these pagers). */
  private fun pagers(layout: LayoutFixture, rule: AppRule) = layout.nodes.filter {
    it.viewId != null && PagerMatch.matches(rule, it.viewId, it.className, it.className)
  }

  @Test
  fun capturesArePairedByPackage() {
    tiktok.forEach { assertEquals("com.zhiliaoapp.musically", it.packageName) }
    youtube.forEach { assertEquals("com.google.android.youtube", it.packageName) }
  }

  @Test
  fun surfaceBoundsDoNotChangeAcrossASwipe() {
    // Same signal, same bounds before and after the swipe: nothing on the surface itself can key
    // a reel, so the key must come from the pager position.
    val (before, after) = youtube.map { surface(it, youtubeRule) }
    assertEquals(before.bounds, after.bounds)
    assertEquals(LayoutFixture.Bounds(0, 80, 1080, 2070), before.bounds)
    val (tBefore, tAfter) = tiktok.map { surface(it, tiktokRule) }
    assertEquals(tBefore.bounds, tAfter.bounds)
  }

  @Test
  fun rootCauseSurfaceOnlyRulesDropThePagerScrollEvents() {
    // ruleset v3 behaviour: scroll events had to come from a surface id. The surface is a page
    // child and the scroll events come from the pager, so every event was dropped (index "—").
    val legacyYoutube = youtubeRule.copy(pagerIds = emptyList())
    val legacyTiktok = tiktokRule.copy(pagerIds = emptyList(), pagerClassNames = emptyList())
    youtube.forEach { assertTrue(pagers(it, legacyYoutube).none { n -> n.bareId == "reel_recycler" }) }
    tiktok.forEach { layout ->
      assertTrue(pagers(layout, legacyTiktok).none { it.className == "androidx.viewpager.widget.ViewPager" })
    }
  }

  @Test
  fun youtubeRecyclerIsTheOnlyPagerAndHoldsTheSurface() {
    for (layout in youtube) {
      val pager = pagers(layout, youtubeRule).single()
      assertEquals("reel_recycler", pager.bareId)
      assertTrue(pager.visible)
      assertTrue(layout.isAncestor(pager, surface(layout, youtubeRule)))
    }
  }

  @Test
  fun tiktokClassFilterPicksTheFeedPagerOutOfThreeViewpagers() {
    for (layout in tiktok) {
      val sameId = layout.withBareId("viewpager")
      assertEquals(3, sameId.size)
      assertEquals(2, sameId.count { it.className != "androidx.viewpager.widget.ViewPager" })
      val pager = pagers(layout, tiktokRule).single()
      assertEquals("androidx.viewpager.widget.ViewPager", pager.className)
      assertTrue(pager.scrollable)
      // The outer tab pagers also contain the surface, so the id alone would mix their indices in.
      assertTrue(sameId.all { layout.isAncestor(it, surface(layout, tiktokRule)) })
    }
  }

  @Test
  fun tiktokSecondCaptureIsMidSettle() {
    // The page holding the player is offset from the pager top in the second capture: the swipe
    // had not settled, which is why evaluation waits for PagerTracker.isSettling to clear.
    val offsets = tiktok.map { layout ->
      val pager = pagers(layout, tiktokRule).single()
      val page = requireNotNull(layout.childToward(pager, surface(layout, tiktokRule)))
      assertEquals("view_rootview", page.bareId)
      page.bounds.top - pager.bounds.top
    }
    assertEquals(0, offsets[0])
    assertNotEquals(0, offsets[1])
    assertFalse(offsets[1] < 0)
  }
}
