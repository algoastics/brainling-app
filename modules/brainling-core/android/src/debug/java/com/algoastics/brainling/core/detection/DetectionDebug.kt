package com.algoastics.brainling.core.detection

import android.content.Context
import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Debug-build-only detection tools (this source set is not compiled into release; the release
 * twin is a no-op): the last detection, and the capture-layout tool that writes the node tree of
 * the next observed target-app window to a file the debug screen can share. Never reads node
 * text; content descriptions are written only when they look like internal component labels.
 */
object DetectionDebug {
  private const val MAX_NODES = 2_000
  private const val DIR = "brainling-layouts"
  private val COMPONENT_LABEL = Regex("^[A-Za-z][A-Za-z0-9]*(Spec|Component|View|Layout)[A-Za-z0-9_]*$")

  @Volatile private var last: DetectionInfo? = null
  @Volatile private var captureArmed = false
  @Volatile private var lastCapture: Map<String, Any?>? = null

  fun record(info: DetectionInfo) {
    last = info
  }

  /** Arms a one-shot capture of the next target-app window the service evaluates. */
  fun armCapture(): Boolean {
    captureArmed = true
    return true
  }

  fun maybeCapture(context: Context, packageName: String, root: AccessibilityNodeInfo) {
    if (!captureArmed) return
    captureArmed = false
    val out = StringBuilder()
    val nodes = dump(root, out)
    val stamp = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())
    val dir = File(context.cacheDir, DIR).apply { mkdirs() }
    val file = File(dir, "$packageName-$stamp.txt")
    file.writeText("# $packageName nodes=$nodes\n$out")
    lastCapture = mapOf(
      "path" to file.absolutePath,
      "packageName" to packageName,
      "nodes" to nodes,
      "atMs" to System.currentTimeMillis().toDouble(),
    )
  }

  /** Depth-first dump: class, view id, bounds and flags per node, indented by depth. */
  private fun dump(root: AccessibilityNodeInfo, out: StringBuilder): Int {
    val stack = ArrayDeque<Pair<AccessibilityNodeInfo, Int>>().apply { addLast(root to 0) }
    var count = 0
    val bounds = Rect()
    while (stack.isNotEmpty() && count < MAX_NODES) {
      val (node, depth) = stack.removeLast()
      count++
      node.getBoundsInScreen(bounds)
      out.append("  ".repeat(depth))
        .append(node.className ?: "?")
        .append(" id=").append(node.viewIdResourceName ?: "-")
        .append(" bounds=").append(bounds.toShortString())
      if (node.isVisibleToUser) out.append(" visible")
      if (node.isScrollable) out.append(" scrollable")
      if (node.isClickable) out.append(" clickable")
      if (node.isLongClickable) out.append(" longClickable")
      node.contentDescription?.toString()?.takeIf(COMPONENT_LABEL::matches)?.let {
        out.append(" desc=").append(it)
      }
      out.append('\n')
      for (i in node.childCount - 1 downTo 0) node.getChild(i)?.let { stack.addLast(it to depth + 1) }
    }
    return count
  }

  fun snapshot(): Map<String, Any?> = mapOf(
    "serviceConnected" to BrainlingAccessibilityService.connected,
    "last" to last?.toMap(),
    "captureArmed" to captureArmed,
    "lastCapture" to lastCapture,
  )
}
