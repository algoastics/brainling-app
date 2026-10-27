package com.algoastics.thumbwell.core.detection

import java.util.Locale

/** How long the Thumb stays awake after a counted reel (S43-P0 "Badge display time"). */
enum class BadgeDisplayTime(val key: String, val ms: Long?) {
  ONE("1s", 1_000L),
  TWO("2s", 2_000L),
  THREE("3s", 3_000L),
  /**
   * Never rests: awake and visible while a tracked app is in front. The bob stops after
   * [BadgeTiming.BOB_STOP_ALWAYS_MS]; the blink continues (3 to 5 s).
   */
  ALWAYS("always", null),
  ;

  companion object {
    /** PM decision: the count stays visible the whole time a tracked app is in front. */
    val DEFAULT = ALWAYS
    fun fromKey(key: String?): BadgeDisplayTime = entries.firstOrNull { it.key == key } ?: DEFAULT
  }
}

/**
 * What the badge looks like while resting (PM decision, option B). One flag to flip: when
 * [PILL_VISIBLE] is false the resting badge is the sleeping Thumb alone (the original spec).
 */
object BadgeRest {
  /** The count pill stays on screen next to the sleeping Thumb while resting. */
  const val PILL_VISIBLE = true

  /** Opacity of the count pill while resting. */
  const val PILL_ALPHA = 0.7f

  /** Opacity of the sleeping Thumb. */
  const val THUMB_ALPHA = 0.4f
}

/** The three native-stored badge switches (S43-P0). */
data class BadgeSettings(
  val enabled: Boolean = true,
  val displayTime: BadgeDisplayTime = BadgeDisplayTime.DEFAULT,
  val hideWhenResting: Boolean = false,
)

enum class BadgeSide { LEFT, RIGHT }

/** Saved badge position: the edge it is snapped to and the top of its pill in dp. */
data class BadgePosition(val side: BadgeSide = BadgeSide.RIGHT, val yDp: Float = DEFAULT_Y_DP) {
  companion object {
    const val DEFAULT_Y_DP = 140f
  }
}

/** Timings from the Figma spec cards (A40 to A43, A31). All in ms. */
object BadgeTiming {
  const val POP_MS = 200L
  const val FLICK_UP_MS = 140L
  const val FLICK_SETTLE_MS = 160L
  const val FLICK_START_MS = 100L
  const val BOB_CYCLE_MS = 1_600L
  const val BOB_STOP_ALWAYS_MS = 10_000L
  const val BLINK_STEP_MS = 40L
  const val BLINK_MIN_GAP_MS = 3_000L
  const val BLINK_JITTER_MS = 2_001
  const val SETTLE_MS = 240L
  const val FADE_MS = 150L
  const val REDUCED_FADE_MS = 120L
  const val LEAVE_DELAY_MS = 600L

  /** A non-tracked window must stay in front this long before the badge hides (transient windows). */
  const val LEAVE_FOREGROUND_DEBOUNCE_MS = 400L
  const val SNAP_MS = 220L

  /** Next blink after 3000 + nextInt(2001) ms; [jitter] is the random draw in 0 until 2001. */
  fun nextBlinkMs(jitter: Int): Long = BLINK_MIN_GAP_MS + jitter.coerceIn(0, BLINK_JITTER_MS - 1)
}

/** True when the user turned animations off (animator or transition scale 0). */
object ReducedMotion {
  fun isReduced(animatorScale: Float, transitionScale: Float): Boolean =
    animatorScale <= 0f || transitionScale <= 0f
}

/**
 * Decides, from each foreground-package sample, whether the badge hides. One sample of another
 * package (a system window, the app's own popup, a null root while the screen redraws) must not
 * hide it: that is what made the badge vanish and come back while scrolling. Rules:
 * - a safety package ([OverlaySafetyPackages]) hides at once;
 * - the tracked app in front keeps it;
 * - anything else hides only after staying in front for [debounceMs];
 * - one hide per show: [Verdict.HIDE] / [Verdict.HIDE_NOW] come once, then [Verdict.ALREADY_HIDDEN]
 *   until [reset] (called when the badge is shown again).
 */
class BadgeForeground(private val debounceMs: Long = BadgeTiming.LEAVE_FOREGROUND_DEBOUNCE_MS) {
  enum class Verdict { KEEP, HIDE_NOW, HIDE, ALREADY_HIDDEN }

  private var awaySince: Long? = null
  private var hidden = false

  fun reset() {
    awaySince = null
    hidden = false
  }

