package com.algoastics.brainling.core.detection

import android.graphics.Rect
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
)

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

  /** True when a scroll event came from one of the rule's surface views (or the rule has none). */
  fun isSurfaceEvent(event: AccessibilityEvent, rule: AppRule): Boolean {
    if (rule.surfaceIds.isEmpty()) return true
    val id = event.source?.viewIdResourceName ?: return false
    val bare = id.substringAfter(":id/", "")
    return bare.isNotEmpty() && bare in rule.surfaceIds
  }

  /**
   * Page index from a scroll event: the adapter position when the pager has settled on one item
   * (fromIndex == toIndex), else derived from the scroll offset and the surface height.
   */
  fun pageIndex(event: AccessibilityEvent, surfaceHeight: Int): Int? {
    if (event.fromIndex >= 0 && event.fromIndex == event.toIndex) return event.fromIndex
    if (event.fromIndex >= 0 && event.toIndex < 0) return event.fromIndex
    if (surfaceHeight > 0 && event.scrollY >= 0 && event.maxScrollY > 0) {
      return Math.round(event.scrollY.toFloat() / surfaceHeight)
    }
    return null
  }

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
          return Surface(id, node.className?.toString(), bounds)
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
        visibleBounds(node)?.let { found = Surface(description, node.className?.toString(), it) }
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
        visibleBounds(node)?.let { found = Surface(SIGNAL_STRUCTURE, node.className?.toString(), it) }
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
