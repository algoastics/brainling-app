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
import android.os.Handler
import android.os.Looper
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
 * no SYSTEM_ALERT_WINDOW, no foreground service): the animated Brainling mascot (96dp) with the
 * current platform's reel count in a small pill under it. Its mood follows [MascotMoods]. Top
 * centre, below the status bar, never touchable or focusable. Main thread only. Shown while a
 * reels surface is on screen; [show] with the same key and count does nothing, so per-event cost
 * is nil. Temporary internal design.
 *
 * The window has an explicit size (mascot plus animation padding, see [PAD_TOP_DP] etc.), NOT
 * wrap_content: every animation (bob, hop, pop 1.2x, wobble, sway) stays inside it, so nothing is
 * clipped by the window. Views also set clipChildren/clipToPadding = false.
 *
 * Animations (plain framework animators, one Handler): a per-mood idle loop on the image (glowing:
 * breathing + glow ring, happy: bob + hop every few seconds, meh: sway, fried: jitter, zombie:
 * slow droop and tilt), blinking with an eyes-closed frame per mood ([MascotMotion] timing), a pop
 * on the stage when the count rises, a wobble on the stage when the mood changes, and a
 * cross-fade between mood images. Everything is cancelled and every callback removed in [hide].
 */
class CountBadge(private val service: AccessibilityService) {
  private val windowManager = service.getSystemService(WindowManager::class.java)
  private val density = service.resources.displayMetrics.density
  private val handler = Handler(Looper.getMainLooper())
  private val random = Random()
  private var root: LinearLayout? = null
  private var stage: FrameLayout? = null
  private var image: ImageView? = null
  private var glow: View? = null
  private var countText: TextView? = null
  private var idle: Animator? = null
  private var glowPulse: Animator? = null
  private var hop: Animator? = null
  private var pop: Animator? = null
  private var wobble: Animator? = null
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
      val sameApp = appKey == shownKey
      val previousMood = shownMood
      val previousCount = shownCount
      shownKey = appKey
      shownCount = count
      shownMood = mood
      countText?.text = count.toString()
      if (previousMood != mood) {
        crossFade(mood)
        applyMood(mood)
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
    glow = null
    countText = null
    openFrame = null
    closedFrame = null
    shownKey = null
    shownCount = 0
    shownMood = null
  }

