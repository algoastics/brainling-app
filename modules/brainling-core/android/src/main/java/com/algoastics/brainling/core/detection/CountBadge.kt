package com.algoastics.brainling.core.detection

import android.accessibilityservice.AccessibilityService
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.TransitionDrawable
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.algoastics.brainling.core.R
import java.util.Random

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
 * Tester-only live overlay drawn by the accessibility service itself (TYPE_ACCESSIBILITY_OVERLAY:
 * no SYSTEM_ALERT_WINDOW, no foreground service): the Brainling mascot (96dp) with the current
 * platform's reel count in a small pill under it. Its mood follows [MascotMoods]. Top centre,
 * below the status bar, never touchable or focusable. Main thread only. Shown while a reels
 * surface is on screen; [show] with the same key and count does nothing, so per-event cost is nil.
 * Temporary internal design.
 *
 * The window has an explicit size (mascot plus a little padding), NOT wrap_content, and every view
 * sets clipChildren/clipToPadding = false, so nothing is clipped. The mascot is static: the only
 * motion is the eye blink ([MascotMotion] timing per mood: open round eyes, a flat-lid frame for a
 * moment, open again) and a plain cross-fade when the mood changes. The blink runs on one Handler;
 * [hide] removes every pending callback.
 */
class CountBadge(private val service: AccessibilityService) {
  private val windowManager = service.getSystemService(WindowManager::class.java)
  private val density = service.resources.displayMetrics.density
  private val handler = Handler(Looper.getMainLooper())
  private val random = Random()
  private var root: LinearLayout? = null
  private var image: ImageView? = null
  private var countText: TextView? = null
  private var openFrame: Drawable? = null
  private var closedFrame: Drawable? = null
  private var fadeActive = false
  private var secondBlink = false
  private var pendingSecondBlink = false
  private var shownKey: String? = null
  private var shownCount = 0
  private var shownMood: MascotMood? = null

  val isShown: Boolean get() = root != null

  fun show(appKey: String, count: Int) {
    val mood = MascotMoods.forCount(count)
    val existing = root
    if (existing != null) {
      if (appKey == shownKey && count == shownCount) return
      val previousMood = shownMood
      shownKey = appKey
      shownCount = count
      shownMood = mood
      countText?.text = count.toString()
      if (previousMood != mood) {
        crossFade(mood)
        applyMood(mood)
      }
      return
    }
    val created = createView(mood, count)
    try {
      windowManager.addView(created, layoutParams())
      root = created
      shownKey = appKey
      shownCount = count
      shownMood = mood
      applyMood(mood)
    } catch (e: WindowManager.BadTokenException) {
      Log.w(TAG, "badge add failed: ${e.javaClass.simpleName}")
      clearViews()
    } catch (e: IllegalStateException) {
      Log.w(TAG, "badge add failed: ${e.javaClass.simpleName}")
      clearViews()
    }
  }

  fun hide() {
    val existing = root ?: return
    stopBlink()
    clearViews()
    try {
      windowManager.removeViewImmediate(existing)
    } catch (e: IllegalArgumentException) {
      Log.w(TAG, "badge remove failed: ${e.javaClass.simpleName}")
    }
  }

  private fun clearViews() {
    root = null
    image = null
    countText = null
    openFrame = null
    closedFrame = null
    shownKey = null
    shownCount = 0
    shownMood = null
  }

  /** Removes every pending blink/fade callback (no leaks). */
  private fun stopBlink() {
    handler.removeCallbacksAndMessages(null)
    fadeActive = false
    secondBlink = false
    pendingSecondBlink = false
  }

  private fun dp(value: Float): Int = (value * density).toInt()

  private fun frameDrawable(mood: MascotMood, closed: Boolean): Drawable? =
    service.getDrawable(
      when (mood) {
        MascotMood.GLOWING ->
          if (closed) R.drawable.brainling_mascot_glowing_blink else R.drawable.brainling_mascot_glowing
        MascotMood.HAPPY ->
          if (closed) R.drawable.brainling_mascot_happy_blink else R.drawable.brainling_mascot_happy
        MascotMood.MEH ->
          if (closed) R.drawable.brainling_mascot_meh_blink else R.drawable.brainling_mascot_meh
        MascotMood.FRIED ->
          if (closed) R.drawable.brainling_mascot_fried_blink else R.drawable.brainling_mascot_fried
        MascotMood.ZOMBIE ->
          if (closed) R.drawable.brainling_mascot_zombie_blink else R.drawable.brainling_mascot_zombie
      },
    )

