package com.algoastics.thumbwell.core.lock

import android.accessibilityservice.AccessibilityService
import android.annotation.SuppressLint
import android.content.res.ColorStateList
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.graphics.drawable.RippleDrawable
import android.os.Build
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.algoastics.thumbwell.core.R

/** What the overlay shows; the strings come from resources so night values apply. */
data class LockContent(val limit: Int, val today: Int, val untilLabel: String)

/**
 * S22-P0 lock screen drawn by the accessibility service as a TYPE_ACCESSIBILITY_OVERLAY window
 * (no SYSTEM_ALERT_WINDOW). Covers the [Box] it is given plus a see-through, touch-absorbing strip above it (one
 * window, see [LockFrame]); it is touchable (the button works, every swipe underneath is blocked) but never takes focus, so the system BACK gesture and the keyboard
 * keep working. Main thread only; [show] and [hide] are idempotent. Colours and strings are
 * resources (values and values-night), matching the Figma light and dark frames. The mascot is
 * the fried Thumb. Fonts are the system sans (Nunito and Inter are loaded by JS only).
 */
class LockOverlay(private val service: AccessibilityService, private val onLeave: () -> Unit) {
  private val windowManager = service.getSystemService(WindowManager::class.java)
  private val density = service.resources.displayMetrics.density
  private var root: View? = null
  private var shownFrame: LockFrame? = null
  private val statusBarPx: Int = run {
    val id = service.resources.getIdentifier("status_bar_height", "dimen", "android")
    if (id > 0) service.resources.getDimensionPixelSize(id) else 0
  }
  private var shownContent: LockContent? = null
  private var title: TextView? = null
  private var body: TextView? = null
  private var today: TextView? = null
  private var leave: Button? = null

  val isShown: Boolean get() = root != null

  fun show(box: Box, content: LockContent) {
    val frame = LockFrame.of(box, if (statusBarPx > 0) statusBarPx else dp(STATUS_BAR_FALLBACK_DP))
    val existing = root
    if (existing != null) {
      if (frame != shownFrame) {
        try {
          windowManager.updateViewLayout(existing, params(frame))
          arrange(existing, frame)
          shownFrame = frame
        } catch (e: Exception) {
          Log.w(TAG, "overlay relayout failed: ${e.javaClass.simpleName}")
          hide()
          return
        }
      }
      bind(content)
      return
    }
    val view = build(frame)
    try {
      windowManager.addView(view, params(frame))
    } catch (e: Exception) {
      // Never leave a half-added view behind; the lock simply does not show this time.
      Log.w(TAG, "overlay add failed: ${e.javaClass.simpleName}")
      return
    }
    root = view
    shownFrame = frame
    bind(content)
  }

  /** Updates the numbers on a shown overlay. */
  fun bind(content: LockContent) {
    if (content == shownContent && root != null) return
    shownContent = content
    title?.text = service.resources.getQuantityString(
      R.plurals.thumbwell_lock_title, content.limit, content.limit)
    body?.text = service.getString(R.string.thumbwell_lock_body, content.untilLabel)
    today?.text = service.resources.getQuantityString(
      R.plurals.thumbwell_lock_today, content.today, content.today)
  }

  fun setBusy(busy: Boolean) {
    leave?.isEnabled = !busy
    leave?.alpha = if (busy) 0.6f else 1f
  }

  fun hide() {
    val view = root ?: return
    root = null
    shownFrame = null
    shownContent = null
    title = null
    body = null
    today = null
    leave = null
    try {
      windowManager.removeViewImmediate(view)
    } catch (e: Exception) {
      Log.w(TAG, "overlay remove failed: ${e.javaClass.simpleName}")
    }
  }

  private fun params(frame: LockFrame): WindowManager.LayoutParams =
    WindowManager.LayoutParams(
      frame.window.width,
      frame.window.height,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      // No FLAG_LAYOUT_NO_LIMITS and no FLAG_NOT_TOUCHABLE: the window starts below the status bar
      // and every touch in it, including the see-through strip at the top, is absorbed. A window of
      // this type is drawn ABOVE the status bar and heads-up banners (layer 31 against 15 and 17):
      // a banner is visible through the transparent strip, but a touch on it lands on this window,
      // not on the banner.
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = frame.window.left
      y = frame.window.top
      title = "Thumbwell lock"
      // The box is in screen coordinates already; no system bar inset may move or shrink it.
      if (Build.VERSION.SDK_INT >= 30) setFitInsetsTypes(0)
    }

  /**
   * Positions the cover below the see-through strip and shapes it. Square when the lock fills the
   * reels edge to edge. When a free strip is left above it the top corners are rounded, so the
   * strip reads as a deliberate edge, not a gap.
   */
  private fun arrange(view: View, frame: LockFrame) {
    val cover = view.findViewWithTag<View>(COVER_TAG) ?: return
    (cover.layoutParams as FrameLayout.LayoutParams).topMargin = frame.strip
    cover.requestLayout()
    val radius = if (frame.cover.top > 0) dp(TOP_RADIUS_DP).toFloat() else 0f
    cover.background = GradientDrawable().apply {
      setColor(color(R.color.thumbwell_lock_bg))
      cornerRadii = floatArrayOf(radius, radius, radius, radius, 0f, 0f, 0f, 0f)
    }
  }