  fun check(activePackage: String?, trackedPackage: String, nowMs: Long): Verdict {
    if (hidden) return Verdict.ALREADY_HIDDEN
    if (OverlaySafetyPackages.matches(activePackage)) {
      hidden = true
      awaySince = null
      return Verdict.HIDE_NOW
    }
    if (activePackage == trackedPackage) {
      awaySince = null
      return Verdict.KEEP
    }
    val since = awaySince ?: nowMs.also { awaySince = it }
    if (nowMs - since < debounceMs) return Verdict.KEEP
    hidden = true
    awaySince = null
    return Verdict.HIDE
  }
}

/** When the badge may be on screen at all. Pure; the service feeds it the live facts. */
object BadgeGate {
  fun visible(
    enabled: Boolean,
    countingAllowed: Boolean,
    onReelsSurface: Boolean,
    lockShowing: Boolean,
    textInputOrKeyboard: Boolean,
    /** The foreground window is Settings, Accessibility settings or an installer (F07-10). */
    safetyWindow: Boolean = false,
  ): Boolean =
    enabled && countingAllowed && onReelsSurface && !lockShowing && !textInputOrKeyboard && !safetyWindow
}

/** One digit slot of the odometer: [fromRight] is the slot index (0 = ones) in the new text. */
data class DigitRoll(val fromRight: Int, val old: Char?, val new: Char, val delayMs: Long)

/** Count text and the per-digit roll plan (A40c): 150 ms per digit, +30 ms per place. */
object Odometer {
  const val DIGIT_MS = 150L
  const val STAGGER_MS = 30L

  fun format(count: Int): String = String.format(Locale.US, "%,d", count)

  /** Only the digits that change roll, ones first; a new leading place rolls in from below. */
  fun plan(old: Int, new: Int): List<DigitRoll> {
    val oldText = format(old)
    val newText = format(new)
    val out = ArrayList<DigitRoll>()
    var place = 0
    for (i in 0 until newText.length) {
      val c = newText[newText.length - 1 - i]
      if (c == ',') continue
      val oc = oldText.getOrNull(oldText.length - 1 - i)?.takeIf { it != ',' }
      if (oc != c) out.add(DigitRoll(i, oc, c, place * STAGGER_MS))
      place++
    }
    return out
  }

  fun totalMs(plan: List<DigitRoll>): Long = plan.maxOfOrNull { it.delayMs + DIGIT_MS } ?: 0L

  /** True when the text gains a character, so the pill and window grow once. */
  fun grows(old: Int, new: Int): Boolean = format(new).length > format(old).length
}

/** Snap and clamp maths for the A31 drag (all in px unless named dp). */
object BadgePlacement {
  fun sideFor(centerX: Float, screenWidth: Int): BadgeSide =
    if (centerX < screenWidth / 2f) BadgeSide.LEFT else BadgeSide.RIGHT

  /** Left edge of the pill when snapped. */
  fun snappedX(side: BadgeSide, pillWidth: Int, screenWidth: Int): Int =
    if (side == BadgeSide.LEFT) 0 else screenWidth - pillWidth

  /** Keeps the pill between the top and bottom keep-out bands. */
  fun clampY(y: Int, pillHeight: Int, screenHeight: Int, keepTop: Int, keepBottom: Int): Int {
    val max = maxOf(keepTop, screenHeight - keepBottom - pillHeight)
    return y.coerceIn(keepTop, max)
  }

  /** Where the pieces of the resting badge sit; all x values in px. */
  data class RestLayout(val windowX: Int, val windowW: Int, val pillLeft: Int, val thumbLeft: Int)

  /**
   * Resting badge: the pill stays on screen and the sleeping Thumb sits beside it, half of it past
   * the screen edge ([visible] px stay on screen). [pillW] is 0 when the pill is not shown at rest.
   * [pillLeft] and [thumbLeft] are inside the window; the window starts [pad] before its first part.
   * RIGHT: pill, then Thumb at the edge. LEFT: Thumb at the edge, then pill. They touch, never overlap.
   */
  fun restLayout(side: BadgeSide, screenWidth: Int, pillW: Int, thumbW: Int, visible: Int, pad: Int): RestLayout =
    if (side == BadgeSide.RIGHT) {
      val thumbScreen = screenWidth - visible
      RestLayout(thumbScreen - pillW - pad, pad + pillW + thumbW, pad, pad + pillW)
    } else {
      val thumbScreen = -(thumbW - visible)
      RestLayout(thumbScreen - pad, pad + thumbW + pillW, pad + thumbW, pad)
    }

  /** x of the Thumb inside a resting window so half of it is off the screen edge. */
  fun restingThumbX(side: BadgeSide, windowWidth: Int, thumbWidth: Int, visible: Int): Int =
    if (side == BadgeSide.LEFT) -(thumbWidth - visible) else windowWidth - visible

