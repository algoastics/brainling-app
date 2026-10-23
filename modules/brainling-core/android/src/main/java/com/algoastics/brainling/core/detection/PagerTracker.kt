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
enum class IndexSource { PAGER, SWIPE, FLIP }

/** Structural facts about one node carrying a pager id (for [PagerMatch.selectPager]). */
data class PagerCandidate(
  val depth: Int,
  val className: String?,
  val visible: Boolean,
  val width: Int,
  val height: Int,
)

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
    // Some events arrive without a source node; the class filter alone then identifies the pager.
    if (viewId == null && rule.pagerClassNames.isNotEmpty()) return eventClass in rule.pagerClassNames
    if (rule.pagerIds.isEmpty()) {
      if (rule.surfaceIds.isEmpty()) return true
      return bare.isNotEmpty() && bare in rule.surfaceIds
    }
    if (bare.isEmpty() || bare !in rule.pagerIds) return false
    if (rule.pagerClassNames.isEmpty()) return true
    return eventClass in rule.pagerClassNames || sourceClass in rule.pagerClassNames
  }

  /**
   * True for a scroll event from a node that carries a pager id but is not the rule's pager, e.g.
   * TikTok's full-screen tab pagers that reuse the feed pager's id. Such events are dropped: they
   * must never move, reset or mask the feed position.
   */
  fun isOtherPager(rule: AppRule, viewId: String?, eventClass: String?, sourceClass: String?): Boolean {
    val bare = viewId?.substringAfter(":id/", "").orEmpty()
    return bare.isNotEmpty() && bare in rule.pagerIds && !matches(rule, viewId, eventClass, sourceClass)
  }

  /** Pager widget classes preferred when a rule has no class filter. */
  val KNOWN_PAGER_CLASSES = setOf(
    "androidx.viewpager.widget.ViewPager",
    "androidx.viewpager2.widget.ViewPager2",
    "androidx.recyclerview.widget.RecyclerView",
    "android.support.v4.view.ViewPager",
    "android.support.v7.widget.RecyclerView",
  )

  /**
   * Picks the feed pager among visible nodes carrying a pager id: nodes matching the rule's class
   * filter first (else known pager widgets, else any), and among those the deepest, because apps
   * nest full-screen tab pagers around the real feed pager. Returns the index into [candidates].
   */
  fun selectPager(rule: AppRule, candidates: List<PagerCandidate>): Int? {
    val usable = candidates.withIndex().filter { (_, c) -> c.visible && c.width > 0 && c.height > 0 }
    if (usable.isEmpty()) return null
    val preferred = rule.pagerClassNames.ifEmpty { KNOWN_PAGER_CLASSES }
    val pool = usable.filter { it.value.className in preferred }.ifEmpty {
      if (rule.pagerClassNames.isNotEmpty()) return null else usable
    }
    return pool.maxByOrNull { it.value.depth }?.index
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

  /** Records that the index now comes from a page flip (never overrides a pager index). */
  fun markFlip() {
    if (source != IndexSource.PAGER) source = IndexSource.FLIP
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

/**
 * Swipe detection that needs no scroll events: the identity of the page view filling the pager
 * changes on every swipe (pagers show a different child view per page). Some apps (YouTube
 * Shorts) send no usable scroll events from the pager after the first layout, so this is what
 * advances their index. A return to the page shown before the current one is a swipe back.
 * Pure: identities are opaque numbers (AccessibilityNodeInfo hash codes on device).
 */
class PageFlipDetector {
  private var current: Long? = null
  private var previous: Long? = null
  private var resyncUntil = 0L

  /**
   * A settled swipe (scroll fallback) already moved the position at [nowMs]: the next page view
   * change within [RESYNC_MS] is that same swipe (TikTok rebinds the page view a beat later), so
   * it is only recorded.
   */
  fun stepped(nowMs: Long) {
    resyncUntil = nowMs + RESYNC_MS
  }

  /**
   * Feeds the identity of the page now filling the pager (null mid-swipe or unknown). Returns +1 or
   * -1 when it flipped, else 0. [indexMoved] means the pager already reported a new index since
   * the last call: the flip is then only recorded, so one swipe never advances twice.
   */
  fun observe(identity: Long?, indexMoved: Boolean, nowMs: Long = 0L): Int {
    if (identity == null) return 0
    val old = current
    if (old == identity) return 0
    val resync = nowMs < resyncUntil
    resyncUntil = 0L
    val step = when {
      old == null || indexMoved || resync -> 0
      identity == previous -> -1
      else -> 1
    }
    previous = old
    current = identity
    return step
  }

  fun reset() {
    current = null
    previous = null
    resyncUntil = 0L
  }

  companion object {
    const val RESYNC_MS = 1_500L
  }
}
