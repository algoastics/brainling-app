package com.algoastics.thumbwell.core.detection

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.content.Context
import android.graphics.Paint
import android.graphics.Typeface
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

/**
 * The count as an odometer (A40c): one clipped slot per character, each digit that changes rolls
 * (old out upward, new in from below) for 150 ms, ones first, +30 ms per place. Only translationY
 * and alpha animate. [finish] completes a running roll at once; [cancel] drops it.
 */
class OdometerView(
  context: Context,
  private val face: Typeface,
  private val sizeSp: Float,
  private val colorInt: Int,
) : LinearLayout(context) {
  private val density = resources.displayMetrics.density
  private val paint = Paint().apply {
    typeface = face
    textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sizeSp, resources.displayMetrics)
  }
  private val slotH = Math.ceil((paint.descent() - paint.ascent()).toDouble()).toInt()
  private val digitW = Math.ceil("0123456789".maxOf { paint.measureText(it.toString()) }.toDouble()).toInt()
  private val commaW = Math.ceil(paint.measureText(",").toDouble()).toInt()
  private val running = ArrayList<Animator>()

  init {
    orientation = HORIZONTAL
    gravity = Gravity.CENTER_VERTICAL
    clipChildren = false
    clipToPadding = false
  }

  val textHeight: Int get() = slotH

  private fun label(c: Char): TextView = TextView(context).apply {
    text = c.toString()
    typeface = face
    setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
    setTextColor(colorInt)
    gravity = Gravity.CENTER
    includeFontPadding = false
    fontFeatureSettings = "tnum"
    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
  }

  private fun slot(c: Char): FrameLayout = FrameLayout(context).apply {
    clipChildren = true
    layoutParams = LayoutParams(if (c == ',') commaW else digitW, slotH)
    addView(label(c), FrameLayout.LayoutParams(-1, -1))
  }

  /** Instant swap (reset, reduced motion, first draw). */
  fun setCount(count: Int) {
    cancel()
    removeAllViews()
    Odometer.format(count).forEach { addView(slot(it)) }
  }

  /** Rolls to [to]; [from] only decides which digits change. */
  fun roll(from: Int, to: Int) {
    finish()
    val plan = Odometer.plan(from, to)
    removeAllViews()
    val text = Odometer.format(to)
    text.forEach { addView(slot(it)) }
    for (r in plan) {
      val slot = getChildAt(childCount - 1 - r.fromRight) as FrameLayout
      val fresh = slot.getChildAt(0)
      fresh.alpha = 0f
      fresh.translationY = slotH.toFloat()
      run(fresh, slotH.toFloat(), 0f, 0f, 1f, r.delayMs)
      if (r.old != null) {
        val gone = label(r.old)
        slot.addView(gone, FrameLayout.LayoutParams(-1, -1))
        run(gone, 0f, -slotH.toFloat(), 1f, 0f, r.delayMs, removeAtEnd = true)
      }
    }
  }

  private fun run(
    view: View, fromY: Float, toY: Float, fromA: Float, toA: Float, delay: Long,
    removeAtEnd: Boolean = false,
  ) {
    view.translationY = fromY
    view.alpha = fromA
    val move = ObjectAnimator.ofFloat(view, TRANSLATION_Y, fromY, toY)
    val fade = ObjectAnimator.ofFloat(view, ALPHA, fromA, toA)
    for (a in listOf(move, fade)) {
      a.duration = Odometer.DIGIT_MS
      a.startDelay = delay
      a.interpolator = DecelerateInterpolator(1.5f)
      running.add(a)
    }
    fade.addListener(object : AnimatorListenerAdapter() {
      override fun onAnimationEnd(animation: Animator) {
        running.remove(move)
        running.remove(fade)
        if (removeAtEnd) (view.parent as? FrameLayout)?.removeView(view)
      }
    })
    move.start()
    fade.start()
  }

  /** Completes any running roll now (a new count arrived mid-roll). */
  fun finish() {
    val live = ArrayList(running)
    running.clear()
    live.forEach { it.end() }
  }

  fun cancel() {
    val live = ArrayList(running)
    running.clear()
    live.forEach { it.removeAllListeners(); it.cancel() }
  }
}
