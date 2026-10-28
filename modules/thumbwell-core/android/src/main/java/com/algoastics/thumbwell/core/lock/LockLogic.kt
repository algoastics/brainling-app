package com.algoastics.thumbwell.core.lock

import com.algoastics.thumbwell.core.data.ThumbwellDay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * What the limit lock looks like right now (F06). [lockedUntilMs] is the moment the next Thumbwell
 * day starts, and is null while the limit is not reached.
 */
data class LockState(
  val locked: Boolean,
  val limit: Int,
  val total: Int,
  val lockedUntilMs: Long?,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "locked" to locked,
    "limit" to limit,
    "total" to total,
    "lockedUntilMs" to lockedUntilMs?.toDouble(),
  )
}

/** The pure limit rules. No Android types, so the boundary cases are unit-tested on the JVM. */
object LockRules {
  /** Reached at the limit itself; a limit of 0 ("zero mode") is reached before the first reel. */
  fun reached(total: Int, limit: Int): Boolean = total >= limit

  fun state(
    total: Int,
    limit: Int,
    nowMs: Long,
    dayStartMinutes: Int,
    zone: TimeZone,
  ): LockState {
    val locked = reached(total, limit)
    val until = if (locked) LockClock.lockedUntilMs(nowMs, dayStartMinutes, zone) else null
    return LockState(locked, limit, total, until)
  }

  /** True while [state] still holds at [nowMs]: the lock lifts by itself when the day rolls over. */
  fun activeAt(state: LockState, nowMs: Long): Boolean {
    val until = state.lockedUntilMs ?: return false
    return state.locked && nowMs < until
  }
}

/** "Locked until HH:MM": the twin of `src/lock/lockTime.ts`; both are tested against the same cases. */
object LockClock {
  /** The first day start after [nowMs] in [zone]. */
  fun lockedUntilMs(nowMs: Long, dayStartMinutes: Int, zone: TimeZone): Long =
    ThumbwellDay.nextCloseMs(nowMs, zone, dayStartMinutes)

  /** 24-hour HH:MM of an instant in [zone]. */
  fun format(ms: Long, zone: TimeZone): String =
    SimpleDateFormat("HH:mm", Locale.US).apply { timeZone = zone }.format(Date(ms))
}

/**
 * When a reached limit may cover the reels. A lock that appears while the user is watching (the
 * limit reel was just counted) waits for the swipe to the next item, so it never covers a video
 * mid-play. A lock found on arrival (opening the app, re-entering reels, zero mode) shows at once.
 */
class LockTrigger {
  private var wasLocked = false
  private var deferred = false

  /** Feed every lock-state update. [onSurface] is true while a reels surface is on screen. */
  fun onState(locked: Boolean, onSurface: Boolean) {
    if (locked && !wasLocked && onSurface) deferred = true
    if (!locked) deferred = false
    wasLocked = locked
  }

  /** A reels surface appeared (the user arrived): nothing is mid-play, so no waiting. */
  fun onSurfaceEntered() {
    deferred = false
  }

  /** The user started swiping on the surface. True when this swipe releases a waiting lock. */
  fun onSwipe(): Boolean {
    if (!deferred) return false
    deferred = false
    return true
  }

  fun mayShow(locked: Boolean, onSurface: Boolean): Boolean = locked && onSurface && !deferred
}

/** Rectangle in screen pixels (no android.graphics, so it can be tested on the JVM). */
data class Box(val left: Int, val top: Int, val right: Int, val bottom: Int) {
  val width: Int get() = right - left
  val height: Int get() = bottom - top

  fun clampTo(screenW: Int, screenH: Int) =
    Box(left.coerceIn(0, screenW), top.coerceIn(0, screenH), right.coerceIn(0, screenW), bottom.coerceIn(0, screenH))
}

/** Where the overlay may be shown, and what to do when it cannot be. */
object OverlayGuard {
  enum class Verdict { SHOW, WAIT_TEXT_INPUT, BACK_FALLBACK, NOT_ACTIVE }

  /** A focused text field, judged by node flags and class name only, never by its text. */
  fun isTextInput(editable: Boolean, className: String?): Boolean =
    editable || className?.endsWith("EditText") == true

  /**
   * Order matters: never over a focused text input (even in split screen); split screen or any
   * other multi-window layout cannot be covered reliably, so it falls back to BACK.
   */
  fun decide(active: Boolean, consent: Boolean, focusedTextInput: Boolean, multiWindow: Boolean): Verdict =
    when {
      !active || !consent -> Verdict.NOT_ACTIVE
      focusedTextInput -> Verdict.WAIT_TEXT_INPUT
      multiWindow -> Verdict.BACK_FALLBACK
      else -> Verdict.SHOW
    }

