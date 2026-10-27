package com.algoastics.thumbwell.core.lock

import android.accessibilityservice.AccessibilityService
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
 * (no SYSTEM_ALERT_WINDOW). Covers the [Box] it is given, is touchable (the button works, swipes
 * underneath are blocked) but never takes focus, so the system BACK gesture and the keyboard
 * keep working. Main thread only; [show] and [hide] are idempotent. Colours and strings are
 * resources (values and values-night), matching the Figma light and dark frames. The mascot is
 * the fried Thumb. Fonts are the system sans (Nunito and Inter are loaded by JS only).
 */
class LockOverlay(private val service: AccessibilityService, private val onLeave: () -> Unit) {
  private val windowManager = service.getSystemService(WindowManager::class.java)
  private val density = service.resources.displayMetrics.density
  private var root: View? = null
  private var shownBox: Box? = null
  private var shownContent: LockContent? = null
  private var title: TextView? = null
  private var body: TextView? = null
  private var today: TextView? = null
  private var leave: Button? = null

  val isShown: Boolean get() = root != null

  fun show(box: Box, content: LockContent) {
    val existing = root
    if (existing != null) {
      if (box != shownBox) {
        try {
          windowManager.updateViewLayout(existing, params(box))
          shownBox = box
        } catch (e: Exception) {
          Log.w(TAG, "overlay relayout failed: ${e.javaClass.simpleName}")
          hide()
          return
        }
      }
      bind(content)
      return
    }
    val view = build(box)
    try {
      windowManager.addView(view, params(box))
    } catch (e: Exception) {
      // Never leave a half-added view behind; the lock simply does not show this time.
      Log.w(TAG, "overlay add failed: ${e.javaClass.simpleName}")
      return
    }
    root = view
    shownBox = box
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
    shownBox = null
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

  private fun params(box: Box): WindowManager.LayoutParams =
    WindowManager.LayoutParams(
      box.width,
      box.height,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      // No FLAG_LAYOUT_NO_LIMITS: the window never extends past the screen or up into the free top
      // band (OverlayGuard.topBandPx), where heads-up notification banners show.
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = box.left
      y = box.top
      title = "Thumbwell lock"
    }

  private fun dp(value: Int): Int = (value * density + 0.5f).toInt()

  private fun color(id: Int): Int = service.getColor(id)

  private fun build(box: Box): View {
    val frame = FrameLayout(service).apply {
      setBackgroundColor(color(R.color.thumbwell_lock_bg))
      clipChildren = false
      clipToPadding = false
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
      if (Build.VERSION.SDK_INT >= 28) {
        accessibilityPaneTitle = service.getString(R.string.thumbwell_lock_chip)
      }
    }
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
    frame.addView(column, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

    title = titleView
    body = bodyView
    today = todayView
    leave = button
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
  }
}
