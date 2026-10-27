package com.algoastics.thumbwell.core.lock

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import com.algoastics.thumbwell.core.detection.NodeInspector
import com.algoastics.thumbwell.core.rules.AppRule

/**
 * Reads and taps the foreground app's own tree for the lock: where its bottom tab bar is, the Home
 * tab, and the pause or mute control. Ids, bounds, flags and fixed control labels only; no text of
 * the user's content is read, stored or logged. The decisions are pure and tested elsewhere
 * ([LockBounds], [HomeTab], [PauseControl]); this file is the thin Android part.
 */
object LockTree {
  private const val MAX_NODES = 600
  private const val CLICK_HOPS = 4

  private fun Rect.toBox() = Box(left, top, right, bottom)

  private fun boundsOf(node: AccessibilityNodeInfo): Box? {
    if (!node.isVisibleToUser) return null
    val r = Rect().also(node::getBoundsInScreen)
    return if (r.width() > 0 && r.height() > 0) r.toBox() else null
  }

  private fun byId(root: AccessibilityNodeInfo, id: String, rule: AppRule, pkg: String): List<AccessibilityNodeInfo> =
    NodeInspector.qualifiedIds(id, rule, pkg).flatMap { root.findAccessibilityNodeInfosByViewId(it) }

  /** The bottom tab bar: by the app's known bar id, else by shape (a wide low row of 3+ clickables). */
  fun tabBar(root: AccessibilityNodeInfo, rule: AppRule, pkg: String, screenW: Int, screenH: Int, density: Float): Box? {
    HomeTab.specFor(rule.key)?.barIds?.forEach { id ->
      byId(root, id, rule, pkg).firstNotNullOfOrNull(::boundsOf)?.let { return it }
    }
    var found: Box? = null
    walk(root) { node ->
      val box = boundsOf(node)
      if (box != null && node.childCount >= 3 && LockBounds.looksLikeTabBar(box, clickableChildren(node), screenW, screenH, density)) {
        found = box
        false
      } else {
        true
      }
    }
    return found
  }

  private fun clickableChildren(node: AccessibilityNodeInfo): Int {
    var count = 0
    for (i in 0 until node.childCount) {
      val child = node.getChild(i) ?: continue
      if (child.isClickable || (0 until child.childCount).any { child.getChild(it)?.isClickable == true }) count++
    }
    return count
  }

  /** The Home tab node of this app, or null when it has none or it is not on screen. */
  fun findHomeTab(root: AccessibilityNodeInfo, rule: AppRule, pkg: String, rtl: Boolean): AccessibilityNodeInfo? {
    val spec = HomeTab.specFor(rule.key) ?: return null
    for (id in spec.homeIds) {
      byId(root, id, rule, pkg).firstOrNull { it.isVisibleToUser }?.let { return it }
    }
    for (id in spec.barIds) {
      for (bar in byId(root, id, rule, pkg)) {
        var row: AccessibilityNodeInfo = bar
        var hops = 0
        while (row.childCount == 1 && hops++ < 4) row = row.getChild(0) ?: break
        val children = (0 until row.childCount).mapNotNull { row.getChild(it) }
        val items = children.mapIndexedNotNull { index, child ->
          boundsOf(child)?.let { HomeTab.Item(index, it.left, clickable = true) }
        }
        val chosen = HomeTab.chooseByIndex(items, spec.homeIndex, rtl) ?: continue
        children.getOrNull(chosen.index)?.let { return it }
      }
    }
    return null
  }

  /** Taps [node], or its nearest clickable ancestor or child. True when the click was accepted. */
  fun click(node: AccessibilityNodeInfo): Boolean {
    var cursor: AccessibilityNodeInfo? = node
    var hops = 0
    while (cursor != null && hops++ <= CLICK_HOPS) {
      if (cursor.isClickable && cursor.isEnabled) return cursor.performAction(AccessibilityNodeInfo.ACTION_CLICK)
      cursor = cursor.parent
    }
    for (i in 0 until node.childCount) {
      val child = node.getChild(i) ?: continue
      if (child.isClickable && child.isEnabled) return child.performAction(AccessibilityNodeInfo.ACTION_CLICK)
    }
    return false
  }

  /**
   * LOCK-C layer 1: taps the pause or mute control inside [area] when it reads as playing
   * ([PauseControl]). Returns the control's bounds when it was clicked (so the lock can remember
   * it), else null. A control in any other state, or none, is never touched.
   */
  fun pausePlaying(root: AccessibilityNodeInfo, area: Box): Box? {
    for (key in PauseControl.SEARCH_KEYS) {
      for (node in root.findAccessibilityNodeInfosByText(key)) {
        val box = boundsOf(node) ?: continue
        if (!inside(box, area)) continue
        val state = PauseControl.stateOf(node.contentDescription?.toString())
        if (!PauseControl.shouldClick(state)) continue
        if (click(node)) return box
      }
    }
    return null
  }

  /** Taps the control [was] back when it now reads as paused. Used only for a control we clicked. */
  fun resume(root: AccessibilityNodeInfo, was: Box): Boolean {
    for (key in RESUME_KEYS) {
      for (node in root.findAccessibilityNodeInfosByText(key)) {
        val box = boundsOf(node) ?: continue
        if (!PauseControl.sameControl(was, box)) continue
        val state = PauseControl.stateOf(node.contentDescription?.toString())
        if (PauseControl.shouldRestore(weClicked = true, state = state) && click(node)) return true
      }
    }
    return false
  }

  private val RESUME_KEYS = listOf("Play", "Unmute", "Audio is muted", "Sound off")

  private fun inside(box: Box, area: Box): Boolean {
    val cx = (box.left + box.right) / 2
    val cy = (box.top + box.bottom) / 2
    return cx in area.left..area.right && cy in area.top..area.bottom
  }

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
}