  /** The app window is clearly smaller than the screen: split screen, freeform or a small window. */
  fun isMultiWindow(app: Box?, screenW: Int, screenH: Int): Boolean {
    if (app == null || screenW <= 0 || screenH <= 0) return false
    return app.width < screenW * 9 / 10 || app.height < screenH * 3 / 4
  }

  /**
   * ONE constant for the free strip above the lock: the heads-up notification area under the
   * status bar. A TYPE_ACCESSIBILITY_OVERLAY window is drawn above heads-up banners (layer 31
   * against 15 and 17 in AOSP), so banners can only show above the lock if the lock starts below
   * them. The strip is full width and the lock has rounded top corners, so it reads as an edge.
   */
  const val HEADS_UP_BAND_DP = 96
  const val STATUS_BAR_FALLBACK_DP = 24

  /** Height in px of the band the lock leaves free: status bar plus the heads-up area. */
  fun topBandPx(statusBarPx: Int, density: Float): Int {
    val bar = if (statusBarPx > 0) statusBarPx else (STATUS_BAR_FALLBACK_DP * density + 0.5f).toInt()
    return bar + (HEADS_UP_BAND_DP * density + 0.5f).toInt()
  }

  /**
   * [box] without its top [bandPx]. Left as it is when it already starts below the band, or when
   * cutting would leave less than half of it (split screen, landscape: covering matters more).
   */
  fun leaveTopBand(box: Box, bandPx: Int): Box {
    if (bandPx <= 0 || box.top >= bandPx) return box
    val cut = Box(box.left, bandPx, box.right, box.bottom)
    return if (cut.height < box.height / 2) box else cut
  }
}

/**
 * The ONE window of the lock: the [cover] drawn by the lock plus a see-through strip above it
 * that absorbs touches, so a reel cannot be scrolled through the free top strip. [window] runs from
 * the bottom of the status bar (or the cover's own top when that is higher) to the cover's bottom;
 * the status bar area stays out of it, because SystemUI's own window already receives touches there
 * (it shows no reel input) and the notification shade pull-down must keep working. [strip] is the
 * height of the absorbing part at the top of [window]. One window means the strip exists exactly
 * while the lock exists: no second add or remove path to leak.
 */
data class LockFrame(val window: Box, val strip: Int) {
  /** The cover part of the window, in screen coordinates. */
  val cover: Box get() = Box(window.left, window.top + strip, window.right, window.bottom)

  companion object {
    fun of(cover: Box, statusBarPx: Int): LockFrame {
      val top = minOf(cover.top, maxOf(statusBarPx, 0))
      return LockFrame(Box(cover.left, top, cover.right, cover.bottom), cover.top - top)
    }
  }
}

/** Which window type the lock is drawn in. */
enum class LockWindowKind {
  /**
   * TYPE_APPLICATION_OVERLAY (layer 11), needs "Display over other apps". Below heads-up banners
   * (17), the status bar (15) and the navigation bar (24), so banners show and stay tappable and the
   * shade pull-down is untouched. Edge to edge, opaque.
   */
  APPLICATION_OVERLAY,

  /**
   * TYPE_ACCESSIBILITY_OVERLAY (layer 31), the fallback without the permission. Above banners, so
   * the lock leaves a see-through, touch-absorbing strip at the top ([LockFrame]).
   */
  ACCESSIBILITY_OVERLAY,
}

/** Picks the window type at lock show time, and the frame each type needs. Pure. */
object LockWindowChoice {
  /** TYPE_APPLICATION_OVERLAY exists from API 26 (Android 8). */
  const val MIN_SDK_APPLICATION_OVERLAY = 26

  fun choose(canDrawOverlays: Boolean, sdk: Int): LockWindowKind =
    if (canDrawOverlays && sdk >= MIN_SDK_APPLICATION_OVERLAY) {
      LockWindowKind.APPLICATION_OVERLAY
    } else {
      LockWindowKind.ACCESSIBILITY_OVERLAY
    }

  /**
   * The window frame for [picked] (the reels container minus the tab bar, from [LockBounds]).
   * APPLICATION_OVERLAY: from the very top of the screen (status bar area included) to the bottom of
   * [picked], no strip. ACCESSIBILITY_OVERLAY: the free-strip frame ([OverlayGuard.leaveTopBand],
   * [LockFrame.of]).
   */
  fun frame(kind: LockWindowKind, picked: Box, statusBarPx: Int, bandPx: Int): LockFrame =
    when (kind) {
      LockWindowKind.APPLICATION_OVERLAY ->
        LockFrame(Box(picked.left, 0, picked.right, picked.bottom), 0)
      LockWindowKind.ACCESSIBILITY_OVERLAY ->
        LockFrame.of(OverlayGuard.leaveTopBand(picked, bandPx), statusBarPx)
    }
}

