package com.algoastics.thumbwell.core.lock

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LockBoundsTest {
  private val w = 1080
  private val h = 2340
  private val nav = 135
  private val d = 3f

  private fun select(surface: Box? = null, tabBar: Box? = null, app: Box? = null) =
    LockBounds.select(surface, tabBar, app, w, h, nav, d)

  @Test fun containerBoundsAreUsedAsTheyAreWhenNoTabBarIsInside() {
    // YouTube Shorts: the container sits above the pivot bar already.
    val box = Box(0, 80, w, 2000)
    val r = select(surface = box)
    assertEquals(LockBounds.Source.SURFACE, r.source)
    assertEquals(box, r.box)
  }

  @Test fun theTabBarIsCutOffTheBottom() {
    // Instagram: the pager runs to the nav bar and the tab bar floats over its bottom.
    val r = select(surface = Box(0, 0, w, 2205), tabBar = Box(0, 2052, w, 2205))
    assertEquals(Box(0, 0, w, 2052), r.box)
  }

  @Test fun anInnerRowIsNotTakenForTheTabBar() {
    // A wide row in the top half of the area (a header) never moves the bottom.
    val area = Box(0, 0, w, 2205)
    assertFalse(LockBounds.isBottomBar(Box(0, 200, w, 350), area, w))
    assertFalse(LockBounds.isBottomBar(Box(0, 2052, 300, 2205), area, w)) // too narrow
    assertTrue(LockBounds.isBottomBar(Box(0, 2052, w, 2205), area, w))
    val r = select(surface = area, tabBar = Box(0, 200, w, 350))
    assertEquals(area, r.box)
  }

  @Test fun aSmallContainerFallsBackToTheAppWindowMinusTheDefaultTabBar() {
    val r = select(surface = Box(100, 300, 500, 600), app = Box(0, 0, w, 2205))
    assertEquals(LockBounds.Source.APP, r.source)
    assertEquals(Box(0, 0, w, 2205 - 168), r.box) // 56 dp at 3x
  }

  @Test fun aKnownTabBarBeatsTheDefaultHeightOnAFallbackBase() {
    val r = select(app = Box(0, 0, w, 2205), tabBar = Box(0, 2100, w, 2205))
    assertEquals(Box(0, 0, w, 2100), r.box)
  }

  @Test fun noTreeAtAllCoversTheScreenWithoutTheNavigationBarOrAGuessedTabBar() {
    val r = select()
    assertEquals(LockBounds.Source.SCREEN, r.source)
    assertEquals(Box(0, 0, w, h - nav - 168), r.box)
  }

  @Test fun outOfScreenBoundsAreClamped() {
    val r = select(surface = Box(-10, -10, w + 50, h + 50), tabBar = Box(0, 2100, w, 2205))
    assertEquals(Box(0, 0, w, 2100), r.box)
  }

  @Test fun aTabBarCutThatWouldLeaveAStubIsIgnored() {
    val r = select(surface = Box(0, 0, w, 2205), tabBar = Box(0, 400, w, 2205))
    // bar.top 400 is not in the lower half: not a bottom bar, nothing is cut.
    assertEquals(Box(0, 0, w, 2205), r.box)
  }

  @Test fun theStructuralTabBarTestWantsAWideLowRowOfClickables() {
    val bar = Box(0, 2100, w, 2205) // 35 dp high at 3x is below the minimum: use a 56 dp row
    assertFalse(LockBounds.looksLikeTabBar(bar, 5, w, h, d))
    val real = Box(0, 2037, w, 2205)
    assertTrue(LockBounds.looksLikeTabBar(real, 5, w, h, d))
    assertFalse(LockBounds.looksLikeTabBar(real, 2, w, h, d)) // too few clickables
    assertFalse(LockBounds.looksLikeTabBar(Box(0, 800, w, 968), 5, w, h, d)) // mid screen
    assertFalse(LockBounds.looksLikeTabBar(Box(0, 2037, 500, 2205), 5, w, h, d)) // narrow
  }

  // --- Home tab choice ---

  @Test fun instagramAndYouTubeHaveAHomeTabAndTikTokDoesNot() {
    assertEquals(listOf("feed_tab"), HomeTab.specFor("instagram")?.homeIds)
    assertEquals(listOf("pivot_bar"), HomeTab.specFor("youtube")?.barIds)
    assertNull(HomeTab.specFor("tiktok"))
    assertNull(HomeTab.specFor("tiktok_lite"))
  }

  private fun items(vararg lefts: Int) = lefts.mapIndexed { i, l -> HomeTab.Item(i, l, true) }

  @Test fun homeIsTheFirstItemFromTheStartEdge() {
    val bar = items(0, 216, 432, 648, 864)
    assertEquals(0, HomeTab.chooseByIndex(bar, 0, rtl = false)?.index)
    // Right to left: the first item is the rightmost one, whatever its child index.
    assertEquals(4, HomeTab.chooseByIndex(bar, 0, rtl = true)?.index)
  }

  @Test fun itemsAreOrderedByPositionNotByChildOrder() {
    val shuffled = listOf(HomeTab.Item(0, 432, true), HomeTab.Item(1, 0, true), HomeTab.Item(2, 864, true))
    assertEquals(1, HomeTab.chooseByIndex(shuffled, 0, rtl = false)?.index)
  }

  @Test fun aRowWithFewerThanThreeItemsIsNotATabBar() {
    assertNull(HomeTab.chooseByIndex(items(0, 540), 0, rtl = false))
    assertNull(HomeTab.chooseByIndex(emptyList(), 0, rtl = false))
    assertNull(HomeTab.chooseByIndex(items(0, 300, 600), 5, rtl = false))
  }

  // --- the whole cover box: bounds, then the free top strip ---

  private val band = OverlayGuard.topBandPx(72, d)

  @Test fun theCoverStartsExactlyAtTheStripAndStopsAboveTheTabBar() {
    // Instagram: pager from the top of the screen, tab bar over its bottom.
    val picked = select(surface = Box(0, 0, w, 2205), tabBar = Box(0, 2052, w, 2205)).box
    val cover = OverlayGuard.leaveTopBand(picked, band)
    assertEquals(Box(0, band, w, 2052), cover)
    assertEquals(w, cover.width) // full width, no side gap
  }

  @Test fun aContainerThatAlreadyStartsBelowTheStripIsNotMovedDown() {
    // YouTube: the container starts at 80 px, inside the strip: it is cut to the strip, not lower.
    val ytTop = OverlayGuard.leaveTopBand(select(surface = Box(0, 80, w, 2000)).box, band)
    assertEquals(band, ytTop.top)
    val low = OverlayGuard.leaveTopBand(select(surface = Box(0, 500, w, 2000)).box, band)
    assertEquals(500, low.top)
  }

  @Test fun theCoverIsNeverTallerThanTheContainerOrCoversTheTabBar() {
    val surface = Box(0, 0, w, 2205)
    val bar = Box(0, 2052, w, 2205)
    val cover = OverlayGuard.leaveTopBand(select(surface = surface, tabBar = bar).box, band)
    assertTrue(cover.bottom <= bar.top)
    assertTrue(cover.top >= surface.top && cover.bottom <= surface.bottom)
  }
}
