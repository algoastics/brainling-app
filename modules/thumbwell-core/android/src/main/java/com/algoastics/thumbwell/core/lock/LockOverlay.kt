package com.algoastics.thumbwell.core.lock

import android.accessibilityservice.AccessibilityService
import android.annotation.SuppressLint
import android.content.res.ColorStateList
import android.hardware.display.DisplayManager
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.graphics.drawable.RippleDrawable
import android.os.Build
import android.util.Log
import android.util.TypedValue
import android.view.Display
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
 * S22-P0 lock screen drawn by the accessibility service in ONE window of a [LockWindowKind]:
 * TYPE_APPLICATION_OVERLAY when "Display over other apps" is granted (edge to edge, opaque, below
 * banners), else the TYPE_ACCESSIBILITY_OVERLAY fallback with a see-through, touch-absorbing strip
 * above the cover (see [LockFrame]). The window is touchable (the button works, every swipe
 * underneath is blocked) but never takes focus, so the system BACK gesture and the keyboard keep
 * working. Main thread only; [hide] is idempotent. Colours and strings are resources (values and
 * values-night), matching the Figma light and dark frames. The mascot is the fried Thumb. Fonts are
 * the system sans (Nunito and Inter are loaded by JS only).
 */
class LockOverlay(private val service: AccessibilityService, private val onLeave: () -> Unit) {
  private val windowManager = service.getSystemService(WindowManager::class.java)
  private val density = service.resources.displayMetrics.density
  private var root: View? = null
  private var shownFrame: LockFrame? = null
  private var shownKind: LockWindowKind? = null
  private var shownWm: WindowManager? = null
  private var appWindowManager: WindowManager? = null
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

  /**
   * Shows the lock in [frame] as a window of [kind], or moves the shown one. When the kind changes
   * (the permission was granted or revoked) the old window is removed first, so exactly one window
   * exists. Returns true when the lock is on screen afterwards; false when the add was refused (no
   * permission, bad token), in which case nothing is left behind.
   */
  fun show(frame: LockFrame, kind: LockWindowKind, content: LockContent): Boolean {
    if (root != null && shownKind != kind) hide()
    val existing = root
    val wm = shownWm
    if (existing != null && wm != null) {
      if (frame != shownFrame) {
        try {
          wm.updateViewLayout(existing, params(frame, kind, wm))
          arrange(existing, frame, kind)
          shownFrame = frame
        } catch (e: Exception) {
          Log.w(TAG, "overlay relayout failed: ${e.javaClass.simpleName}")
          hide()
          return false
        }
      }
      bind(content)
      return true
    }
    val manager = windowManagerFor(kind)
    val view = build(frame, kind)
    try {
      manager.addView(view, params(frame, kind, manager))
    } catch (e: Exception) {
      // Never leave a half-added view behind; the lock simply does not show this time.
      Log.w(TAG, "overlay add failed: kind=$kind ${e.javaClass.simpleName}")
      clearViews()
      return false
    }
    root = view
    shownWm = manager
    shownKind = kind
    shownFrame = frame
    bind(content)
    return true
  }

  /** The window type of the shown lock, or null. */
  val kind: LockWindowKind? get() = shownKind

  /**
   * The WindowManager each type is added through. The accessibility overlay uses the service's own
   * (it carries the service's window token). The application overlay must not carry that token: it
   * uses a window context of its own type on API 30+, the application context before.
   */
  private fun windowManagerFor(kind: LockWindowKind): WindowManager {
    if (kind == LockWindowKind.ACCESSIBILITY_OVERLAY) return windowManager
    appWindowManager?.let { return it }
    val created = try {
      if (Build.VERSION.SDK_INT >= 30) {
        val display = service.getSystemService(DisplayManager::class.java).getDisplay(Display.DEFAULT_DISPLAY)
        service.createWindowContext(display, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY, null)
          .getSystemService(WindowManager::class.java)
      } else {
        service.applicationContext.getSystemService(WindowManager::class.java)
      }
    } catch (e: Exception) {
      Log.w(TAG, "window context failed: ${e.javaClass.simpleName}")
      service.applicationContext.getSystemService(WindowManager::class.java)
    }
    appWindowManager = created
    return created
  }