  fun dpToPx(dp: Float, density: Float): Int = (dp * density + 0.5f).toInt()
  fun pxToDp(px: Int, density: Float): Float = px / density
}

sealed interface BadgeAction {
  /** Adds the window (alpha 0) showing [count]. */
  data class Add(val count: Int) : BadgeAction
  /** Fade the resting Thumb in (alpha 0 to 0.4, 150 ms; instant when reduced). */
  data object FadeInResting : BadgeAction
  /** A40a pop-out, then the A40b flick when [flick]. [fromGone]: starts from alpha 0. */
  data class PopOut(val flick: Boolean, val fromGone: Boolean, val reduced: Boolean) : BadgeAction
  /** A40c: roll the digits from [from] to [to]. */
  data class Roll(val from: Int, val to: Int) : BadgeAction
  /** Swap the text now (reset at midnight, reduced motion, no change of mode). */
  data class SetCount(val count: Int) : BadgeAction
  data class StartBob(val stopAfterMs: Long?) : BadgeAction
  data object StartBlink : BadgeAction
  /** Restarts the rest timer: removeCallbacks then postDelayed. */
  data class ScheduleRest(val ms: Long) : BadgeAction
  data object CancelRest : BadgeAction
  /** A42 settle into the half-off-edge sleeping Thumb. */
  data class SettleToRest(val reduced: Boolean) : BadgeAction
  /** A42b / leave fade (150 ms) and then remove the window. */
  data object FadeOutRemove : BadgeAction
  /** Remove at once, no fade (keyboard, lock, switch off, service off). */
  data object RemoveNow : BadgeAction
  data class ScheduleHide(val ms: Long) : BadgeAction
  data object CancelHide : BadgeAction
}

enum class BadgeTap { OPEN_APP, WOKE }

/**
 * Pure badge state machine (A40 to A43, rest, hide). The overlay turns the returned actions into
 * views and animators on one Handler; nothing here touches Android.
 */
class BadgeMachine(settings: BadgeSettings = BadgeSettings()) {
  enum class Mode { GONE, RESTING, AWAKE }

  var mode = Mode.GONE
    private set
  var shownCount = 0
    private set
  var settings: BadgeSettings = settings
    private set
  var reducedMotion = false
  private var visible = false
  private var hidePending = false

  /** True while the fade-out after leaving the surface is pending. */
  val leaving: Boolean get() = hidePending

  /** The gate ([BadgeGate]) changed. [count] is today's count for the foreground app. */
  fun setVisible(now: Boolean, count: Int): List<BadgeAction> {
    val out = ArrayList<BadgeAction>()
    if (now) {
      visible = true
      if (hidePending) {
        hidePending = false
        out.add(BadgeAction.CancelHide)
      }
      if (mode == Mode.GONE) {
        shownCount = count
        if (settings.displayTime == BadgeDisplayTime.ALWAYS) {
          // Always: no resting. Arriving on the surface pops the Thumb out awake with the count.
          mode = Mode.AWAKE
          out.add(BadgeAction.Add(count))
          out.add(BadgeAction.PopOut(flick = !reducedMotion, fromGone = true, reduced = reducedMotion))
          out.addAll(awakeTail())
        } else if (!settings.hideWhenResting) {
          mode = Mode.RESTING
          out.add(BadgeAction.Add(count))
          out.add(BadgeAction.FadeInResting)
        }
      }
    } else {
      visible = false
      hidePending = false
      if (mode != Mode.GONE) {
        mode = Mode.GONE
        out.add(BadgeAction.CancelHide)
        out.add(BadgeAction.RemoveNow)
      }
    }
    return out
  }

  /** The app or surface was left: fade out after 600 ms unless it comes back. */
  fun leave(): List<BadgeAction> {
    if (mode == Mode.GONE || hidePending) return emptyList()
    hidePending = true
    return listOf(BadgeAction.ScheduleHide(BadgeTiming.LEAVE_DELAY_MS))
  }

  fun onHideDue(): List<BadgeAction> {
    if (!hidePending) return emptyList()
    hidePending = false
    visible = false
    if (mode == Mode.GONE) return emptyList()
    mode = Mode.GONE
    return listOf(BadgeAction.CancelRest, BadgeAction.FadeOutRemove)
  }

