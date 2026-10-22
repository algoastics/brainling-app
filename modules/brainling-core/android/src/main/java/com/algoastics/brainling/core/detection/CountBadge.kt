package com.algoastics.brainling.core.detection

import android.accessibilityservice.AccessibilityService
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.WindowManager
import android.widget.TextView

/** Badge labels per rule key (pure; unit-tested). */
object BadgeText {
  private val LABELS = mapOf(
    "instagram" to "Instagram Reels",
    "youtube" to "YouTube Shorts",
    "tiktok" to "TikTok",
    "tiktok_lite" to "TikTok Lite",
    "facebook" to "Facebook Reels",
    "facebook_lite" to "Facebook Reels",
    "snapchat" to "Snapchat Spotlight",
  )

  fun label(appKey: String): String = LABELS[appKey] ?: appKey

  fun format(appKey: String, count: Int): String = "${label(appKey)} · $count"
}

/**
 * Tester-only live count pill drawn by the accessibility service itself
 * (TYPE_ACCESSIBILITY_OVERLAY: no SYSTEM_ALERT_WINDOW, no foreground service). Top centre, below
 * the status bar, never touchable or focusable. Main thread only. Shown while a reels surface is
 * on screen; [show] with the same key and count does nothing, so per-event cost is nil.
 */
class CountBadge(private val service: AccessibilityService) {
  private val windowManager = service.getSystemService(WindowManager::class.java)
  private var view: TextView? = null
  private var shownText: String? = null

  val isShown: Boolean get() = view != null

  fun show(appKey: String, count: Int) {
    val text = BadgeText.format(appKey, count)
    if (text == shownText && view != null) return
    val existing = view
    if (existing != null) {
      existing.text = text
      shownText = text
      return
    }
    val pill = createView(text)
    try {
      windowManager.addView(pill, layoutParams())
      view = pill
      shownText = text
    } catch (e: WindowManager.BadTokenException) {
      Log.w(TAG, "badge add failed: ${e.javaClass.simpleName}")
    } catch (e: IllegalStateException) {
      Log.w(TAG, "badge add failed: ${e.javaClass.simpleName}")
    }
  }

  fun hide() {
    val existing = view ?: return
    view = null
    shownText = null
    try {
      windowManager.removeViewImmediate(existing)
    } catch (e: IllegalArgumentException) {
      Log.w(TAG, "badge remove failed: ${e.javaClass.simpleName}")
    }
  }

  private fun createView(text: String): TextView {
    val density = service.resources.displayMetrics.density
    return TextView(service).apply {
      this.text = text
      setTextColor(0xFFFFFFFF.toInt())
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
      typeface = Typeface.DEFAULT_BOLD
      val h = (14 * density).toInt()
      val v = (6 * density).toInt()
      setPadding(h, v, h, v)
      background = GradientDrawable().apply {
        setColor(BRAND_VIOLET)
        cornerRadius = 999f * density
      }
      importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
  }

  private fun layoutParams(): WindowManager.LayoutParams {
    val res = service.resources
    val statusId = res.getIdentifier("status_bar_height", "dimen", "android")
    val statusBar = if (statusId > 0) res.getDimensionPixelSize(statusId) else 0
    return WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
      y = statusBar + (8 * res.displayMetrics.density).toInt()
    }
  }

  companion object {
    private const val TAG = "BrainlingBadge"
    private const val BRAND_VIOLET = 0xFF6B4EFF.toInt()
  }
}