  private fun clearViews() {
    title = null
    body = null
    today = null
    leave = null
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
    val wm = shownWm
    root = null
    shownWm = null
    shownKind = null
    shownFrame = null
    shownContent = null
    clearViews()
    try {
      wm?.removeViewImmediate(view)
    } catch (e: Exception) {
      Log.w(TAG, "overlay remove failed: ${e.javaClass.simpleName}")
    }
  }

  private fun params(frame: LockFrame, kind: LockWindowKind, wm: WindowManager): WindowManager.LayoutParams {
    val window = clamp(frame.window, wm)
    val application = kind == LockWindowKind.APPLICATION_OVERLAY
    return WindowManager.LayoutParams(
      window.width,
      window.height,
      if (application) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
      },
      // Never FLAG_NOT_TOUCHABLE: the lock absorbs every touch. APPLICATION_OVERLAY (layer 11, below
      // banners at 17, status bar 15 and navigation bar 24) goes edge to edge, opaque, with
      // NO_LIMITS and cutout ALWAYS so it starts at y=0. ACCESSIBILITY_OVERLAY (layer 31, ABOVE
      // banners) starts below the status bar and has no NO_LIMITS: its see-through strip at the top
      // absorbs touches ([LockFrame]); a banner is visible through it but not tappable.
      if (application) {
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
          WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
          WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
          WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
      } else {
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
          WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
      },
      if (application) PixelFormat.OPAQUE else PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = window.left
      y = window.top
      title = "Thumbwell lock"
      // The frame is in screen coordinates already; no system bar inset may move or shrink it.
      if (Build.VERSION.SDK_INT >= 30) setFitInsetsTypes(0)
      if (application) {
        layoutInDisplayCutoutMode = if (Build.VERSION.SDK_INT >= 30) {
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
        } else if (Build.VERSION.SDK_INT >= 28) {
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        } else {
          layoutInDisplayCutoutMode
        }
      }
    }
  }

  /** The frame never leaves the screen: clamped to the maximum window bounds (API 30+) or the display. */
  private fun clamp(window: Box, wm: WindowManager): Box {
    val bounds = if (Build.VERSION.SDK_INT >= 30) {
      wm.maximumWindowMetrics.bounds
    } else {
      null
    }
    val w = bounds?.width() ?: service.resources.displayMetrics.widthPixels
    val h = bounds?.height() ?: service.resources.displayMetrics.heightPixels
    val box = window.clampTo(w, h)
    return if (box.width > 0 && box.height > 0) box else window
  }

  /**
   * Positions the cover below the see-through strip and shapes it. Square when the lock fills the
   * reels edge to edge. When a free strip is left above it the top corners are rounded, so the
   * strip reads as a deliberate edge, not a gap.
   */
  private fun arrange(view: View, frame: LockFrame, kind: LockWindowKind) {
    val cover = view.findViewWithTag<View>(COVER_TAG) ?: return
    (cover.layoutParams as FrameLayout.LayoutParams).topMargin = frame.strip
    cover.requestLayout()
    val rounded = kind == LockWindowKind.ACCESSIBILITY_OVERLAY && frame.strip > 0
    val radius = if (rounded) dp(TOP_RADIUS_DP).toFloat() else 0f
    cover.background = GradientDrawable().apply {
      setColor(color(R.color.thumbwell_lock_bg))
      cornerRadii = floatArrayOf(radius, radius, radius, radius, 0f, 0f, 0f, 0f)
    }
  }

  private fun dp(value: Int): Int = (value * density + 0.5f).toInt()

  private fun color(id: Int): Int = service.getColor(id)

  @SuppressLint("ClickableViewAccessibility")
  private fun build(lockFrame: LockFrame, kind: LockWindowKind): View {
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
    // Figma S22 Content: 16 dp side margin, 12 dp above the first block (the application overlay
    // also starts behind the status bar, so that inset is added), 32 dp below the last one.
    val topInset = if (kind == LockWindowKind.APPLICATION_OVERLAY) statusBarPx else 0
    val column = LinearLayout(service).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(16), topInset + dp(12), dp(16), dp(32))
    }
    val top = LinearLayout(service).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
      setPadding(0, dp(16), 0, 0)
    }
    // Thumb fried is 183.6 x 206.55 dp (Figma); it shrinks on short surfaces (split windows,
    // landscape) so the button stays visible.
    val mascotHeight = minOf(dp(MASCOT_HEIGHT_DP), box.height * 30 / 100)
    top.addView(
      ImageView(service).apply {
        setImageResource(R.drawable.thumbwell_lock_fried)
        scaleType = ImageView.ScaleType.FIT_CENTER
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
      },
      LinearLayout.LayoutParams(mascotHeight * 8 / 9, mascotHeight),
    )
    top.addView(chip(), LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
      topMargin = dp(16)
    })
    val titleView = text(service.resources.getQuantityString(R.plurals.thumbwell_lock_title, 0, 0), 24f, nunitoExtraBold,
      R.color.thumbwell_lock_title_text, 30, HEADING_FONT_CAP, -0.5f).apply {
      if (Build.VERSION.SDK_INT >= 28) isAccessibilityHeading = true
      accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
    }
    top.addView(titleView, spaced(16))
    val bodyView = text(service.getString(R.string.thumbwell_lock_body), 14f, interRegular,
      R.color.thumbwell_lock_body_text, 20, BODY_FONT_CAP)
    top.addView(bodyView, spaced(16))
    column.addView(top, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

    column.addView(pausedNote(), spaced(0))
    val button = Button(service).apply {
      text = service.getString(R.string.thumbwell_lock_leave)
      contentDescription = service.getString(R.string.thumbwell_lock_leave)
      isAllCaps = false
      stateListAnimator = null
      includeFontPadding = false
      setTextSize(TypedValue.COMPLEX_UNIT_PX, scaledPx(15f, HEADING_FONT_CAP))
      letterSpacing = 0.5f / 15f
      typeface = nunitoExtraBold
      setTextColor(color(R.color.thumbwell_lock_button_text))
      background = buttonBackground()
      setPadding(0, 0, 0, dp(4))
      setOnClickListener { onLeave() }
    }
    column.addView(button, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56)).apply {
      topMargin = dp(12)
    })
    val todayView = text(service.resources.getQuantityString(R.plurals.thumbwell_lock_today, 0, 0), 12f, interMedium,
      R.color.thumbwell_lock_muted_text, 16, BODY_FONT_CAP)
    column.addView(todayView, spaced(12))
    cover.addView(column, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    frame.addView(cover, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

    title = titleView
    body = bodyView
    today = todayView
    leave = button
    arrange(frame, lockFrame, kind)
    return frame
  }

  /** Bundled fonts (module assets); the system sans stands in when one fails to load. */
  private fun font(asset: String, fallback: Typeface): Typeface = try {
    Typeface.createFromAsset(service.assets, "fonts/$asset.ttf")
  } catch (e: RuntimeException) {
    fallback
  }

  private val nunitoExtraBold: Typeface by lazy { font("nunito_extrabold", Typeface.create("sans-serif", Typeface.BOLD)) }
  private val interRegular: Typeface by lazy { font("inter_regular", Typeface.SANS_SERIF) }
  private val interMedium: Typeface by lazy { font("inter_medium", Typeface.create("sans-serif-medium", Typeface.NORMAL)) }
  private val interSemiBold: Typeface by lazy { font("inter_semibold", Typeface.create("sans-serif-medium", Typeface.NORMAL)) }

  /** sp to px with the user's font scale capped (headings 1.2, body 1.3 as in the app tokens). */
  private fun scaledPx(sp: Float, cap: Float): Float {
    val scale = minOf(service.resources.configuration.fontScale, cap)
    return sp * scale * density
  }

  private fun text(
    label: String,
    sp: Float,
    face: Typeface,
    colorId: Int,
    lineDp: Int,
    cap: Float,
    trackingPx: Float = 0f,
  ) = TextView(service).apply {
    text = label
    includeFontPadding = false
    setTextSize(TypedValue.COMPLEX_UNIT_PX, scaledPx(sp, cap))
    val line = (lineDp * density * minOf(service.resources.configuration.fontScale, cap) + 0.5f).toInt()
    if (Build.VERSION.SDK_INT >= 28) {
      lineHeight = line
    } else {
      setLineSpacing((line - paint.getFontMetricsInt(null)).toFloat(), 1f)
    }
    letterSpacing = trackingPx / sp
    typeface = face
    setTextColor(color(colorId))
    gravity = Gravity.CENTER
  }

  /** Status chip: surface-2 pill, 1.5 dp border, 8 dp warn dot, 13/18 semibold label. */
  private fun chip(): View {
    val row = LinearLayout(service).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(16), dp(8), dp(16), dp(8))
      background = GradientDrawable().apply {
        cornerRadius = dp(999).toFloat()
        setColor(color(R.color.thumbwell_lock_chip_bg))
        setStroke((CHIP_BORDER_DP * density + 0.5f).toInt(), color(R.color.thumbwell_lock_chip_border))
      }
    }
    row.addView(
      View(service).apply {
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        background = GradientDrawable().apply {
          shape = GradientDrawable.OVAL
          setColor(color(R.color.thumbwell_lock_chip_dot))
        }
      },
      LinearLayout.LayoutParams(dp(8), dp(8)).apply { marginEnd = dp(8) },
    )
    row.addView(
      text(service.getString(R.string.thumbwell_lock_chip), 13f, interSemiBold, R.color.thumbwell_lock_chip_text, 18, BODY_FONT_CAP),
    )
    return row
  }

  /** Paused note (Figma component): primary-soft card, 16 dp radius, pause icon, title and body. */
  private fun pausedNote(): View {
    val row = LinearLayout(service).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(16), dp(12), dp(16), dp(12))
      background = GradientDrawable().apply {
        cornerRadius = dp(16).toFloat()
        setColor(color(R.color.thumbwell_lock_note_bg))
        setStroke(dp(1), color(R.color.thumbwell_lock_note_border))
      }
    }
    row.addView(
      ImageView(service).apply {
        setImageResource(R.drawable.ic_lock_pause)
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
      },
      LinearLayout.LayoutParams(dp(24), dp(24)).apply { marginEnd = dp(12) },
    )
    val words = LinearLayout(service).apply { orientation = LinearLayout.VERTICAL }
    words.addView(
      text(service.getString(R.string.thumbwell_lock_note_title), 13f, interSemiBold, R.color.thumbwell_lock_title_text, 18, BODY_FONT_CAP).apply {
        gravity = Gravity.START
      },
      LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT),
    )
    words.addView(
      text(service.getString(R.string.thumbwell_lock_note_body), 14f, interRegular, R.color.thumbwell_lock_body_text, 20, BODY_FONT_CAP).apply {
        gravity = Gravity.START
      },
      spaced(2),
    )
    row.addView(words, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    return row
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
    const val MASCOT_HEIGHT_DP = 207
    const val CHIP_BORDER_DP = 1.5f
    const val HEADING_FONT_CAP = 1.2f
    const val BODY_FONT_CAP = 1.3f
    const val STATUS_BAR_FALLBACK_DP = OverlayGuard.STATUS_BAR_FALLBACK_DP
  }
}