  /** Today's count for the foreground app changed to [count] (a counted reel, or a reset). */
  fun onCount(count: Int): List<BadgeAction> {
    val prev = shownCount
    if (count == prev) return emptyList()
    if (!visible) {
      shownCount = count
      return emptyList()
    }
    if (count < prev) {
      shownCount = count
      return if (mode == Mode.GONE) emptyList() else listOf(BadgeAction.SetCount(count))
    }
    shownCount = count
    val out = ArrayList<BadgeAction>()
    val reduced = reducedMotion
    val roll: BadgeAction =
      if (reduced) BadgeAction.SetCount(count) else BadgeAction.Roll(prev, count)
    when (mode) {
      Mode.GONE -> {
        mode = Mode.AWAKE
        out.add(BadgeAction.Add(prev))
        out.add(BadgeAction.PopOut(flick = !reduced, fromGone = true, reduced = reduced))
        out.add(roll)
      }
      Mode.RESTING -> {
        mode = Mode.AWAKE
        out.add(BadgeAction.PopOut(flick = !reduced, fromGone = false, reduced = reduced))
        out.add(roll)
      }
      // Consecutive reel inside the display window: only the digits roll.
      Mode.AWAKE -> out.add(roll)
    }
    out.addAll(awakeTail())
    return out
  }

  /** Bob, blink and the rest timer (re)started whenever a reel is counted or the badge is woken. */
  private fun awakeTail(): List<BadgeAction> {
    val out = ArrayList<BadgeAction>()
    if (!reducedMotion) {
      out.add(
        BadgeAction.StartBob(
          if (settings.displayTime == BadgeDisplayTime.ALWAYS) BadgeTiming.BOB_STOP_ALWAYS_MS else null,
        ),
      )
      out.add(BadgeAction.StartBlink)
    }
    val ms = settings.displayTime.ms
    out.add(if (ms == null) BadgeAction.CancelRest else BadgeAction.ScheduleRest(ms))
    return out
  }

  fun onRestDue(): List<BadgeAction> {
    if (mode != Mode.AWAKE || settings.displayTime.ms == null) return emptyList()
    return if (settings.hideWhenResting) {
      mode = Mode.GONE
      listOf(BadgeAction.FadeOutRemove)
    } else {
      mode = Mode.RESTING
      listOf(BadgeAction.SettleToRest(reducedMotion))
    }
  }

  /** Touch on the badge: wakes a resting Thumb (no roll), or opens Thumbwell when awake. */
  fun onTap(): Pair<BadgeTap, List<BadgeAction>> =
    if (mode == Mode.AWAKE) BadgeTap.OPEN_APP to emptyList() else BadgeTap.WOKE to wake()

  /** Drag start on a resting Thumb wakes it like a tap. */
  fun wake(): List<BadgeAction> {
    if (mode == Mode.GONE) return emptyList()
    val out = ArrayList<BadgeAction>()
    if (mode == Mode.RESTING) {
      mode = Mode.AWAKE
      out.add(BadgeAction.PopOut(flick = !reducedMotion, fromGone = false, reduced = reducedMotion))
    }
    out.addAll(awakeTail())
    return out
  }

  fun onSettings(next: BadgeSettings): List<BadgeAction> {
    val prev = settings
    settings = next
    val out = ArrayList<BadgeAction>()
    if (next.displayTime != prev.displayTime && mode == Mode.AWAKE) {
      val ms = next.displayTime.ms
      out.add(if (ms == null) BadgeAction.CancelRest else BadgeAction.ScheduleRest(ms))
      if (!reducedMotion) {
        out.add(
          BadgeAction.StartBob(
            if (next.displayTime == BadgeDisplayTime.ALWAYS) BadgeTiming.BOB_STOP_ALWAYS_MS else null,
          ),
        )
      }
    }
    if (next.displayTime == BadgeDisplayTime.ALWAYS && prev.displayTime != BadgeDisplayTime.ALWAYS && visible) {
      // Switched to Always while resting or hidden: wake it and keep it awake.
      if (mode == Mode.RESTING) {
        out.addAll(wake())
      } else if (mode == Mode.GONE) {
        mode = Mode.AWAKE
        out.add(BadgeAction.Add(shownCount))
        out.add(BadgeAction.PopOut(flick = !reducedMotion, fromGone = true, reduced = reducedMotion))
        out.addAll(awakeTail())
      }
    }
    if (next.hideWhenResting != prev.hideWhenResting && visible && next.displayTime != BadgeDisplayTime.ALWAYS) {
      if (next.hideWhenResting && mode == Mode.RESTING) {
        mode = Mode.GONE
        out.add(BadgeAction.FadeOutRemove)
      } else if (!next.hideWhenResting && mode == Mode.GONE) {
        mode = Mode.RESTING
        out.add(BadgeAction.Add(shownCount))
        out.add(BadgeAction.FadeInResting)
      }
    }
    return out
  }
}
