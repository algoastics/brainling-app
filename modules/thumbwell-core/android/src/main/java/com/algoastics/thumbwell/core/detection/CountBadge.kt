package com.algoastics.thumbwell.core.detection

import android.accessibilityservice.AccessibilityService
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import android.view.Choreographer
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
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
 * with the edge it is snapped to; the Thumb sits in front of the pill's socket on the side that
 * faces the screen centre) and resting (the whole node at [BadgeRest.NODE_ALPHA] with the sleeping
 * Thumb centred on that same pill end, only its outer half showing, as in Figma A42;
 * [BadgeRest.PILL_VISIBLE] false gives the Thumb alone). Nothing animates or has a timer while
 * resting. The window is touchable but never focusable.
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
  private var count = 0
  private var position = prefs.badgePosition()
  private val animators = ArrayList<Animator>()
  private var bob: ObjectAnimator? = null
  private var dragging = false
  // Drag and snap (A31). One window update per frame; nothing allocated per touch event or frame.
  private val choreographer: Choreographer = Choreographer.getInstance()
  private val coalescer = FrameCoalescer()
  private val dragFrame = Choreographer.FrameCallback { onDragFrame() }
  private var snap: ValueAnimator? = null
  private var capsuleShape: GradientDrawable? = null
  private val cornersFrom = FloatArray(8)
  private val cornersTo = FloatArray(8)
  private val cornersNow = FloatArray(8)
  private val thumbClip = Rect()
  private var restThumbDx = 0f

  val isShown: Boolean get() = window != null

  private fun dp(v: Float): Int = (v * density + 0.5f).toInt()

  // ---- API used by the service (main thread) ----

  /** The gate is open (reels surface, counting on, no lock or text input): show [count]. */
  fun show(count: Int) {
    machine.reducedMotion = reduced()
    this.count = count
    dropStaleWindow()
    apply(machine.onSurface(count))
  }

  /** The reels surface is gone: fade out after 600 ms unless it comes back. */
  fun leave() = apply(machine.leave())

  /** Remove at once (keyboard, lock, switch off, paused, service off). Idempotent. */
  fun hideNow() {
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

  private val restDue: Runnable = object : Runnable {
    override fun run() {
      // Never rest in the middle of a drag or a snap: look again shortly after. The retry is this
      // same Runnable, so every removeCallbacks(restDue) also cancels a pending retry.
      if (dragging || snap != null) handler.postDelayed(this, REST_RETRY_MS) else apply(machine.onRestDue())
    }
  }
  private val hideDue = Runnable { apply(machine.onHideDue()) }

  private var addedAtMs = 0L

  /**
   * The system can remove our window (service rebind, display change) without telling the view
   * code. A window that is still not attached long after it was added is dropped, and the machine
   * reset, so the next show adds a fresh one instead of trusting a dead reference.
   */
  private fun dropStaleWindow() {
    val w = window ?: return
    if (w.isAttachedToWindow || SystemClock.elapsedRealtime() - addedAtMs < STALE_AFTER_MS) return
    Log.w(TAG, "badge window was detached: resetting")
    apply(machine.setVisible(false, count))
    removeNow()
  }

  private fun reduced(): Boolean {
    val resolver = service.contentResolver
    val animator = Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f)
    val transition = Settings.Global.getFloat(resolver, Settings.Global.TRANSITION_ANIMATION_SCALE, 1f)
    return ReducedMotion.isReduced(animator, transition)
  }

  // ---- window and views ----

  private fun addWindow(initial: Int) {
    // A window still fading out (leave) must not block the new one: remove it now.
    if (window != null) removeNow()
    addedAtMs = SystemClock.elapsedRealtime()
    count = initial
    position = prefs.badgePosition()
    val face = service.getColor(R.color.thumbwell_badge_text)
    val counter = OdometerView(service, typeface, 17f, face).also { it.setCount(initial) }
    val capsule = LinearLayout(service).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      elevation = dp(PILL_ELEVATION).toFloat()
      addView(counter, LinearLayout.LayoutParams(-2, -2))
    }
    applyPillPadding(capsule, position.side)
    val art = ImageView(service).apply {
      setImageResource(R.drawable.ic_thumb_badge_closed)
      scaleType = ImageView.ScaleType.FIT_XY
    }
    val box = FrameLayout(service).apply {
      clipChildren = false
      addView(art, FrameLayout.LayoutParams(-1, -1))
      scaleX = REST_SCALE
      scaleY = REST_SCALE
      // Android draws by elevation first and child order second. The pill has an elevation, so the
      // Thumb needs a higher one or it is drawn BEHIND the pill (device bug, M3b). Keep it above
      // every pill elevation, including the lifted one while dragging.
      elevation = dp(THUMB_ELEVATION).toFloat()
    }
    val holder = FrameLayout(service).apply {
      clipChildren = false
      // The group alpha: 0.7 for the whole resting node, 1 awake (Thumb and pill fade as one).
      alpha = 0f
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
      refitAfterFirstLayout(root)
    } catch (e: WindowManager.BadTokenException) {
      Log.w(TAG, "badge add failed: ${e.javaClass.simpleName}")
      clearViews()
    } catch (e: IllegalStateException) {
      Log.w(TAG, "badge add failed: ${e.javaClass.simpleName}")
      clearViews()
    }
  }

  /**
   * The window is added with a frame computed before any view of it was attached, measured or laid
   * out, and a geometry update is skipped while the view is not attached yet. So after the FIRST
   * layout the frame is computed again from the real measure and screen, and the window is moved
   * only if it differs. This is the first-draw fix: the first show ends in the same bounds as every
   * later one.
   */
  private fun refitAfterFirstLayout(root: View) {
    root.addOnLayoutChangeListener(object : View.OnLayoutChangeListener {
      override fun onLayoutChange(
        v: View, l: Int, t: Int, r: Int, b: Int, oL: Int, oT: Int, oR: Int, oB: Int,
      ) {
        v.removeOnLayoutChangeListener(this)
        v.post { refitGeometry() }
      }
    })
  }

  private fun refitGeometry() {
    if (window == null || dragging || snap != null) return
    val frame = awakeGeometry()
    if (frame != appliedFrame) applyGeometry(frame, commit = true)
  }

  private fun describe() {
    window?.contentDescription = service.resources.getQuantityString(
      R.plurals.thumbwell_badge_description, count, count)
  }

  private fun clearViews() {
    window = null; content = null; pill = null; thumbBox = null; thumb = null
    odometer = null; params = null
  }

  /** Pill padding: the socket for the Thumb is on the screen-centre side (A42 side rule). */
  private fun applyPillPadding(capsule: View?, side: BadgeSide) {
    val (l, r) = BadgePlacement.pillPadding(side, PILL_SOCKET, PILL_GAP)
    capsule?.setPadding(dp(l), 0, dp(r), 0)
  }

  /**
   * Pill chrome. Dragging ([lifted]): fully round with a violet ring. Docked ([snapped]): the corners
   * on the screen-edge side are square (radius 0), the inner ones fully round. The shape is kept in
   * [capsuleShape] so the snap can animate its per-corner radii.
   */
  private fun styleCapsule(snapped: Boolean, lifted: Boolean) {
    val capsule = pill ?: return
    val full = dp(PILL_H / 2f).toFloat()
    val shape = GradientDrawable().apply {
      setColor(service.getColor(R.color.thumbwell_badge_bg))
      if (lifted) setStroke(dp(2f), service.getColor(R.color.thumbwell_badge_ring))
      else setStroke(dp(1f), service.getColor(R.color.thumbwell_badge_border))
      cornerRadii = BadgeCorners.radii(snapped && !lifted, position.side, full, cornersNow)
    }
    capsuleShape = shape
    capsule.background = shape
  }

  /**
   * Screen size and safe side insets for placement. The window manager's own metrics are used (API
   * 30+), not [android.content.res.Resources], which on a service context can lag the display (a
   * resolution or size change) and put the first draw off the screen edge. Cutout insets keep the
   * pill out of a side camera hole in landscape; they are 0 in portrait.
   */
  private class Screen(val w: Int, val h: Int, val insetLeft: Int, val insetRight: Int)

  private fun screen(): Screen {
    if (Build.VERSION.SDK_INT >= 30) {
      val metrics = windowManager.currentWindowMetrics
      val cutout = metrics.windowInsets.getInsetsIgnoringVisibility(WindowInsets.Type.displayCutout())
      return Screen(metrics.bounds.width(), metrics.bounds.height(), cutout.left, cutout.right)
    }
    val m = service.resources.displayMetrics
    return Screen(m.widthPixels, m.heightPixels, 0, 0)
  }

  private fun screenW() = screen().w

  private fun screenH() = screen().h

  private fun dims() = BadgePlacement.FrameDims(
    pad = dp(PAD), innerPad = dp(INNER_PAD), pillH = dp(PILL_H), thumbW = dp(THUMB_W), thumbH = dp(THUMB_H),
    rise = dp(THUMB_RISE), nudge = dp(THUMB_NUDGE), keepTop = dp(KEEP_TOP), keepBottom = dp(KEEP_BOTTOM),
  )

  /** Pill width from an explicit measure of the count (bounded by the screen), never a stale value. */
  private fun pillWidthPx(limit: Int): Int {
    val counter = odometer ?: return dp(PILL_MIN_W)
    counter.forceLayout()
    val spec = View.MeasureSpec.makeMeasureSpec(limit, View.MeasureSpec.AT_MOST)
    counter.measure(spec, View.MeasureSpec.makeMeasureSpec(dp(PILL_H), View.MeasureSpec.AT_MOST))
    return dp(PILL_SOCKET) + counter.measuredWidth + dp(PILL_GAP)
  }

  private var appliedFrame: BadgePlacement.Frame? = null

  /**
   * Window and children for [side], from [BadgePlacement.frame]: the same call for the first show
   * and every later one. The pill is flush with the screen edge; the window reaches the pad past it
   * and the inner pad past the centre-facing end (room for the resting Thumb's outer half).
   */
  private fun awakeGeometry(side: BadgeSide = position.side): BadgePlacement.Frame {
    val s = screen()
    return BadgePlacement.frame(
      side, dp(position.yDp), pillWidthPx(s.w - s.insetLeft - s.insetRight), s.w, s.h, s.insetLeft, s.insetRight, dims(),
    )
  }

  private fun applyGeometry(g: BadgePlacement.Frame, commit: Boolean) {
    val lp = params ?: return
    appliedFrame = g
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
    applyGeometry(awakeGeometry(), commit)
    applyRestTransforms()
  }

  private fun restShift(): BadgePlacement.RestShift {
    val g = awakeGeometry()
    return BadgePlacement.restShift(
      position.side, g.pillW.toFloat(), dp(PILL_H).toFloat(), dp(THUMB_W).toFloat(), dp(THUMB_H).toFloat(),
      (g.thumbLeft - g.pillLeft).toFloat(), dp(THUMB_RISE).toFloat(), dp(PILL_SOCKET).toFloat(), dp(PILL_GAP).toFloat(),
    )
  }

  /** Puts the Thumb, its scale, the count and the pill in the A42 end state (alpha is the group's). */
  private fun applyRestTransforms() {
    val box = thumbBox ?: return
    val shift = restShift()
    restThumbDx = shift.thumbDx
    box.translationX = shift.thumbDx; box.translationY = shift.thumbDy
    box.scaleX = REST_SCALE; box.scaleY = REST_SCALE
    odometer?.translationX = shift.countDx
    pill?.translationX = 0f
    updateThumbClip()
  }

  /**
   * The Thumb's inner half is tucked behind the pill at rest (Figma peek frame), but it stays above
   * the pill in the draw order (a Thumb under the pill disappeared on the device). The same look is
   * made by clipping the Thumb to its outer half, in step with how far it has slid to rest. Awake
   * there is no clip. Reuses one Rect, nothing is allocated per frame.
   */
  private fun updateThumbClip() {
    val box = thumbBox ?: return
    val progress = BadgePlacement.restProgress(box.translationX, restThumbDx)
    if (progress <= 0f) {
      box.clipBounds = null
      return
    }
    val w = dp(THUMB_W).toFloat()
    thumbClip.set(
      BadgePlacement.thumbClipLeft(position.side, w, progress).toInt(), 0,
      BadgePlacement.thumbClipRight(position.side, w, progress).toInt(), dp(THUMB_H),
    )
    box.clipBounds = thumbClip
  }

  private fun layoutAwake(commit: Boolean) {
    restingLayout = false
    pill?.visibility = View.VISIBLE
    styleCapsule(snapped = true, lifted = false)
    thumbBox?.clipBounds = null
    applyGeometry(awakeGeometry(), commit)
  }

  // ---- animation helpers ----

  private fun animate(
    target: View, property: android.util.Property<View, Float>, to: Float, ms: Long,
    interpolator: Interpolator, delay: Long = 0L, from: Float? = null, onEnd: (() -> Unit)? = null,
    onUpdate: (() -> Unit)? = null,
  ): ObjectAnimator {
    val a = if (from != null) ObjectAnimator.ofFloat(target, property, from, to)
    else ObjectAnimator.ofFloat(target, property, to)
    a.duration = ms
    a.startDelay = delay
    a.interpolator = interpolator
    if (onUpdate != null) a.addUpdateListener { onUpdate() }
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
    choreographer.removeFrameCallback(dragFrame)
    coalescer.cancel()
    snap?.let {
      // A snap cut short by a hide keeps the position the finger chose.
      it.removeAllListeners(); it.cancel(); snap = null
      prefs.setBadgePosition(position)
    }
    handler.removeCallbacksAndMessages(null)
    if (keepHide) handler.postDelayed(hideDue, BadgeTiming.LEAVE_DELAY_MS)
    blinking = false
    dragging = false
  }

  private fun setEyes(res: Int) = thumb?.setImageResource(res)

  private fun fadeInResting() {
    val group = content ?: return
    if (machine.reducedMotion) {
      group.alpha = REST_ALPHA
      return
    }
    animate(group, View.ALPHA, REST_ALPHA, BadgeTiming.FADE_MS, PathInterpolator(0.4f, 0f, 0.2f, 1f), from = 0f)
  }

  /** A40a pop-out and A40b flick. */
  private fun popOut(a: BadgeAction.PopOut) {
    val box = thumbBox ?: return
    val capsule = pill ?: return
    val art = thumb ?: return
    val wasResting = restingLayout
    val shift = if (a.fromGone || wasResting) restShift() else null
    shift?.let { restThumbDx = it.thumbDx }
    val delta = (shift?.thumbDx ?: 0f) to (shift?.thumbDy ?: 0f)
    val countDx = shift?.countDx ?: 0f
    val group = content ?: return
    // With the pill hidden at rest it fades in with the pop; otherwise it is part of the group.
    val pillStartAlpha = if (BadgeRest.PILL_VISIBLE) 1f else 0f
    cancelAnimators()
    handler.removeCallbacks(eyeOpen)
    if (wasResting) layoutAwake(commit = true)
    val startAlpha = if (a.fromGone) 0f else if (wasResting) REST_ALPHA else 1f
    if (a.reduced) {
      setEyes(R.drawable.ic_thumb_badge_open)
      box.translationX = 0f; box.translationY = 0f; box.scaleX = 1f; box.scaleY = 1f
      capsule.scaleX = 1f
      capsule.translationX = 0f
      odometer?.translationX = 0f
      updateThumbClip()
      box.alpha = 1f
      capsule.alpha = pillStartAlpha
      animate(group, View.ALPHA, 1f, REDUCED_FADE_IN_MS, LinearInterpolator(), from = startAlpha)
      if (pillStartAlpha < 1f) animate(capsule, View.ALPHA, 1f, REDUCED_FADE_IN_MS, LinearInterpolator())
      return
    }
    val spring = OvershootInterpolator(1.1f)
    box.translationX = delta.first; box.translationY = delta.second
    box.scaleX = REST_SCALE; box.scaleY = REST_SCALE
    box.rotation = 0f
    updateThumbClip()
    setEyes(R.drawable.ic_thumb_badge_closed)
    handler.postDelayed(eyeOpen, EYES_OPEN_AT_MS)
    animate(box, View.TRANSLATION_X, 0f, BadgeTiming.POP_MS, spring, onUpdate = ::updateThumbClip)
    animate(box, View.TRANSLATION_Y, 0f, BadgeTiming.POP_MS, spring)
    animate(box, View.SCALE_X, 1f, BadgeTiming.POP_MS, spring)
    animate(box, View.SCALE_Y, 1f, BadgeTiming.POP_MS, spring)
    box.alpha = 1f
    animate(group, View.ALPHA, 1f, BadgeTiming.POP_MS, DecelerateInterpolator(), from = startAlpha)
    // The pill stays put (already on screen, in the 70 percent group) and the group fills to full.
    capsule.scaleX = 1f
    capsule.translationX = 0f
    capsule.alpha = pillStartAlpha
    if (pillStartAlpha < 1f) animate(capsule, View.ALPHA, 1f, BadgeTiming.POP_MS, DecelerateInterpolator())
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
    val group = content ?: return
    cancelAnimators()
    handler.removeCallbacks(bobStop)
    handler.removeCallbacks(blinkStart)
    blinking = false
    content?.translationY = 0f
    thumb?.let { it.translationY = 0f; it.rotation = 0f; it.scaleY = 1f }
    val end = { finishSettle() }
    val shift = restShift()
    restThumbDx = shift.thumbDx
    if (reduced) {
      if (!BadgeRest.PILL_VISIBLE) animate(capsule, View.ALPHA, 0f, BadgeTiming.REDUCED_FADE_MS, LinearInterpolator())
      animate(group, View.ALPHA, REST_ALPHA, BadgeTiming.REDUCED_FADE_MS, LinearInterpolator(), onEnd = end)
      return
    }
    val ease = PathInterpolator(0.4f, 0f, 0.2f, 1f)
    // The pill stays where it is and the whole node dims to 70 percent; the Thumb slides onto its edge end, the
    // count moves inward on the right edge (translate + alpha only, 240 ms).
    if (!BadgeRest.PILL_VISIBLE) animate(capsule, View.ALPHA, 0f, BadgeTiming.SETTLE_MS, ease)
    odometer?.let { animate(it, View.TRANSLATION_X, shift.countDx, BadgeTiming.SETTLE_MS, ease) }
    handler.postDelayed({ setEyes(R.drawable.ic_thumb_badge_half) }, BadgeTiming.BLINK_STEP_MS)
    handler.postDelayed({ setEyes(R.drawable.ic_thumb_badge_closed) }, BadgeTiming.BLINK_STEP_MS * 2)
    animate(box, View.SCALE_X, REST_SCALE, BadgeTiming.SETTLE_MS, ease)
    animate(box, View.SCALE_Y, REST_SCALE, BadgeTiming.SETTLE_MS, ease)
    animate(box, View.TRANSLATION_X, shift.thumbDx, BadgeTiming.SETTLE_MS, ease, onUpdate = ::updateThumbClip)
    animate(box, View.TRANSLATION_Y, shift.thumbDy, BadgeTiming.SETTLE_MS, ease)
    animate(group, View.ALPHA, REST_ALPHA, BadgeTiming.SETTLE_MS, ease, onEnd = end)
  }

  /** The end of A42: no animator or timer is left; the end values are applied once. */
  private fun finishSettle() {
    cancelAll(keepHide = machine.leaving)
    setEyes(R.drawable.ic_thumb_badge_closed)
    content?.alpha = REST_ALPHA
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
    // A touch during a snap lets it finish at once (jumps to the edge and commits); a drag or tap starts from there.
    if (event.actionMasked == MotionEvent.ACTION_DOWN) snap?.end()
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
          // Coalesce: many touch events per frame, one window update per frame.
          if (coalescer.submit(p.x, p.y)) choreographer.postFrameCallback(dragFrame)
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

  /** The frame callback of the drag: one `updateViewLayout`, only if the position changed. */
  private fun onDragFrame() {
    if (!coalescer.take() || !dragging) return
    val root = window ?: return
    val p = params ?: return
    p.x = coalescer.x
    p.y = coalescer.y
    if (root.isAttachedToWindow) {
      try { windowManager.updateViewLayout(root, p) } catch (e: IllegalArgumentException) {
        Log.w(TAG, "badge drag failed: ${e.javaClass.simpleName}")
      }
    }
  }

  /**
   * A31 release: the SAME window slides from the finger to the edge (layout x animated, decelerate,
   * [BadgeTiming.SNAP_MS]); it is never hidden, removed or re-added, and it never moves inside a
   * fixed window (the old translation was clipped by the window and looked like hide/reappear). If
   * the other half of the screen was chosen the Thumb and the count swap ends in the same animation
   * and the corner radii go from fully round to flat-on-the-edge. The final layout is committed once.
   */
  private fun endDrag() {
    val root = window ?: return
    val p = params ?: return
    dragging = false
    choreographer.removeFrameCallback(dragFrame)
    coalescer.cancel()
    val oldSide = position.side
    val old = awakeGeometry(oldSide)
    val centerX = p.x + old.pillLeft + old.pillW / 2f
    val side = BadgePlacement.sideFor(centerX, screenW())
    val y = BadgePlacement.clampY(p.y + dp(PAD) + dp(THUMB_RISE), dp(PILL_H), screenH(), dp(KEEP_TOP), dp(KEEP_BOTTOM))
    position = BadgePosition(side, BadgePlacement.pxToDp(y, density))
    val target = awakeGeometry(side)
    val flipped = side != oldSide
    // The window's inner padding differs per side, so after a flip the pill sits at another offset
    // in the window: start the window shifted back by that much and the pill does not jump.
    val fromX = if (flipped) p.x + old.pillLeft - target.pillLeft else p.x
    val fromY = p.y
    val thumbDx = if (flipped) ((old.thumbLeft - old.pillLeft) - (target.thumbLeft - target.pillLeft)).toFloat() else 0f
    val oldPad = BadgePlacement.pillPadding(oldSide, PILL_SOCKET, PILL_GAP).first
    val newPad = BadgePlacement.pillPadding(side, PILL_SOCKET, PILL_GAP).first
    val countDx = if (flipped) (dp(oldPad) - dp(newPad)).toFloat() else 0f

    val commit = {
      snap = null
      val g = awakeGeometry()
      applyPillPadding(pill, position.side)
      applyGeometry(g, commit = false)
      thumbBox?.translationX = 0f
      odometer?.translationX = 0f
      content?.let { it.scaleX = 1f; it.scaleY = 1f }
      styleCapsule(snapped = true, lifted = false)
      pill?.elevation = dp(PILL_ELEVATION).toFloat()
      if (root.isAttachedToWindow) {
        try { windowManager.updateViewLayout(root, p) } catch (e: IllegalArgumentException) {
          Log.w(TAG, "badge snap failed: ${e.javaClass.simpleName}")
        }
      }
      prefs.setBadgePosition(position)
      restartRest()
    }
    if (machine.reducedMotion) {
      commit()
      return
    }

    // Lay out the NEW inner arrangement once (the pill keeps its width), then slide the Thumb and
    // the count from where they were while the window glides from the finger to the edge.
    if (flipped) {
      applyPillPadding(pill, side)
      applyGeometry(target, commit = false)
      thumbBox?.translationX = thumbDx
      odometer?.translationX = countDx
    }
    p.x = fromX
    p.y = fromY
    val full = dp(PILL_H / 2f).toFloat()
    BadgeCorners.radii(false, oldSide, full, cornersFrom)
    BadgeCorners.radii(true, side, full, cornersTo)
    styleCapsule(snapped = false, lifted = false) // ring off, all corners still round
    pill?.elevation = dp(PILL_ELEVATION).toFloat()
    content?.let {
      animate(it, View.SCALE_X, 1f, BadgeTiming.SNAP_MS, DecelerateInterpolator())
      animate(it, View.SCALE_Y, 1f, BadgeTiming.SNAP_MS, DecelerateInterpolator())
    }
    snap = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = BadgeTiming.SNAP_MS
      interpolator = DecelerateInterpolator(1.8f)
      addUpdateListener { a ->
        val t = a.animatedFraction
        p.x = fromX + ((target.x - fromX) * t).toInt()
        p.y = fromY + ((target.y - fromY) * t).toInt()
        if (flipped) {
          thumbBox?.translationX = thumbDx * (1f - t)
          odometer?.translationX = countDx * (1f - t)
        }
        capsuleShape?.cornerRadii = BadgeCorners.lerp(cornersFrom, cornersTo, t, cornersNow)
        if (root.isAttachedToWindow) {
          try { windowManager.updateViewLayout(root, p) } catch (e: IllegalArgumentException) {
            Log.w(TAG, "badge snap frame failed: ${e.javaClass.simpleName}")
          }
        }
      }
      addListener(object : AnimatorListenerAdapter() {
        override fun onAnimationEnd(animation: Animator) { commit() }
      })
      start()
    }
  }

  private fun restartRest() {
    apply(machine.wake())
  }

  private companion object {
    const val TAG = "ThumbwellBadge"
    const val STALE_AFTER_MS = 1500L
    const val PAD = 12f
    const val INNER_PAD = 28f // PAD on the edge side; on the centre side room for the resting Thumb's outer half
    const val PILL_H = 38f
    const val PILL_SOCKET = 46f
    const val PILL_GAP = 16f
    const val THUMB_NUDGE = 5f
    const val REST_RETRY_MS = 300L
    const val PILL_MIN_W = 80f
    const val THUMB_W = 53.333f
    const val THUMB_H = 60f
    const val THUMB_RISE = 18f
    const val PILL_ELEVATION = 2f
    const val PILL_LIFTED_ELEVATION = 3f
    const val THUMB_ELEVATION = 6f // above both pill elevations: the Thumb is in front of the pill
    const val REST_ALPHA = BadgeRest.NODE_ALPHA
    const val REST_SCALE = 0.93f
    const val KEEP_TOP = 96f
    const val KEEP_BOTTOM = 120f
    const val DRAG_SCALE = 1.2f
    const val DRAG_MS = 100L
    const val EYES_OPEN_AT_MS = 60L
    const val REDUCED_FADE_IN_MS = 100L
  }
}
