package com.algoastics.brainling.core.detection

import android.graphics.Rect
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.algoastics.brainling.core.rules.AppRule
import com.algoastics.brainling.core.rules.StructureRule

/** A visible reels surface. Only structural data (ids, class, bounds) is kept, never text. */
data class Surface(
  /** Which rule signal matched: a view id, a content-description constant, or "structure". */
  val signal: String,
  val className: String?,
  val bounds: Rect,
  /** The matched node, used to find the pager around it (never compared or persisted). */
  val node: AccessibilityNodeInfo? = null,
)

/** The pager that carries the reel position, and the bounds used to match its scroll events. */
class Pager(val node: AccessibilityNodeInfo, val bounds: Rect)

/**
 * Finds reels surfaces with the signals of an [AppRule]: view ids first, then exact
 * content-description constants, then the structural fallback. Never reads node text; content
 * descriptions are only compared for equality against the ruleset's fixed component labels.
 */
object NodeInspector {
  /** Upper bound on nodes visited by the tree walks (content descriptions, structure). */
  private const val MAX_NODES = 600

  fun findSurface(root: AccessibilityNodeInfo, rule: AppRule, packageName: String): Surface? =
    findById(root, rule.surfaceIds, rule, packageName)
      ?: findByContentDescription(root, rule.contentDescriptions)
      ?: rule.structure?.let { findByStructure(root, it) }

  /** True when every view id of the rule's DM signature is visible (a reel opened from a DM). */
  fun hasDmSignature(root: AccessibilityNodeInfo, rule: AppRule, packageName: String): Boolean =
    rule.dmSignatureIds.isNotEmpty() && rule.dmSignatureIds.all { id ->
      qualifiedIds(id, rule, packageName).any { qualified ->
        root.findAccessibilityNodeInfosByViewId(qualified).any { it.isVisibleToUser }
      }
    }

  /** True when a scroll event describes the reel position (see [PagerMatch.matches]). */
  fun isPagerEvent(event: AccessibilityEvent, rule: AppRule): Boolean {
    val source = event.source
    return PagerMatch.matches(
      rule = rule,
      viewId = source?.viewIdResourceName,
      eventClass = event.className?.toString(),
      sourceClass = source?.className?.toString(),
    )
  }

  /** True for scroll events from a same-id pager that is not the feed pager (see [PagerMatch.isOtherPager]). */
  fun isOtherPagerEvent(event: AccessibilityEvent, rule: AppRule): Boolean {
    val source = event.source
    return PagerMatch.isOtherPager(
      rule = rule,
      viewId = source?.viewIdResourceName,
      eventClass = event.className?.toString(),
      sourceClass = source?.className?.toString(),
    )
  }

  /** Screen bounds of the event source, null when the event has no source node. */
  fun sourceBounds(event: AccessibilityEvent): Rect? =
    event.source?.let { node -> Rect().also { node.getBoundsInScreen(it) } }

  /**
   * The feed pager: with pager ids, the node chosen by [PagerMatch.selectPager] (deepest class
   * match, so nested same-id tab pagers are skipped); without, the surface itself when it
   * scrolls (Instagram, Facebook) or its nearest scrollable ancestor.
   */
  fun findPager(root: AccessibilityNodeInfo, rule: AppRule, packageName: String, surface: Surface): Pager? {
    if (rule.pagerIds.isNotEmpty()) {
      val nodes = rule.pagerIds.flatMap { id ->
        qualifiedIds(id, rule, packageName).flatMap { root.findAccessibilityNodeInfosByViewId(it) }
      }
      val bounds = nodes.map { Rect().also(it::getBoundsInScreen) }
      val candidates = nodes.mapIndexed { i, node ->
        PagerCandidate(depthOf(node), node.className?.toString(), node.isVisibleToUser, bounds[i].width(), bounds[i].height())
      }
      val chosen = PagerMatch.selectPager(rule, candidates) ?: return null
      return Pager(nodes[chosen], bounds[chosen])
    }
    var node = surface.node
    var hops = 0
    while (node != null && hops <= MAX_PAGER_HOPS) {
      if (node.isScrollable) return visibleBounds(node)?.let { Pager(node, it) }
      node = node.parent
      hops++
    }
    return null
  }

