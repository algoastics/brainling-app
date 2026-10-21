package com.algoastics.brainling.core.detection

import android.graphics.Rect
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/** A visible reels surface. Only structural data (ids, class, bounds) is kept, never text. */
data class Surface(val surfaceId: String, val className: String?, val bounds: Rect)

object NodeInspector {
  /** Finds the first visible, non-empty node whose view ID is one of the rule's surface IDs. */
  fun findSurface(root: AccessibilityNodeInfo, rule: AppRule): Surface? {
    for (id in rule.surfaceIds) {
      val nodes = root.findAccessibilityNodeInfosByViewId("${rule.packageName}:id/$id")
      for (node in nodes) {
        if (!node.isVisibleToUser) continue
        val bounds = Rect().also { node.getBoundsInScreen(it) }
        if (bounds.width() > 0 && bounds.height() > 0) {
          return Surface(id, node.className?.toString(), bounds)
        }
      }
    }
    return null
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
}