  private fun createView(mood: MascotMood, count: Int): LinearLayout {
    openFrame = frameDrawable(mood, closed = false)
    closedFrame = frameDrawable(mood, closed = true)
    val picture = ImageView(service).apply {
      setImageDrawable(openFrame)
      scaleType = ImageView.ScaleType.FIT_CENTER
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    val frame = FrameLayout(service).apply {
      clipChildren = false
      clipToPadding = false
      addView(picture, FrameLayout.LayoutParams(dp(MASCOT_DP), dp(MASCOT_DP)))
    }
    val number = TextView(service).apply {
      text = count.toString()
      setTextColor(0xFFFFFFFF.toInt())
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
      typeface = Typeface.DEFAULT_BOLD
      setPadding(dp(8f), dp(1f), dp(8f), dp(1f))
      background = GradientDrawable().apply {
        setColor(BRAND_VIOLET)
        cornerRadius = 999f * density
      }
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    val column = LinearLayout(service).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      clipChildren = false
      clipToPadding = false
      setPadding(dp(PAD_SIDE_DP), dp(PAD_TOP_DP), dp(PAD_SIDE_DP), dp(PAD_BOTTOM_DP))
      addView(frame, LinearLayout.LayoutParams(dp(MASCOT_DP), dp(MASCOT_DP)))
      addView(
        number,
        LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.WRAP_CONTENT,
          LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { topMargin = -dp(6f) },
      )
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    image = picture
    countText = number
    return column
  }

  /** Quick cross-fade from the current mood image to [mood]'s; blink frames follow the new mood. */
  private fun crossFade(mood: MascotMood) {
    val view = image ?: return
    val next = frameDrawable(mood, closed = false) ?: return
    val current = (view.drawable as? TransitionDrawable)?.getDrawable(1) ?: view.drawable
    openFrame = next
    closedFrame = frameDrawable(mood, closed = true)
    val fade = TransitionDrawable(arrayOf(current ?: next, next))
    view.setImageDrawable(fade)
    fade.isCrossFadeEnabled = true
    fade.startTransition(FADE_MS)
    fadeActive = true
    handler.removeCallbacks(fadeDone)
    handler.postDelayed(fadeDone, FADE_MS + 40L)
  }

  private val fadeDone: Runnable = Runnable {
    fadeActive = false
    image?.setImageDrawable(openFrame)
  }

  /** (Re)starts the blink schedule for [mood] (its timing differs per mood). */
  private fun applyMood(mood: MascotMood) {
    handler.removeCallbacks(blinkClose)
    handler.removeCallbacks(blinkOpen)
    secondBlink = false
    pendingSecondBlink = false
    scheduleBlink(mood)
  }

  private fun scheduleBlink(mood: MascotMood) {
    handler.postDelayed(blinkClose, MascotMotion.nextBlinkDelayMs(mood, random.nextDouble()))
  }

  private val blinkClose: Runnable = Runnable {
    val mood = shownMood ?: return@Runnable
    if (!fadeActive) image?.setImageDrawable(closedFrame)
    pendingSecondBlink = !secondBlink && MascotMotion.isDoubleBlink(mood, random.nextDouble())
    handler.postDelayed(blinkOpen, MascotMotion.blink(mood).closeMs)
  }

  private val blinkOpen: Runnable = Runnable {
    val mood = shownMood ?: return@Runnable
    if (!fadeActive) image?.setImageDrawable(openFrame)
    if (pendingSecondBlink) {
      pendingSecondBlink = false
      secondBlink = true
      handler.postDelayed(blinkClose, MascotMotion.DOUBLE_BLINK_GAP_MS)
    } else {
      secondBlink = false
      scheduleBlink(mood)
    }
  }

  private fun layoutParams(): WindowManager.LayoutParams {
    val res = service.resources
    val statusId = res.getIdentifier("status_bar_height", "dimen", "android")
    val statusBar = if (statusId > 0) res.getDimensionPixelSize(statusId) else 0
    return WindowManager.LayoutParams(
      // Explicit size: sized for the mascot and the pill, not for content.
      dp(MASCOT_DP + 2 * PAD_SIDE_DP),
      dp(WINDOW_HEIGHT_DP),
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
      y = statusBar + dp(8f)
    }
  }

  companion object {
    private const val TAG = "BrainlingBadge"
    private const val BRAND_VIOLET = 0xFF6B4EFF.toInt()
    private const val MASCOT_DP = 96f
    private const val PAD_TOP_DP = 8f
    private const val PAD_SIDE_DP = 8f
    private const val PAD_BOTTOM_DP = 8f
    // pad + mascot + pill (about 20dp, -6dp overlap, extra for large fonts) + pad.
    private const val WINDOW_HEIGHT_DP = PAD_TOP_DP + MASCOT_DP + 28f + PAD_BOTTOM_DP
    private const val FADE_MS = 220
  }
}
