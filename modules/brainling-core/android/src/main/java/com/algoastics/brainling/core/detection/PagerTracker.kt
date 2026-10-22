package com.algoastics.brainling.core.detection

import com.algoastics.brainling.core.rules.AppRule
import kotlin.math.abs

/** The structural fields of one TYPE_VIEW_SCROLLED event (no text), so the logic is testable. */
data class PagerScroll(
  val fromIndex: Int,
  val toIndex: Int,
  val scrollY: Int,
  val maxScrollY: Int,
  /** AccessibilityEvent.getScrollDeltaY (API 28+), 0 when unknown. */
  val scrollDeltaY: Int,
)

/** Where a session's page index came from (shown on the debug screen). */
enum class IndexSource { PAGER, SWIPE }

/** Decides which scroll events describe the reel position (pure; unit-tested). */
object PagerMatch {
  /**
   * True when a scroll event with source view id [viewId] and class names [eventClass] /
   * [sourceClass] comes from the rule's pager. Rules without [AppRule.pagerIds] keep the old
   * behaviour: the event must come from a surface view (Instagram's surface is the pager), or
   * from anywhere when the app has no surface ids (Facebook's structural fallback).
   */
  fun matches(rule: AppRule, viewId: String?, eventClass: String?, sourceClass: String?): Boolean {
    val bare = viewId?.substringAfter(":id/", "").orEmpty()
    if (rule.pagerIds.isEmpty()) {
      if (rule.surfaceIds.isEmpty()) return true
      return bare.isNotEmpty() && bare in rule.surfaceIds
    }
    if (bare.isEmpty() || bare !in rule.pagerIds) return false
    if (rule.pagerClassNames.isEmpty()) return true
    return eventClass in rule.pagerClassNames || sourceClass in rule.pagerClassNames
  }

  /**
   * Page index from a scroll event: the adapter position when the pager has settled on one item
   * (fromIndex == toIndex; ViewPager always reports its current item), else derived from the
   * scroll offset and the surface height. Null while a RecyclerView shows two pages mid-swipe.
   */
  fun pageIndex(scroll: PagerScroll, surfaceHeight: Int): Int? {
    if (scroll.fromIndex >= 0 && scroll.fromIndex == scroll.toIndex) return scroll.fromIndex
    if (scroll.fromIndex >= 0 && scroll.toIndex < 0) return scroll.fromIndex
    if (surfaceHeight > 0 && scroll.scrollY >= 0 && scroll.maxScrollY > 0) {
      return Math.round(scroll.scrollY.toFloat() / surfaceHeight)
    }
    return null
  }
}

/**
 * Per-session pager state. Pager scroll events that carry an adapter position give the page index
 * directly. When the app's pager never reports a position, a completed swipe (scroll events, then
 * [settleMs] of quiet, net movement of at least half a page when deltas are known) advances a
 * synthetic index by one in the swipe direction. Autoplay loops of the same reel scroll nothing,
 * so they never move the index; swiping back lands on the previous index, which the dedupe ring
 * already holds.
 */
class PagerTracker(private val settleMs: Long = SETTLE_MS) {
  private var lastScrollAtMs = Long.MIN_VALUE / 2
  private var moving = false
  private var netDeltaY = 0
  private var sawDelta = false

  /** Source of the last index this tracker produced; once PAGER, swipes are never synthesised. */
  var source: IndexSource? = null
    private set

  /** Feeds a pager scroll event; returns the page index when the event carries one. */
  fun onScroll(scroll: PagerScroll, surfaceHeight: Int, nowMs: Long): Int? {
    lastScrollAtMs = nowMs
    val index = PagerMatch.pageIndex(scroll, surfaceHeight)
    if (index != null) {
      source = IndexSource.PAGER
      resetMove()
      return index
    }
    if (scroll.scrollDeltaY != 0) {
      sawDelta = true
      netDeltaY += scroll.scrollDeltaY
    }
    moving = true
    return null
  }

  /** True while the pager is still scrolling: the surface on screen is not a settled reel yet. */
  fun isSettling(nowMs: Long): Boolean = nowMs - lastScrollAtMs < settleMs

  /**
   * Call on each evaluation of a visible surface. Returns the next synthetic index when an
   * index-less swipe has just settled, else null.
   */
  fun settle(currentIndex: Int?, surfaceHeight: Int, nowMs: Long): Int? {
    if (!moving || isSettling(nowMs)) return null
    val fullPage = !sawDelta || surfaceHeight <= 0 || abs(netDeltaY) * 2 >= surfaceHeight
    val step = if (netDeltaY < 0) -1 else 1
    resetMove()
    if (!fullPage || source == IndexSource.PAGER) return null
    source = IndexSource.SWIPE
    return (currentIndex ?: 0) + step
  }

  private fun resetMove() {
    moving = false
    netDeltaY = 0
    sawDelta = false
  }

  companion object {
    /** Views send recurring scroll events at most every 100 ms; two missed beats = settled. */
    const val SETTLE_MS = 200L
  }
}