/**
 * The "Display over other apps" state, read at most every [ttlMs] so a busy event stream does not
 * ask the system each time. A refused add of an application overlay ([denied]) makes it read as not
 * granted for [DENY_MS], so the fallback is used at once and the two window types do not flicker.
 */
class OverlayPermissionProbe(private val ttlMs: Long = 1500L) {
  private var value = false
  private var readAt = Long.MIN_VALUE
  private var deniedUntil = Long.MIN_VALUE

  fun granted(now: Long, read: () -> Boolean): Boolean {
    if (now < deniedUntil) return false
    if (readAt == Long.MIN_VALUE || now - readAt >= ttlMs || now < readAt) {
      value = read()
      readAt = now
    }
    return value
  }

  fun denied(now: Long) {
    deniedUntil = now + DENY_MS
  }

  companion object {
    const val DENY_MS = 30_000L
  }
}

/**
 * The "Leave reels" button as a small state machine (LOCK-B). First press: tap the app's Home tab
 * when it has one ([Action.TAB]); an app whose Home is itself the reels feed (TikTok, `homeOnly`)
 * goes straight to the phone Home screen ([Action.PHONE_HOME], no toast: it is the intended exit).
 * Otherwise BACK. If after [TAB_CHECK_MS] the user is still on a reels surface (tab not found or
 * not clickable), BACK is tried. If after [BACK_CHECK_MS] the user is still on reels (BACK loops),
 * wait [COOLDOWN_MS], then HOME (the service shows a toast). Presses during a check or the
 * cooldown are ignored. BACK and HOME are the last resort for an app with a Home tab.
 */
class LeaveFlow {
  enum class Action { TAB, BACK, HOME, PHONE_HOME }

  private enum class Phase { IDLE, TAB_SENT, PHONE_HOME_SENT, BACK_SENT, COOLDOWN }

  private var phase = Phase.IDLE
  private var cooldownEndMs = 0L

  val busy: Boolean get() = phase != Phase.IDLE

  /**
   * [tabAvailable]: the app has a Home tab node that can be tapped right now. [homeOnly]: the app
   * has no Home tab to go to (TikTok), so the exit is the phone Home screen.
   */
  fun press(tabAvailable: Boolean = false, homeOnly: Boolean = false): Action? {
    if (phase != Phase.IDLE) return null
    if (homeOnly) {
      phase = Phase.PHONE_HOME_SENT
      return Action.PHONE_HOME
    }
    return if (tabAvailable) {
      phase = Phase.TAB_SENT
      Action.TAB
    } else {
      phase = Phase.BACK_SENT
      Action.BACK
    }
  }

  /** After [TAB_CHECK_MS] of a [Action.PHONE_HOME]: the flow is over, nothing else is sent. */
  fun phoneHomeChecked() {
    if (phase == Phase.PHONE_HOME_SENT) phase = Phase.IDLE
  }

  /** After [TAB_CHECK_MS]: null when the tab worked, else BACK (the next step). */
  fun tabChecked(stillOnReels: Boolean): Action? {
    if (phase != Phase.TAB_SENT) return null
    if (!stillOnReels) {
      phase = Phase.IDLE
      return null
    }
    phase = Phase.BACK_SENT
    return Action.BACK
  }

  /** After [BACK_CHECK_MS]: the cooldown end time to wait for, or null when BACK worked. */
  fun backChecked(nowMs: Long, stillOnReels: Boolean): Long? {
    if (phase != Phase.BACK_SENT) return null
    if (!stillOnReels) {
      phase = Phase.IDLE
      return null
    }
    phase = Phase.COOLDOWN
    cooldownEndMs = nowMs + COOLDOWN_MS
    return cooldownEndMs
  }

  /** At the cooldown end: HOME when the user is still on reels, else nothing. */
  fun cooldownElapsed(nowMs: Long, stillOnReels: Boolean): Action? {
    if (phase != Phase.COOLDOWN || nowMs < cooldownEndMs) return null
    phase = Phase.IDLE
    return if (stillOnReels) Action.HOME else null
  }

  fun reset() {
    phase = Phase.IDLE
  }

  companion object {
    const val TAB_CHECK_MS = 700L
    const val BACK_CHECK_MS = 700L
    const val COOLDOWN_MS = 1_500L
  }
}
