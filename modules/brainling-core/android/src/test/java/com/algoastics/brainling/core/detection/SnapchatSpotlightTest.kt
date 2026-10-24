package com.algoastics.brainling.core.detection

import com.algoastics.brainling.core.detection.ReelSession.Exit
import com.algoastics.brainling.core.rules.RuleSet
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Snapchat Spotlight. The layout fixture and the pager class are ASSUMED (no real capture: Snapchat
 * blocks emulator logins), so these tests pin the counting rules, not Snapchat's real structure.
 */
class SnapchatSpotlightTest {
  private val rules = RuleSet.parse(File("../rules/rules.json").readText())
  private val rule = requireNotNull(rules.ruleFor("com.snapchat.android"))
  private val layout = LayoutFixture.load("snapchat_spotlight_assumed.txt")

  private class N(val text: String? = null, val desc: String? = null, vararg val kids: N)

  private fun ad(root: N) =
    AdMarker.containsAd(root, AdMarker.labelsFor(rule.key, rule.adLabels), { it.kids.toList() }, { listOf(it.text, it.desc) })

  // --- pager / surface selection -------------------------------------------------------------

  @Test
  fun surfaceIsFoundAndItsRecyclerViewIsTheOnlyUnnamedPager() {
    val surface = layout.withBareId("spotlight_container").single()
    assertTrue(surface.visible)
    val pager = layout.nodes.single { it.parent == surface.index && it.scrollable }
    assertEquals("androidx.recyclerview.widget.RecyclerView", pager.className)
    assertTrue(layout.isAncestor(surface, pager))
  }

  @Test
  fun recyclerViewScrollEventsFromUnnamedPagerCountAsPagerEvents() {
    val rv = "androidx.recyclerview.widget.RecyclerView"
    assertTrue(PagerMatch.matches(rule, null, rv, rv))
    assertTrue(PagerMatch.matches(rule, "com.snapchat.android:id/spotlight_container", "android.widget.FrameLayout", null))
    assertFalse(PagerMatch.matches(rule, "com.snapchat.android:id/x", "android.widget.TextView", "android.widget.TextView"))
  }

  @Test
  fun otherAppsKeepSurfaceOnlyMatching() {
    val instagram = requireNotNull(rules.ruleFor("com.instagram.android"))
    val rv = "androidx.recyclerview.widget.RecyclerView"
    assertFalse(PagerMatch.matches(instagram, "com.instagram.android:id/other", rv, rv))
    assertTrue(PagerMatch.CLASS_PAGER_APPS == setOf("snapchat"))
  }

  // --- ads -----------------------------------------------------------------------------------

  @Test
  fun sponsoredAndAdLabelsAreSkippedCaptionsAreNot() {
    assertTrue(ad(N(null, null, N("Sponsored"), N("creator"))))
    assertTrue(ad(N(null, null, N(desc = "Ad · Install"))))
    assertFalse(ad(N(null, null, N("Add friend"), N("Sponsored by my mom lol, this was a fun trip"))))
  }

  // --- counting (same rules as the other apps) -----------------------------------------------

  private val s = ReelSession()
  private var now = 0L
  private var counted = 0
  private val spotlight = PlayerKey(1, 0x10)
  private val creator = PlayerKey(2, 0x20)

  private fun stay(player: PlayerKey, sig: Long?, ms: Long = 1_500, isAd: Boolean = false) {
    val end = now + ms
    while (now < end) {
      if (s.evaluate(player, sig, settling = false, nowMs = now, path = "8/RecyclerView#<FrameLayout#spotlight_container") { isAd }
          .decision == ReelSession.Decision.COUNTED) counted++
      now += 250
    }
  }

  private fun page(player: PlayerKey, index: Int, ms: Long = 1_500, isAd: Boolean = false) {
    s.onIndex(index, now)
    stay(player, 100L + index, ms, isAd)
  }

  @Test
  fun openPlusTwoSwipesCountsThree() {
    for (i in 0..2) page(spotlight, i)
    assertEquals(3, counted)
  }

  @Test
  fun swipeBackNeverCountsAndReturningWithoutMovingNeverRecounts() {
    for (i in 0..2) page(spotlight, i)
    page(spotlight, 1)
    page(spotlight, 0)
    stay(spotlight, 100, ms = 3_000)
    assertEquals(3, counted)
  }

  @Test
  fun commentsSheetAndHomeReturnDoNotRecount() {
    for (i in 0..1) page(spotlight, i)
    s.exit(Exit.COVERED); now += 2_000 // comments sheet
    stay(spotlight, 101)
    s.exit(Exit.COVERED); now += 2_000
    stay(spotlight, 101)
    s.exit(Exit.BACKGROUND); now += 5_000 // home and return
    stay(spotlight, 101)
    assertEquals(2, counted)
  }

  @Test
  fun creatorProfileSnapIsANewPlayerAndCountsOnce() {
    for (i in 0..1) page(spotlight, i)
    s.exit(Exit.CLOSED); now += 2_000
    stay(creator, 900)
    assertEquals(3, counted)
    s.exit(Exit.CLOSED); now += 2_000
    stay(spotlight, 101) // back on the same snap
    assertEquals(3, counted)
  }

  @Test
  fun sponsoredSnapIsSkippedAndNeighboursStillCount() {
    page(spotlight, 0)
    page(spotlight, 1, isAd = true)
    page(spotlight, 2)
    assertEquals(2, counted)
  }

  @Test
  fun snapBelowSettleTimeDoesNotCount() {
    page(spotlight, 0)
    page(spotlight, 1, ms = 250)
    page(spotlight, 2)
    assertEquals(2, counted)
  }
}
