package com.algoastics.brainling.core.detection

import android.accessibilityservice.AccessibilityService
import android.animation.Animator
import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.TransitionDrawable
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.algoastics.brainling.core.R

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
 * no SYSTEM_ALERT_WINDOW, no foreground service): the animated Brainling mascot (about 60dp) with
 * the current platform's reel count in a small pill under it. Its mood follows [MascotMoods].
 * Top centre, below the status bar, never touchable or focusable. Main thread only. Shown while a
 * reels surface is on screen; [show] with the same key and count does nothing, so per-event cost
 * is nil. Temporary internal design.
 *
 * Animations (plain framework animators): an idle bob/breath loop on the image, a pop on the stage
 * when the count rises, a wobble on the stage when the mood changes, and a cross-fade between mood
 * images. All are cancelled in [hide].
 */
class CountBadge(private val service: AccessibilityService) {
  private val windowManager = service.getSystemService(WindowManager::class.java)
  private val density = service.resources.displayMetrics.density
  private var root: LinearLayout? = null
  private var stage: FrameLayout? = null
  private var image: ImageView? = null
  private var countText: TextView? = null
  private var idle: Animator? = null
  private var pop: Animator? = null
  private var wobble: Animator? = null
  private var shownKey: String? = null
  private var shownCount = 0
  private var shownMood: MascotMood? = null

  val isShown: Boolean get() = root != null

  fun show(appKey: String, count: Int) {
    val mood = MascotMoods.forCount(count)
    val existing = root
    if (existing != null) {
      if (appKey == shownKey && count == shownCount) return
      val sameApp = appKey == shownKey
      val previousMood = shownMood
      val previousCount = shownCount
      shownKey = appKey
      shownCount = count
      shownMood = mood
      countText?.text = count.toString()
      if (previousMood != mood) {
        crossFade(mood)
        if (sameApp) startWobble()
      }
      if (sameApp && count > previousCount) startPop()
      return
    }
    val created = createView(mood, count)
    try {
      windowManager.addView(created, layoutParams())
      root = created
      shownKey = appKey
      shownCount = count
      shownMood = mood
      startIdle()
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
    stopAnimators()
    clearViews()
    try {
      windowManager.removeViewImmediate(existing)
    } catch (e: IllegalArgumentException) {
      Log.w(TAG, "badge remove failed: ${e.javaClass.simpleName}")
    }
  }

  private fun clearViews() {
    root = null
    stage = null
    image = null
    countText = null
    shownKey = null
    shownCount = 0
    shownMood = null
  }

  private fun stopAnimators() {
    idle?.cancel()
    pop?.cancel()
    wobble?.cancel()
    idle = null
    pop = null
    wobble = null
  }

  private fun dp(value: Float): Int = (value * density).toInt()

  private fun moodDrawable(mood: MascotMood): Drawable? =
    service.getDrawable(
      when (mood) {
        MascotMood.GLOWING -> R.drawable.brainling_mascot_glowing
        MascotMood.HAPPY -> R.drawable.brainling_mascot_happy
        MascotMood.MEH -> R.drawable.brainling_mascot_meh
        MascotMood.FRIED -> R.drawable.brainling_mascot_fried
        MascotMood.ZOMBIE -> R.drawable.brainling_mascot_zombie
      },
    )

  private fun createView(mood: MascotMood, count: Int): LinearLayout {
    val picture = ImageView(service).apply {
      setImageDrawable(moodDrawable(mood))
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
      // Room for the pop (scale up) and wobble so they are not clipped by the window.
      setPadding(dp(PAD_DP), dp(PAD_DP), dp(PAD_DP), dp(PAD_DP))
      addView(frame)
      addView(
        number,
        LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.WRAP_CONTENT,
          LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { topMargin = -dp(4f) },
      )
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    stage = frame
    image = picture
    countText = number
    return column
  }

  /** Quick cross-fade from the current mood image to [mood]'s. */
  private fun crossFade(mood: MascotMood) {
    val view = image ?: return
    val next = moodDrawable(mood) ?: return
    val current = (view.drawable as? TransitionDrawable)?.getDrawable(1) ?: view.drawable
    val fade = TransitionDrawable(arrayOf(current ?: next, next))
    view.setImageDrawable(fade)
    fade.isCrossFadeEnabled = true
    fade.startTransition(FADE_MS)
  }

  /** Gentle endless bob and breathe on the image (the stage stays free for pop and wobble). */
  private fun startIdle() {
    val view = image ?: return
    view.pivotY = dp(MASCOT_DP).toFloat()
    idle = ObjectAnimator.ofPropertyValuesHolder(
      view,
      PropertyValuesHolder.ofFloat(View.TRANSLATION_Y, 0f, -dp(3f).toFloat()),
      PropertyValuesHolder.ofFloat(View.SCALE_X, 1f, 1.03f),
      PropertyValuesHolder.ofFloat(View.SCALE_Y, 1f, 0.98f),
    ).apply {
      duration = IDLE_MS
      repeatCount = ObjectAnimator.INFINITE
      repeatMode = ObjectAnimator.REVERSE
      interpolator = AccelerateDecelerateInterpolator()
      start()
    }
  }

  /** Scale up and back when the count goes up. */
  private fun startPop() {
    val view = stage ?: return
    pop?.cancel()
    view.scaleX = 1f
    view.scaleY = 1f
    pop = ObjectAnimator.ofPropertyValuesHolder(
      view,
      PropertyValuesHolder.ofFloat(View.SCALE_X, 1f, 1.2f, 1f),
      PropertyValuesHolder.ofFloat(View.SCALE_Y, 1f, 1.2f, 1f),
    ).apply {
      duration = POP_MS
      start()
    }
  }

  /** Quick left-right rotation shake when the mood changes. */
  private fun startWobble() {
    val view = stage ?: return
    wobble?.cancel()
    wobble = ObjectAnimator.ofFloat(view, View.ROTATION, 0f, -14f, 12f, -9f, 6f, -3f, 0f).apply {
      duration = WOBBLE_MS
      interpolator = LinearInterpolator()
      start()
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
    private const val MASCOT_DP = 60f
    private const val PAD_DP = 8f
    private const val FADE_MS = 220
    private const val IDLE_MS = 1100L
    private const val POP_MS = 260L
    private const val WOBBLE_MS = 500L
  }
}
