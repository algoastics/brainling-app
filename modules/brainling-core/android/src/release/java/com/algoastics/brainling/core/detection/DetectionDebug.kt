package com.algoastics.brainling.core.detection

import android.content.Context
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/** Release twin of the debug tools: records nothing, captures nothing, exposes nothing. */
object DetectionDebug {
  @Suppress("UNUSED_PARAMETER")
  fun record(info: DetectionInfo) = Unit

  fun armCapture(): Boolean = false

  @Suppress("UNUSED_PARAMETER")
  fun maybeCapture(context: Context, packageName: String, root: AccessibilityNodeInfo) = Unit

  fun stopCapture(): Boolean = false

  @Suppress("UNUSED_PARAMETER")
  fun logEvent(context: Context, packageName: String, event: AccessibilityEvent, verdict: String) = Unit

  @Suppress("UNUSED_PARAMETER")
  fun treeSnapshot(context: Context, packageName: String, root: AccessibilityNodeInfo, reason: String) = Unit

  fun snapshot(): Map<String, Any?>? = null
}
