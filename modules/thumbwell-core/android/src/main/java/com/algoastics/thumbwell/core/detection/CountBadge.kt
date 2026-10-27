package com.algoastics.thumbwell.core.detection

import android.accessibilityservice.AccessibilityService
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.view.animation.Interpolator
import android.view.animation.LinearInterpolator
import android.view.animation.OvershootInterpolator
import android.view.animation.PathInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import com.algoastics.thumbwell.core.R
import com.algoastics.thumbwell.core.data.CorePrefs
import java.util.Random

/**
 * The floating Thumb badge (F07, S50-P0): Thumb plus today's count for the foreground app, drawn
 * by the accessibility service itself (TYPE_ACCESSIBILITY_OVERLAY; no SYSTEM_ALERT_WINDOW).
 * Main thread only. When it is shown, rests, hides and what animates is decided by the pure
 * [BadgeMachine]; this class only turns its [BadgeAction]s into one window, framework animators
 * (translation, scale, rotation, alpha; no layout animation) and timers on ONE Handler. [hideNow]
 * and [release] cancel everything and remove the window; add and remove are idempotent.
 *
 * Two window layouts, switched once per mode (never per frame): awake (pill and Thumb, pill flush
 * with the edge it is snapped to; the Thumb sits in front of the pill's left socket) and resting
 * (the count pill at [BadgeRest.PILL_ALPHA] with the sleeping Thumb on its edge end, half past the screen
 * edge; [BadgeRest.PILL_VISIBLE] false gives the Thumb alone). Nothing animates or has a timer
 * while resting. The window is touchable but never focusable.
 */