  /**
   * True when the settled reel ([pager]'s visible page, else [fallback]) shows one of [labels]
   * as a whole label node. Text is compared and dropped; nothing is kept.
   */
  fun hasAdLabel(pager: Pager?, fallback: AccessibilityNodeInfo?, labels: List<String>): Boolean {
    if (labels.isEmpty()) return false
    val root = pager?.let(::visiblePage) ?: fallback ?: return false
    return AdMarker.containsAd(
      root,
      labels,
      children = { n -> (0 until n.childCount).mapNotNull(n::getChild).filter { it.isVisibleToUser } },
      values = { n -> listOf(n.text, n.contentDescription) },
    )
  }

  private fun visiblePage(pager: Pager): AccessibilityNodeInfo? {
    val node = pager.node
    val height = pager.bounds.height()
    if (height <= 0) return null
    val r = Rect()
    return (0 until node.childCount).mapNotNull(node::getChild).maxByOrNull { child ->
      child.getBoundsInScreen(r)
      if (r.intersect(pager.bounds)) r.height() else 0
    }
  }

  /**
   * Identity of the page view that fills most of [pager] (at least [PAGE_FILL] of its height),
   * or null mid-swipe. Uses the node's hash, which Android derives from the source view id, so
   * it is stable for one view and differs between page views. Never reads text.
   */
  fun visiblePageId(pager: Pager): Long? {
    val node = pager.node
    val height = pager.bounds.height()
    if (height <= 0) return null
    var best: AccessibilityNodeInfo? = null
    var bestHeight = 0
    val r = Rect()
    for (i in 0 until node.childCount) {
      val child = node.getChild(i) ?: continue
      child.getBoundsInScreen(r)
      if (!r.intersect(pager.bounds)) continue
      if (r.height() > bestHeight) {
        bestHeight = r.height()
        best = child
      }
    }
    if (best == null || bestHeight < PAGE_FILL * height) return null
    return best.hashCode().toLong()
  }

  /**
   * Structural identity of a player node: its class and resource id plus those of its nearest
   * ancestors and its depth. Stable when the app rebuilds the view; never reads text.
   */
  fun structuralPath(node: AccessibilityNodeInfo): String {
    val parts = ArrayList<String>()
    var cursor: AccessibilityNodeInfo? = node
    var hops = 0
    while (cursor != null && hops < PATH_HOPS) {
      parts.add("${cursor.className?.toString()?.substringAfterLast('.')}#${cursor.viewIdResourceName?.substringAfter(":id/") ?: ""}")
      cursor = cursor.parent
      hops++
    }
    return "${depthOf(node)}/" + parts.joinToString("<")
  }

  private const val PATH_HOPS = 8

  private fun depthOf(node: AccessibilityNodeInfo): Int {
    var depth = 0
    var cursor = node.parent
    while (cursor != null && depth < MAX_DEPTH) {
      depth++
      cursor = cursor.parent
    }
    return depth
  }

  private const val MAX_PAGER_HOPS = 6
  private const val MAX_DEPTH = 100
  private const val PAGE_FILL = 0.6f