  /** Cancels every animator and removes every pending blink/hop/fade callback (no leaks). */
  private fun stopAnimators() {
    handler.removeCallbacksAndMessages(null)
    idle?.cancel()
    glowPulse?.cancel()
    hop?.cancel()
    pop?.cancel()
    wobble?.cancel()
    idle = null
    glowPulse = null
    hop = null
    pop = null
    wobble = null
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
    val glowView = View(service).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        gradientType = GradientDrawable.RADIAL_GRADIENT
        gradientRadius = dp(MASCOT_DP * 0.55f).toFloat()
        colors = intArrayOf(0xAAFFD36B.toInt(), 0x00FFD36B)
      }
      visibility = View.GONE
    }
    val picture = ImageView(service).apply {
      setImageDrawable(openFrame)
      scaleType = ImageView.ScaleType.FIT_CENTER
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    val frame = FrameLayout(service).apply {
      clipChildren = false
      clipToPadding = false
      addView(glowView, FrameLayout.LayoutParams(dp(MASCOT_DP), dp(MASCOT_DP)))
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
      // Room (inside the fixed window) for hop, pop, wobble and sway so nothing is clipped.
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
    stage = frame
    image = picture
    glow = glowView
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

  /** (Re)starts everything that depends on the mood: idle loop, glow, blinking, hops. */
  private fun applyMood(mood: MascotMood) {
    startIdle(mood)
    startGlow(mood)
    handler.removeCallbacks(blinkClose)
    handler.removeCallbacks(blinkOpen)
    handler.removeCallbacks(hopNow)
    secondBlink = false
    pendingSecondBlink = false
    scheduleBlink(mood)
    if (mood == MascotMood.HAPPY) {
      handler.postDelayed(hopNow, MascotMotion.nextHopDelayMs(random.nextDouble()))
    }
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

  private val hopNow: Runnable = Runnable {
    if (shownMood != MascotMood.HAPPY) return@Runnable
    val view = stage ?: return@Runnable
    hop?.cancel()
    hop = ObjectAnimator.ofFloat(view, View.TRANSLATION_Y, 0f, -dp(HOP_DP).toFloat(), 0f).apply {
      duration = HOP_MS
      interpolator = AccelerateDecelerateInterpolator()
      start()
    }
    handler.postDelayed(hopNow, MascotMotion.nextHopDelayMs(random.nextDouble()))
  }

  /** Soft glow ring behind the mascot, only for the glowing mood. */
  private fun startGlow(mood: MascotMood) {
    val view = glow ?: return
    glowPulse?.cancel()
    glowPulse = null
    if (mood != MascotMood.GLOWING) {
      view.visibility = View.GONE
      return
    }
    view.visibility = View.VISIBLE
    glowPulse = ObjectAnimator.ofPropertyValuesHolder(
      view,
      PropertyValuesHolder.ofFloat(View.ALPHA, 0.35f, 1f),
      PropertyValuesHolder.ofFloat(View.SCALE_X, 0.95f, 1.12f),
      PropertyValuesHolder.ofFloat(View.SCALE_Y, 0.95f, 1.12f),
    ).apply {
      duration = 2200L
      repeatCount = ObjectAnimator.INFINITE
      repeatMode = ObjectAnimator.REVERSE
      interpolator = AccelerateDecelerateInterpolator()
      start()
    }
  }

  /** Endless per-mood motion on the image (the stage stays free for pop, wobble and hop). */
  private fun startIdle(mood: MascotMood) {
    val view = image ?: return
    idle?.cancel()
    view.translationX = 0f
    view.translationY = 0f
    view.rotation = 0f
    view.scaleX = 1f
    view.scaleY = 1f
    view.pivotX = dp(MASCOT_DP) / 2f
    view.pivotY = dp(MASCOT_DP) * 0.9f
    fun f(prop: android.util.Property<View, Float>, from: Float, to: Float) =
      PropertyValuesHolder.ofFloat(prop, from, to)
    val (ms, holders) = when (mood) {
      // Calm breathing.
      MascotMood.GLOWING -> 2200L to arrayOf(
        f(View.SCALE_X, 1f, 1.05f),
        f(View.SCALE_Y, 1f, 1.05f),
        f(View.TRANSLATION_Y, 0f, -dp(2f).toFloat()),
      )
      // Light bob (the hop is scheduled separately).
      MascotMood.HAPPY -> 1100L to arrayOf(
        f(View.TRANSLATION_Y, 0f, -dp(3f).toFloat()),
        f(View.SCALE_X, 1f, 1.03f),
        f(View.SCALE_Y, 1f, 0.98f),
      )
      // Slow sway side to side.
      MascotMood.MEH -> 1900L to arrayOf(
        f(View.TRANSLATION_X, -dp(3f).toFloat(), dp(3f).toFloat()),
        f(View.ROTATION, -3f, 3f),
      )
      // Fast nervous jitter.
      MascotMood.FRIED -> 65L to arrayOf(
        f(View.TRANSLATION_X, -dp(1.5f).toFloat(), dp(1.5f).toFloat()),
        f(View.ROTATION, -2.5f, 2.5f),
      )
      // Slow heavy droop with a tilt.
      MascotMood.ZOMBIE -> 2800L to arrayOf(
        f(View.TRANSLATION_Y, 0f, dp(5f).toFloat()),
        f(View.ROTATION, -4f, -9f),
        f(View.SCALE_Y, 1f, 0.97f),
      )
    }
    idle = ObjectAnimator.ofPropertyValuesHolder(view, *holders).apply {
      duration = ms
      repeatCount = ObjectAnimator.INFINITE
      repeatMode = ObjectAnimator.REVERSE
      interpolator = if (mood == MascotMood.FRIED) LinearInterpolator() else AccelerateDecelerateInterpolator()
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
      // Explicit size: sized for the mascot, the pill and the animation padding, not for content.
      dp(MASCOT_DP + 2 * PAD_SIDE_DP),
      dp(WINDOW_HEIGHT_DP),
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
      // The mascot box starts about 8dp under the status bar (the window has PAD_TOP_DP above it).
      y = (statusBar - dp(PAD_TOP_DP - 8f)).coerceAtLeast(0)
    }
  }

  companion object {
    private const val TAG = "BrainlingBadge"
    private const val BRAND_VIOLET = 0xFF6B4EFF.toInt()
    private const val MASCOT_DP = 96f
    // Pop 1.2x adds ~10dp each way; hop 10dp; wobble corners ~10dp; sway/droop 3-5dp.
    private const val PAD_TOP_DP = 26f
    private const val PAD_SIDE_DP = 24f
    private const val PAD_BOTTOM_DP = 16f
    // pad + mascot + pill (about 20dp, -6dp overlap, extra for large fonts) + pad.
    private const val WINDOW_HEIGHT_DP = PAD_TOP_DP + MASCOT_DP + 28f + PAD_BOTTOM_DP
    private const val HOP_DP = 10f
    private const val HOP_MS = 420L
    private const val FADE_MS = 220
    private const val POP_MS = 260L
    private const val WOBBLE_MS = 500L
  }
}
