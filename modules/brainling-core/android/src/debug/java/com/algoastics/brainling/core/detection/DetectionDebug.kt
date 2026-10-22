package com.algoastics.brainling.core.detection

import android.content.Context
import android.graphics.Rect
import android.os.Build
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Debug-build-only detection tools (this source set is not compiled into release; the release
 * twin is a no-op): the last detection, and the session capture. Once armed, the capture writes
 * the node tree of the first target-app window, then a rolling log of every accessibility event
 * from the target app (type, class, view id, bounds, scroll fields, routing verdict) plus a tree
 * snapshot at each count and page change, until stopped or a limit is hit. The debug screen
 * shares the file. Never reads node text; content descriptions are written only when they look
 * like internal component labels.
 */
object DetectionDebug {
  private const val MAX_NODES = 2_000
  private const val DIR = "brainling-layouts"
  private val COMPONENT_LABEL = Regex("^[A-Za-z][A-Za-z0-9]*(Spec|Component|View|Layout)[A-Za-z0-9_]*$")

  @Volatile private var last: DetectionInfo? = null
  @Volatile private var captureArmed = false
  @Volatile private var lastCapture: Map<String, Any?>? = null
  private const val MAX_EVENTS = 20_000
  private const val MAX_TREES = 60
  private const val MAX_SESSION_MS = 20 * 60 * 1000L
  private const val FLUSH_MS = 1_000L

  private var file: File? = null
  private var capturePackage: String? = null
  private val pending = StringBuilder()
  private var startedAtMs = 0L
  private var lastFlushMs = 0L
  private var events = 0
  private var trees = 0
  private var treeNodes = 0

  fun record(info: DetectionInfo) {
    last = info
  }

  /** Arms a session capture; it starts at the next target-app window the service evaluates. */
  @Synchronized
  fun armCapture(): Boolean {
    finish()
    captureArmed = true
    return true
  }

  /** Stops the running capture and writes what is buffered. */
  @Synchronized
  fun stopCapture(): Boolean {
    finish()
    return true
  }

  /** Starts the capture file with the first window's tree (the fixture format, first line on). */
  @Synchronized
  fun maybeCapture(context: Context, packageName: String, root: AccessibilityNodeInfo) {
    if (!captureArmed || file != null) {
      flushIfDue()
      return
    }
    val out = StringBuilder()
    val nodes = dump(root, out)
    val stamp = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())
    val dir = File(context.cacheDir, DIR).apply { mkdirs() }
    file = File(dir, "$packageName-$stamp.txt").apply { writeText("# $packageName nodes=$nodes\n$out") }
    capturePackage = packageName
    startedAtMs = SystemClock.elapsedRealtime()
    events = 0
    trees = 1
    treeNodes = nodes
    pending.append("\n## session log: t=ms since capture start; ids/classes/bounds only, no text\n")
    publish()
  }

  /** Appends one event line while a capture of [packageName] runs. */
  @Synchronized
  fun logEvent(context: Context, packageName: String, event: AccessibilityEvent, verdict: String) {
    if (!running(packageName)) return
    val source = event.source
    val bounds = Rect().also { source?.getBoundsInScreen(it) }
    val line = StringBuilder("E t=").append(SystemClock.elapsedRealtime() - startedAtMs)
      .append(' ').append(AccessibilityEvent.eventTypeToString(event.eventType))
      .append(" class=").append(event.className ?: "-")
      .append(" src=").append(source?.className ?: "-")
      .append(" id=").append(source?.viewIdResourceName ?: "-")
      .append(" bounds=").append(if (source == null) "-" else bounds.toShortString())
    if (event.eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED) {
      line.append(" from=").append(event.fromIndex).append(" to=").append(event.toIndex)
        .append(" count=").append(event.itemCount)
        .append(" scrollY=").append(event.scrollY).append('/').append(event.maxScrollY)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) line.append(" dY=").append(event.scrollDeltaY)
    }
    if (event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
      line.append(" changes=").append(event.contentChangeTypes)
    }
    line.append(" -> ").append(verdict)
    pending.append(line).append('\n')
    events++
    if (events >= MAX_EVENTS) finish() else flushIfDue()
  }

  /** Appends a tree snapshot (on a count or page change) while a capture of [packageName] runs. */
  @Synchronized
  fun treeSnapshot(context: Context, packageName: String, root: AccessibilityNodeInfo, reason: String) {
    if (!running(packageName) || trees >= MAX_TREES) return
    val out = StringBuilder()
    val nodes = dump(root, out)
    trees++
    treeNodes += nodes
    pending.append("## tree t=").append(SystemClock.elapsedRealtime() - startedAtMs)
      .append(" reason=").append(reason).append(" nodes=").append(nodes).append('\n').append(out)
    flush()
  }

  private fun running(packageName: String): Boolean {
    if (file == null || packageName != capturePackage) return false
    if (SystemClock.elapsedRealtime() - startedAtMs > MAX_SESSION_MS) {
      finish()
      return false
    }
    return true
  }

  private fun flushIfDue() {
    if (file != null && SystemClock.elapsedRealtime() - lastFlushMs >= FLUSH_MS) flush()
  }

  private fun flush() {
    val target = file ?: return
    if (pending.isNotEmpty()) {
      target.appendText(pending.toString())
      pending.setLength(0)
    }
    lastFlushMs = SystemClock.elapsedRealtime()
    publish()
  }

  private fun finish() {
    if (file != null) {
      pending.append("## end events=").append(events).append(" trees=").append(trees).append('\n')
      flush()
    }
    file = null
    capturePackage = null
    captureArmed = false
  }

  private fun publish() {
    val target = file ?: return
    lastCapture = mapOf(
      "path" to target.absolutePath,
      "packageName" to capturePackage,
      "nodes" to treeNodes,
      "events" to events,
      "trees" to trees,
      "recording" to true,
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
    "lastCapture" to lastCapture?.let { it + ("recording" to (file != null)) },
  )
}