  /** The structural fields of a scroll event. */
  fun scrollOf(event: AccessibilityEvent): PagerScroll = PagerScroll(
    fromIndex = event.fromIndex,
    toIndex = event.toIndex,
    scrollY = event.scrollY,
    maxScrollY = event.maxScrollY,
    scrollDeltaY = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) event.scrollDeltaY else 0,
  )

  private fun findById(
    root: AccessibilityNodeInfo,
    ids: List<String>,
    rule: AppRule,
    packageName: String,
  ): Surface? {
    for (id in ids) {
      for (qualified in qualifiedIds(id, rule, packageName)) {
        for (node in root.findAccessibilityNodeInfosByViewId(qualified)) {
          val bounds = visibleBounds(node) ?: continue
          return Surface(id, node.className?.toString(), bounds, node)
        }
      }
    }
    return null
  }

  /**
   * Resource ids are qualified with the package that owns the resources. Patched or regional
   * builds (e.g. ReVanced) can keep the original package's resources, so every package of the
   * app family is tried, the observed package first.
   */
  private fun qualifiedIds(id: String, rule: AppRule, packageName: String): List<String> =
    (listOf(packageName) + rule.packageNames).distinct().map { "$it:id/$id" }

  private fun findByContentDescription(root: AccessibilityNodeInfo, labels: List<String>): Surface? {
    if (labels.isEmpty()) return null
    var found: Surface? = null
    walk(root) { node ->
      val description = node.contentDescription?.toString()
      if (description != null && description in labels) {
        visibleBounds(node)?.let { found = Surface(description, node.className?.toString(), it, node) }
      }
      found == null
    }
    return found
  }

  private fun findByStructure(root: AccessibilityNodeInfo, rule: StructureRule): Surface? {
    val screen = Rect().also { root.getBoundsInScreen(it) }
    if (screen.width() <= 0 || screen.height() <= 0) return null
    var found: Surface? = null
    walk(root) { node ->
      if (matchesStructure(node, rule, screen)) {
        visibleBounds(node)?.let { found = Surface(SIGNAL_STRUCTURE, node.className?.toString(), it, node) }
      }
      found == null
    }
    return found
  }

  private fun matchesStructure(node: AccessibilityNodeInfo, rule: StructureRule, screen: Rect): Boolean {
    val bounds = visibleBounds(node) ?: return false
    val nodeMatches = StructureMatch.matches(
      rule = rule,
      className = node.className?.toString(),
      width = bounds.width(),
      height = bounds.height(),
      screenWidth = screen.width(),
      screenHeight = screen.height(),
      scrollable = node.isScrollable,
      longClickable = node.isLongClickable,
    )
    if (!nodeMatches) return false
    val descendant = rule.descendant ?: return true
    var hit = false
    for (i in 0 until node.childCount) {
      val child = node.getChild(i) ?: continue
      walk(child) { candidate ->
        if (matchesStructure(candidate, descendant, screen)) hit = true
        !hit
      }
      if (hit) break
    }
    return hit
  }

  /** Breadth-first walk of at most [MAX_NODES] nodes; [visit] returns false to stop. */
  private inline fun walk(root: AccessibilityNodeInfo, visit: (AccessibilityNodeInfo) -> Boolean) {
    val queue = ArrayDeque<AccessibilityNodeInfo>().apply { add(root) }
    var visited = 0
    while (queue.isNotEmpty() && visited < MAX_NODES) {
      val node = queue.removeFirst()
      visited++
      if (!visit(node)) return
      for (i in 0 until node.childCount) node.getChild(i)?.let(queue::addLast)
    }
  }

  private fun visibleBounds(node: AccessibilityNodeInfo): Rect? {
    if (!node.isVisibleToUser) return null
    val bounds = Rect().also { node.getBoundsInScreen(it) }
    return bounds.takeIf { it.width() > 0 && it.height() > 0 }
  }

  const val SIGNAL_STRUCTURE = "structure"
}

/** Pure structural test of one node against a [StructureRule] (unit-tested without Android). */
object StructureMatch {
  fun matches(
    rule: StructureRule,
    className: String?,
    width: Int,
    height: Int,
    screenWidth: Int,
    screenHeight: Int,
    scrollable: Boolean,
    longClickable: Boolean,
  ): Boolean {
    if (className == null || className !in rule.classNames) return false
    if (width <= 0 || height <= 0 || screenWidth <= 0 || screenHeight <= 0) return false
    if (rule.requireScrollable && !scrollable) return false
    if (rule.requireLongClickable && !longClickable) return false
    return width >= rule.minWidthFraction * screenWidth &&
      height >= rule.minHeightFraction * screenHeight
  }
}