  private fun dp(value: Int): Int = (value * density + 0.5f).toInt()

  private fun color(id: Int): Int = service.getColor(id)

  @SuppressLint("ClickableViewAccessibility")
  private fun build(lockFrame: LockFrame): View {
    val box = lockFrame.cover
    val frame = FrameLayout(service).apply {
      // The window's own surface is transparent; the cover below draws the colour. Every touch
      // that no child handles (the strip, the cover's empty areas) ends here and is consumed.
      setOnTouchListener { _, _ -> true }
      clipChildren = false
      clipToPadding = false
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
      if (Build.VERSION.SDK_INT >= 28) {
        accessibilityPaneTitle = service.getString(R.string.thumbwell_lock_chip)
      }
    }
    val cover = FrameLayout(service).apply { tag = COVER_TAG }
    val column = LinearLayout(service).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(24), dp(32), dp(24), dp(32))
    }
    val bodyColumn = LinearLayout(service).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
    }
    // The mascot shrinks on short surfaces (split windows, landscape) so the button stays visible.
    val mascotHeight = minOf(dp(243), box.height * 28 / 100)
    bodyColumn.addView(
      ImageView(service).apply {
        setImageResource(R.drawable.thumbwell_lock_fried)
        scaleType = ImageView.ScaleType.FIT_CENTER
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
      },
      LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, mascotHeight),
    )
    bodyColumn.addView(
      text(service.getString(R.string.thumbwell_lock_chip), 14f, Typeface.create("sans-serif-medium", Typeface.NORMAL),
        R.color.thumbwell_lock_chip_text).apply {
        background = GradientDrawable().apply {
          cornerRadius = dp(999).toFloat()
          setColor(color(R.color.thumbwell_lock_chip_bg))
        }
        setPadding(dp(16), dp(4), dp(16), dp(4))
      },
      LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(8)
      },
    )
    val titleView = text(service.resources.getQuantityString(R.plurals.thumbwell_lock_title, 0, 0), 30f, Typeface.create("sans-serif", Typeface.BOLD),
      R.color.thumbwell_lock_title_text).apply {
      if (Build.VERSION.SDK_INT >= 28) isAccessibilityHeading = true
      accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
    }
    bodyColumn.addView(titleView, spaced(16))
    val bodyView = text(service.getString(R.string.thumbwell_lock_body), 16f, Typeface.SANS_SERIF, R.color.thumbwell_lock_body_text)
    bodyColumn.addView(bodyView, spaced(16))
    column.addView(bodyColumn, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

    val button = Button(service).apply {
      text = service.getString(R.string.thumbwell_lock_leave)
      contentDescription = service.getString(R.string.thumbwell_lock_leave)
      isAllCaps = false
      stateListAnimator = null
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
      typeface = Typeface.create("sans-serif", Typeface.BOLD)
      setTextColor(color(R.color.thumbwell_lock_button_text))
      background = buttonBackground()
      setPadding(0, 0, 0, dp(4))
      setOnClickListener { onLeave() }
    }
    column.addView(button, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56)).apply {
      topMargin = dp(16)
    })
    val todayView = text(service.resources.getQuantityString(R.plurals.thumbwell_lock_today, 0, 0), 12f, Typeface.create("sans-serif-medium", Typeface.NORMAL),
      R.color.thumbwell_lock_muted_text)
    column.addView(todayView, spaced(12))
    cover.addView(column, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    frame.addView(cover, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

    title = titleView
    body = bodyView
    today = todayView
    leave = button
    arrange(frame, lockFrame)
    return frame
  }

  private fun text(label: String, sp: Float, face: Typeface, colorId: Int) = TextView(service).apply {
    text = label
    setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
    typeface = face
    setTextColor(color(colorId))
    gravity = Gravity.CENTER
  }

  private fun spaced(topDp: Int) =
    LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
      topMargin = dp(topDp)
    }

  /** Face on a darker 4dp edge, radius 16dp (Figma Button), with a ripple for press feedback. */
  private fun buttonBackground(): RippleDrawable {
    val radius = dp(16).toFloat()
    val edge = GradientDrawable().apply {
      cornerRadius = radius
      setColor(color(R.color.thumbwell_lock_button_edge))
    }
    val face = GradientDrawable().apply {
      cornerRadius = radius
      setColor(color(R.color.thumbwell_lock_button_face))
    }
    val layers = LayerDrawable(arrayOf(edge, face)).apply { setLayerInset(1, 0, 0, 0, dp(4)) }
    return RippleDrawable(ColorStateList.valueOf(0x33FFFFFF), layers, null)
  }

  private companion object {
    const val TAG = "ThumbwellLock"
    const val TOP_RADIUS_DP = 20
    const val COVER_TAG = "thumbwell-lock-cover"
    const val STATUS_BAR_FALLBACK_DP = OverlayGuard.STATUS_BAR_FALLBACK_DP
  }
}