class CountBadge(
  private val service: AccessibilityService,
  private val prefs: CorePrefs,
  private val openApp: () -> Unit,
) {
  private val windowManager = service.getSystemService(WindowManager::class.java)
  private val density = service.resources.displayMetrics.density
  private val handler = Handler(Looper.getMainLooper())
  private val random = Random()
  private val machine = BadgeMachine(prefs.badgeSettings())
  private val typeface: Typeface = try {
    Typeface.createFromAsset(service.assets, "fonts/nunito_extrabold.ttf")
  } catch (e: RuntimeException) {
    Typeface.DEFAULT_BOLD
  }
  private val slop = ViewConfiguration.get(service).scaledTouchSlop

  private var window: FrameLayout? = null
  private var content: FrameLayout? = null
  private var pill: LinearLayout? = null
  private var thumbBox: FrameLayout? = null
  private var thumb: ImageView? = null
  private var odometer: OdometerView? = null
  private var params: WindowManager.LayoutParams? = null
  private var restingLayout = true
  private var gate = false
  private var count = 0
  private var position = prefs.badgePosition()
  private val animators = ArrayList<Animator>()
  private var bob: ObjectAnimator? = null
  private var dragging = false

  val isShown: Boolean get() = window != null

  private fun dp(v: Float): Int = (v * density + 0.5f).toInt()

  // ---- API used by the service (main thread) ----

  /** The gate is open (reels surface, counting on, no lock or text input): show [count]. */
  fun show(count: Int) {
    machine.reducedMotion = reduced()
    this.count = count
    val out = ArrayList<BadgeAction>()
    if (!gate || machine.leaving) {
      gate = true
      out.addAll(machine.setVisible(true, count))
    }
    out.addAll(machine.onCount(count))
    apply(out)
  }

  /** The reels surface is gone: fade out after 600 ms unless it comes back. */
  fun leave() = apply(machine.leave())

  /** Remove at once (keyboard, lock, switch off, paused, service off). Idempotent. */
  fun hideNow() {
    gate = false
    apply(machine.setVisible(false, count))
    removeNow()
  }

  /** Re-reads the saved switches (from the Settings screen). */
  fun settingsChanged() {
    val next = prefs.badgeSettings()
    if (!next.enabled) {
      hideNow()
      machine.onSettings(next)
      return
    }
    machine.reducedMotion = reduced()
    apply(machine.onSettings(next))
  }

  fun release() {
    hideNow()
  }

  // ---- interpreter ----

  private fun apply(actions: List<BadgeAction>) {
    for (a in actions) {
      when (a) {
        is BadgeAction.Add -> addWindow(a.count)
        BadgeAction.FadeInResting -> fadeInResting()
        is BadgeAction.PopOut -> popOut(a)
        is BadgeAction.Roll -> roll(a.from, a.to)
        is BadgeAction.SetCount -> setCount(a.count)
        is BadgeAction.StartBob -> startBob(a.stopAfterMs)
        BadgeAction.StartBlink -> startBlink()
        is BadgeAction.ScheduleRest -> {
          handler.removeCallbacks(restDue)
          handler.postDelayed(restDue, a.ms)
        }
        BadgeAction.CancelRest -> handler.removeCallbacks(restDue)
        is BadgeAction.SettleToRest -> settle(a.reduced)
        BadgeAction.FadeOutRemove -> fadeOutRemove()
        BadgeAction.RemoveNow -> removeNow()
        is BadgeAction.ScheduleHide -> {
          handler.removeCallbacks(hideDue)
          handler.postDelayed(hideDue, a.ms)
        }
        BadgeAction.CancelHide -> handler.removeCallbacks(hideDue)
      }
    }
  }

  private val restDue = Runnable { apply(machine.onRestDue()) }
  private val hideDue = Runnable { apply(machine.onHideDue()) }

  private fun reduced(): Boolean {
    val resolver = service.contentResolver
    val animator = Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f)
    val transition = Settings.Global.getFloat(resolver, Settings.Global.TRANSITION_ANIMATION_SCALE, 1f)
    return ReducedMotion.isReduced(animator, transition)
  }

  // ---- window and views ----

  private fun addWindow(initial: Int) {
    if (window != null) return
    count = initial
    position = prefs.badgePosition()
    val face = service.getColor(R.color.thumbwell_badge_text)
    val counter = OdometerView(service, typeface, 17f, face).also { it.setCount(initial) }
    val capsule = LinearLayout(service).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(46f), 0, dp(16f), 0)
      elevation = dp(PILL_ELEVATION).toFloat()
      alpha = 0f
      addView(counter, LinearLayout.LayoutParams(-2, -2))
    }
    val art = ImageView(service).apply {
      setImageResource(R.drawable.ic_thumb_badge_closed)
      scaleType = ImageView.ScaleType.FIT_XY
    }
    val box = FrameLayout(service).apply {
      clipChildren = false
      addView(art, FrameLayout.LayoutParams(-1, -1))
      scaleX = REST_SCALE
      scaleY = REST_SCALE
      alpha = 0f
      // Android draws by elevation first and child order second. The pill has an elevation, so the
      // Thumb needs a higher one or it is drawn BEHIND the pill (device bug, M3b). Keep it above
      // every pill elevation, including the lifted one while dragging.
      elevation = dp(THUMB_ELEVATION).toFloat()
    }
    val holder = FrameLayout(service).apply {
      clipChildren = false
      addView(capsule, FrameLayout.LayoutParams(-2, dp(PILL_H)))
      addView(box, FrameLayout.LayoutParams(dp(THUMB_W), dp(THUMB_H)))
    }
    val root = FrameLayout(service).apply {
      clipChildren = false
      clipToPadding = false
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
      addView(holder, FrameLayout.LayoutParams(-1, -1))
      setOnTouchListener(::onTouch)
    }
    window = root
    content = holder
    pill = capsule
    thumbBox = box
    thumb = art
    odometer = counter
    describe()
    styleCapsule(snapped = true, lifted = false)
    val lp = WindowManager.LayoutParams(
      1, 1,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT,
    ).apply { gravity = Gravity.TOP or Gravity.LEFT }
    params = lp
    layoutResting(commit = false)
    try {
      windowManager.addView(root, lp)
    } catch (e: WindowManager.BadTokenException) {
      Log.w(TAG, "badge add failed: ${e.javaClass.simpleName}")
      clearViews()
    } catch (e: IllegalStateException) {
      Log.w(TAG, "badge add failed: ${e.javaClass.simpleName}")
      clearViews()
    }
  }

  private fun describe() {
    window?.contentDescription = service.resources.getQuantityString(
      R.plurals.thumbwell_badge_description, count, count)
  }

  private fun clearViews() {
    window = null; content = null; pill = null; thumbBox = null; thumb = null
    odometer = null; params = null
  }

  /** Pill chrome: round with a violet ring while lifted, else the flat side takes the edge radius. */
  private fun styleCapsule(snapped: Boolean, lifted: Boolean) {
    val capsule = pill ?: return
    val full = dp(PILL_H / 2f).toFloat()
    val edge = dp(8f).toFloat()
    val shape = GradientDrawable().apply {
      setColor(service.getColor(R.color.thumbwell_badge_bg))
      if (lifted) {
        setStroke(dp(2f), service.getColor(R.color.thumbwell_badge_ring))
        cornerRadius = full
      } else {
        setStroke(dp(1f), service.getColor(R.color.thumbwell_badge_border))
        if (snapped && position.side == BadgeSide.RIGHT) {
          cornerRadii = floatArrayOf(full, full, edge, edge, edge, edge, full, full)
        } else if (snapped) {
          cornerRadii = floatArrayOf(edge, edge, full, full, full, full, edge, edge)
        } else {
          cornerRadius = full
        }
      }
    }
    capsule.background = shape
  }

  private fun screenW() = service.resources.displayMetrics.widthPixels
  private fun screenH() = service.resources.displayMetrics.heightPixels

  private fun pillTopPx(): Int = BadgePlacement.clampY(
    dp(position.yDp), dp(PILL_H), screenH(), dp(KEEP_TOP), dp(KEEP_BOTTOM))

  private fun pillWidthPx(): Int {
    val counter = odometer ?: return dp(PILL_MIN_W)
    counter.measure(View.MeasureSpec.UNSPECIFIED, View.MeasureSpec.UNSPECIFIED)
    return dp(46f) + counter.measuredWidth + dp(16f)
  }

  private data class Geometry(val x: Int, val y: Int, val w: Int, val h: Int, val thumbLeft: Int, val thumbTop: Int, val pillLeft: Int, val pillTop: Int, val pillW: Int)

  private fun awakeGeometry(): Geometry {
    val pillW = pillWidthPx()
    val pad = dp(PAD)
    val w = pad + pillW + pad
    val h = pad + dp(THUMB_H) + pad
    val top = pillTopPx()
    val x = if (position.side == BadgeSide.RIGHT) screenW() - w + pad else -pad
    return Geometry(x, top - pad - dp(THUMB_RISE), w, h, pad - dp(5f), pad, pad, pad + dp(THUMB_RISE), pillW)
  }

  private fun applyGeometry(g: Geometry, commit: Boolean) {
    val lp = params ?: return
    lp.x = g.x; lp.y = g.y; lp.width = g.w; lp.height = g.h
    (thumbBox?.layoutParams as? FrameLayout.LayoutParams)?.let { it.leftMargin = g.thumbLeft; it.topMargin = g.thumbTop }
    (pill?.layoutParams as? FrameLayout.LayoutParams)?.let {
      it.leftMargin = g.pillLeft; it.topMargin = g.pillTop
      if (g.pillW > 0) it.width = g.pillW
    }
    thumbBox?.requestLayout()
    pill?.requestLayout()
    val root = window
    if (commit && root != null && root.isAttachedToWindow) {
      try { windowManager.updateViewLayout(root, lp) } catch (e: IllegalArgumentException) {
        Log.w(TAG, "badge layout failed: ${e.javaClass.simpleName}")
      }
    }
  }

  /**
   * The resting badge keeps the awake window and the awake pill (A42: the pill never changes size or
   * position). Only transforms differ: the Thumb sits on the pill's edge end, the count may shift.
   */
  private fun layoutResting(commit: Boolean) {
    restingLayout = true
    pill?.visibility = if (BadgeRest.PILL_VISIBLE) View.VISIBLE else View.INVISIBLE
    pill?.alpha = restPillAlpha()
    applyGeometry(awakeGeometry(), commit)
    applyRestTransforms()
  }

  private fun restShift(): BadgePlacement.RestShift {
    val g = awakeGeometry()
    return BadgePlacement.restShift(
      position.side, g.pillW.toFloat(), dp(PILL_H).toFloat(), dp(THUMB_W).toFloat(), dp(THUMB_H).toFloat(),
      (g.thumbLeft - g.pillLeft).toFloat(), dp(THUMB_RISE).toFloat(), dp(46f).toFloat(), dp(16f).toFloat(),
    )
  }

  /** Puts the Thumb, its scale and alpha, the count and the pill in the A42 end state. */
  private fun applyRestTransforms() {
    val box = thumbBox ?: return
    val shift = restShift()
    box.translationX = shift.thumbDx; box.translationY = shift.thumbDy
    box.scaleX = REST_SCALE; box.scaleY = REST_SCALE; box.alpha = REST_ALPHA
    odometer?.translationX = shift.countDx
    pill?.translationX = 0f
  }

  private fun restPillAlpha(): Float = if (BadgeRest.PILL_VISIBLE) BadgeRest.PILL_ALPHA else 0f

  private fun layoutAwake(commit: Boolean) {
    restingLayout = false
    pill?.visibility = View.VISIBLE
    styleCapsule(snapped = true, lifted = false)
    applyGeometry(awakeGeometry(), commit)
  }

  // ---- animation helpers ----

  private fun animate(
    target: View, property: android.util.Property<View, Float>, to: Float, ms: Long,
    interpolator: Interpolator, delay: Long = 0L, from: Float? = null, onEnd: (() -> Unit)? = null,
  ): ObjectAnimator {
    val a = if (from != null) ObjectAnimator.ofFloat(target, property, from, to)
    else ObjectAnimator.ofFloat(target, property, to)
    a.duration = ms
    a.startDelay = delay
    a.interpolator = interpolator
    animators.add(a)
    a.addListener(object : AnimatorListenerAdapter() {
      override fun onAnimationEnd(animation: Animator) {
        animators.remove(a)
        onEnd?.invoke()
      }
    })
    a.start()
    return a
  }

  private fun cancelAnimators() {
    val live = ArrayList(animators)
    animators.clear()
    live.forEach { it.removeAllListeners(); it.cancel() }
    bob?.let { it.removeAllListeners(); it.cancel() }
    bob = null
    odometer?.cancel()
  }

  /** Cancels every animator and every timer. Called before anything is removed or re-laid out. */
  private fun cancelAll(keepHide: Boolean = false) {
    cancelAnimators()
    handler.removeCallbacksAndMessages(null)
    if (keepHide) handler.postDelayed(hideDue, BadgeTiming.LEAVE_DELAY_MS)
    blinking = false
    dragging = false
  }

  private fun setEyes(res: Int) = thumb?.setImageResource(res)

  private fun fadeInResting() {
    val box = thumbBox ?: return
    val capsule = pill
    if (machine.reducedMotion) {
      box.alpha = REST_ALPHA
      capsule?.alpha = restPillAlpha()
      return
    }
    val ease = PathInterpolator(0.4f, 0f, 0.2f, 1f)
    animate(box, View.ALPHA, REST_ALPHA, BadgeTiming.FADE_MS, ease, from = 0f)
    if (capsule != null && BadgeRest.PILL_VISIBLE) {
      animate(capsule, View.ALPHA, BadgeRest.PILL_ALPHA, BadgeTiming.FADE_MS, ease, from = 0f)
    }
  }

  /** A40a pop-out and A40b flick. */
  private fun popOut(a: BadgeAction.PopOut) {
    val box = thumbBox ?: return
    val capsule = pill ?: return
    val art = thumb ?: return
    val wasResting = restingLayout
    val shift = if (a.fromGone || wasResting) restShift() else null
    val delta = (shift?.thumbDx ?: 0f) to (shift?.thumbDy ?: 0f)
    val countDx = shift?.countDx ?: 0f
    val pillStartAlpha = if (a.fromGone || !BadgeRest.PILL_VISIBLE) 0f else BadgeRest.PILL_ALPHA
    cancelAnimators()
    handler.removeCallbacks(eyeOpen)
    if (wasResting) layoutAwake(commit = true)
    val startAlpha = if (a.fromGone) 0f else REST_ALPHA
    if (a.reduced) {
      setEyes(R.drawable.ic_thumb_badge_open)
      box.translationX = 0f; box.translationY = 0f; box.scaleX = 1f; box.scaleY = 1f
      capsule.scaleX = 1f
      capsule.translationX = 0f
      odometer?.translationX = 0f
      animate(box, View.ALPHA, 1f, REDUCED_FADE_IN_MS, LinearInterpolator(), from = startAlpha)
      animate(capsule, View.ALPHA, 1f, REDUCED_FADE_IN_MS, LinearInterpolator(), from = pillStartAlpha)
      return
    }
    val spring = OvershootInterpolator(1.1f)
    box.translationX = delta.first; box.translationY = delta.second
    box.scaleX = REST_SCALE; box.scaleY = REST_SCALE
    box.rotation = 0f
    setEyes(R.drawable.ic_thumb_badge_closed)
    handler.postDelayed(eyeOpen, EYES_OPEN_AT_MS)
    animate(box, View.TRANSLATION_X, 0f, BadgeTiming.POP_MS, spring)
    animate(box, View.TRANSLATION_Y, 0f, BadgeTiming.POP_MS, spring)
    animate(box, View.SCALE_X, 1f, BadgeTiming.POP_MS, spring)
    animate(box, View.SCALE_Y, 1f, BadgeTiming.POP_MS, spring)
    animate(box, View.ALPHA, 1f, BadgeTiming.POP_MS, DecelerateInterpolator(), from = startAlpha)
    // The pill stays put (already on screen, at 70 percent) and fills to full; the count slides back.
    capsule.scaleX = 1f
    capsule.translationX = 0f
    capsule.alpha = pillStartAlpha
    animate(capsule, View.ALPHA, 1f, BadgeTiming.POP_MS, DecelerateInterpolator())
    odometer?.let {
      it.translationX = countDx
      animate(it, View.TRANSLATION_X, 0f, BadgeTiming.POP_MS, spring)
    }
    if (a.flick) {
      art.translationY = 0f; art.rotation = 0f; art.scaleY = 1f
      val up = DecelerateInterpolator(1.5f)
      val settle = OvershootInterpolator(2.2f)
      val start = BadgeTiming.FLICK_START_MS
      animate(art, View.TRANSLATION_Y, -dp(10f).toFloat(), BadgeTiming.FLICK_UP_MS, up, start)
      animate(art, View.ROTATION, -8f, BadgeTiming.FLICK_UP_MS, up, start)
      animate(art, View.SCALE_Y, 1.1f, BadgeTiming.FLICK_UP_MS, up, start)
      val back = start + BadgeTiming.FLICK_UP_MS
      animate(art, View.TRANSLATION_Y, 0f, BadgeTiming.FLICK_SETTLE_MS, settle, back)
      animate(art, View.ROTATION, 0f, BadgeTiming.FLICK_SETTLE_MS, settle, back)
      animate(art, View.SCALE_Y, 1f, BadgeTiming.FLICK_SETTLE_MS, settle, back)
    }
  }

  private val eyeOpen = Runnable { setEyes(R.drawable.ic_thumb_badge_open) }

  private fun roll(from: Int, to: Int) {
    val counter = odometer ?: return
    val grew = Odometer.grows(from, to)
    counter.roll(from, to)
    count = to
    describe()
    if (grew && !restingLayout) applyGeometry(awakeGeometry(), commit = true)
  }

  private fun setCount(value: Int) {
    val counter = odometer ?: return
    val resized = Odometer.format(value).length != Odometer.format(count).length
    counter.setCount(value)
    count = value
    describe()
    if (resized) {
      applyGeometry(awakeGeometry(), commit = true)
      if (restingLayout) applyRestTransforms()
    }
  }

  /** A41: translateY 0 to -2 dp and back, 1.6 s cycle; stops after [stopAfterMs] if given. */
  private fun startBob(stopAfterMs: Long?) {
    val holder = content ?: return
    handler.removeCallbacks(bobStop)
    if (bob == null) {
      val a = ObjectAnimator.ofFloat(holder, View.TRANSLATION_Y, 0f, -dp(2f).toFloat())
      a.duration = BadgeTiming.BOB_CYCLE_MS / 2
      a.repeatCount = ObjectAnimator.INFINITE
      a.repeatMode = ObjectAnimator.REVERSE
      a.interpolator = AccelerateDecelerateInterpolator()
      bob = a
      a.start()
    }
    if (stopAfterMs != null) handler.postDelayed(bobStop, stopAfterMs)
  }

  private val bobStop = Runnable {
    bob?.let { it.removeAllListeners(); it.cancel() }
    bob = null
    content?.let { animate(it, View.TRANSLATION_Y, 0f, BadgeTiming.FADE_MS, DecelerateInterpolator()) }
  }

  /** A43: open, half, closed, half, open in 40 ms steps, then the next blink in 3 to 5 s. */
  private fun startBlink() {
    if (blinking) return
    blinking = true
    handler.postDelayed(blinkStart, BadgeTiming.nextBlinkMs(random.nextInt(BadgeTiming.BLINK_JITTER_MS)))
  }

  private var blinking = false
  private val blinkStart = Runnable { blinkStep(0) }

  private fun blinkStep(step: Int) {
    if (!blinking) return
    val frames = intArrayOf(
      R.drawable.ic_thumb_badge_half, R.drawable.ic_thumb_badge_closed,
      R.drawable.ic_thumb_badge_half, R.drawable.ic_thumb_badge_open,
    )
    setEyes(frames[step])
    if (step + 1 < frames.size) {
      handler.postDelayed({ blinkStep(step + 1) }, BadgeTiming.BLINK_STEP_MS)
    } else {
      handler.postDelayed(blinkStart, BadgeTiming.nextBlinkMs(random.nextInt(BadgeTiming.BLINK_JITTER_MS)))
    }
  }

  /** A42: pill fades, eyes close, Thumb shrinks to 0.93 and slides to the edge at 40 percent. */
  private fun settle(reduced: Boolean) {
    val box = thumbBox ?: return
    val capsule = pill ?: return
    cancelAnimators()
    handler.removeCallbacks(bobStop)
    handler.removeCallbacks(blinkStart)
    blinking = false
    content?.translationY = 0f
    thumb?.let { it.translationY = 0f; it.rotation = 0f; it.scaleY = 1f }
    val end = { finishSettle() }
    val shift = restShift()
    if (reduced) {
      animate(capsule, View.ALPHA, restPillAlpha(), BadgeTiming.REDUCED_FADE_MS, LinearInterpolator())
      animate(box, View.ALPHA, REST_ALPHA, BadgeTiming.REDUCED_FADE_MS, LinearInterpolator(), onEnd = end)
      return
    }
    val ease = PathInterpolator(0.4f, 0f, 0.2f, 1f)
    // The pill stays where it is and dims to 70 percent; the Thumb slides onto its edge end, the
    // count moves inward on the right edge (translate + alpha only, 240 ms).
    animate(capsule, View.ALPHA, restPillAlpha(), BadgeTiming.SETTLE_MS, ease)
    odometer?.let { animate(it, View.TRANSLATION_X, shift.countDx, BadgeTiming.SETTLE_MS, ease) }
    handler.postDelayed({ setEyes(R.drawable.ic_thumb_badge_half) }, BadgeTiming.BLINK_STEP_MS)
    handler.postDelayed({ setEyes(R.drawable.ic_thumb_badge_closed) }, BadgeTiming.BLINK_STEP_MS * 2)
    animate(box, View.SCALE_X, REST_SCALE, BadgeTiming.SETTLE_MS, ease)
    animate(box, View.SCALE_Y, REST_SCALE, BadgeTiming.SETTLE_MS, ease)
    animate(box, View.TRANSLATION_X, shift.thumbDx, BadgeTiming.SETTLE_MS, ease)
    animate(box, View.TRANSLATION_Y, shift.thumbDy, BadgeTiming.SETTLE_MS, ease)
    animate(box, View.ALPHA, REST_ALPHA, BadgeTiming.SETTLE_MS, ease, onEnd = end)
  }

  /** The end of A42: no animator or timer is left; the end values are applied once. */
  private fun finishSettle() {
    val box = thumbBox ?: return
    cancelAll(keepHide = machine.leaving)
    setEyes(R.drawable.ic_thumb_badge_closed)
    layoutResting(commit = false)
  }

  /** A42b and the leave fade: alpha to 0 in 150 ms, then the window is removed. */
  private fun fadeOutRemove() {
    val root = window ?: return
    cancelAll()
    if (machine.reducedMotion) {
      removeNow()
      return
    }
    animate(root, View.ALPHA, 0f, BadgeTiming.FADE_MS, PathInterpolator(0.4f, 0f, 1f, 1f)) { removeNow() }
  }

  private fun removeNow() {
    val root = window ?: run { cancelAll(); return }
    cancelAll()
    clearViews()
    blinking = false
    try {
      windowManager.removeViewImmediate(root)
    } catch (e: IllegalArgumentException) {
      Log.w(TAG, "badge remove failed: ${e.javaClass.simpleName}")
    }
  }

  // ---- touch: tap opens Thumbwell (wakes a resting Thumb), drag moves, release snaps (A31) ----

  private var downX = 0f
  private var downY = 0f
  private var startWinX = 0
  private var startWinY = 0
  private var moved = false

  private fun onTouch(view: View, event: MotionEvent): Boolean {
    val lp = params ?: return false
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        downX = event.rawX; downY = event.rawY
        startWinX = lp.x; startWinY = lp.y
        moved = false
        return true
      }
      MotionEvent.ACTION_MOVE -> {
        val dx = event.rawX - downX
        val dy = event.rawY - downY
        if (!moved && (dx * dx + dy * dy) > slop * slop) {
          moved = true
          beginDrag()
          startWinX = params?.x ?: startWinX
          startWinY = params?.y ?: startWinY
        }
        if (moved) {
          val p = params ?: return true
          p.x = startWinX + dx.toInt()
          p.y = startWinY + dy.toInt()
          window?.let { w -> w.postOnAnimation { if (w.isAttachedToWindow && dragging) windowManager.updateViewLayout(w, p) } }
        }
        return true
      }
      MotionEvent.ACTION_UP -> {
        if (moved) endDrag() else onTap()
        return true
      }
      MotionEvent.ACTION_CANCEL -> {
        if (moved) endDrag()
        return true
      }
    }
    return false
  }

  private fun onTap() {
    val (result, actions) = machine.onTap()
    if (result == BadgeTap.OPEN_APP) {
      openApp()
      apply(machine.wake())
    } else {
      apply(actions)
    }
  }

  private fun beginDrag() {
    // A resting Thumb wakes (no roll) and then follows the finger.
    machine.reducedMotion = reduced()
    if (machine.mode == BadgeMachine.Mode.RESTING) apply(machine.wake())
    dragging = true
    pill?.let { styleCapsule(snapped = false, lifted = true); it.elevation = dp(PILL_LIFTED_ELEVATION).toFloat() }
    if (!machine.reducedMotion) {
      content?.let {
        it.pivotX = (window?.width ?: 0) / 2f
        it.pivotY = (window?.height ?: 0) / 2f
        animate(it, View.SCALE_X, DRAG_SCALE, DRAG_MS, DecelerateInterpolator())
        animate(it, View.SCALE_Y, DRAG_SCALE, DRAG_MS, DecelerateInterpolator())
      }
    }
  }

  private fun endDrag() {
    val root = window ?: return
    val p = params ?: return
    dragging = false
    val awake = awakeGeometry()
    val centerX = p.x + awake.pillLeft + awake.pillW / 2f
    val side = BadgePlacement.sideFor(centerX, screenW())
    val targetX = if (side == BadgeSide.RIGHT) screenW() - awake.w + dp(PAD) else -dp(PAD)
    val y = BadgePlacement.clampY(p.y + dp(PAD) + dp(THUMB_RISE), dp(PILL_H), screenH(), dp(KEEP_TOP), dp(KEEP_BOTTOM))
    position = BadgePosition(side, BadgePlacement.pxToDp(y, density))
    val commit = {
      p.x = targetX
      p.y = y - dp(PAD) - dp(THUMB_RISE)
      root.translationX = 0f
      content?.let { it.scaleX = 1f; it.scaleY = 1f }
      styleCapsule(snapped = true, lifted = false)
      pill?.elevation = dp(PILL_ELEVATION).toFloat()
      if (root.isAttachedToWindow) windowManager.updateViewLayout(root, p)
      prefs.setBadgePosition(position)
      restartRest()
    }
    if (machine.reducedMotion) {
      commit()
    } else {
      content?.let {
        animate(it, View.SCALE_X, 1f, DRAG_MS, DecelerateInterpolator())
        animate(it, View.SCALE_Y, 1f, DRAG_MS, DecelerateInterpolator())
      }
      animate(
        root, View.TRANSLATION_X, (targetX - p.x).toFloat(), BadgeTiming.SNAP_MS,
        OvershootInterpolator(0.9f), onEnd = commit,
      )
    }
  }

  private fun restartRest() {
    apply(machine.wake())
  }

  private companion object {
    const val TAG = "ThumbwellBadge"
    const val PAD = 12f
    const val PILL_H = 38f
    const val PILL_MIN_W = 80f
    const val THUMB_W = 53.333f
    const val THUMB_H = 60f
    const val THUMB_RISE = 18f
    const val PILL_ELEVATION = 2f
    const val PILL_LIFTED_ELEVATION = 3f
    const val THUMB_ELEVATION = 6f // above both pill elevations: the Thumb is in front of the pill
    const val REST_ALPHA = BadgeRest.THUMB_ALPHA
    const val REST_SCALE = 0.93f
    const val KEEP_TOP = 96f
    const val KEEP_BOTTOM = 120f
    const val DRAG_SCALE = 1.2f
    const val DRAG_MS = 100L
    const val EYES_OPEN_AT_MS = 60L
    const val REDUCED_FADE_IN_MS = 100L
  }
}
