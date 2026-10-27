package com.algoastics.thumbwell.core.lock

/**
 * Tracks "the user just opened this app" so a lock that is already active can cover it on the FIRST
 * event, before any reels surface is detected. Pure. An app is entered on its first event while it
 * is the active window; it stays entered until the foreground watch sees it leave (Home, Recents,
 * another app), which calls [left].
 *
 * The "lock covers the NEXT item after the first swipe" rule ([LockTrigger]) is only for the live
 * limit reel. Opening an app while already locked is an entry: nothing is mid-play, so no waiting.
 */
class AppEntry {
  private var entered: String? = null

  val current: String? get() = entered

  /** True when [packageName] was not entered yet. Events of a window that is not active never count. */
  fun onEvent(packageName: String, isActiveWindow: Boolean): Boolean {
    if (!isActiveWindow || entered == packageName) return false
    entered = packageName
    return true
  }

  fun left() {
    entered = null
  }

  companion object {
    /**
     * Whether an event of [packageName] means "this app's window is up". The active window is the
     * app itself, or, for a window-state event, not known yet: a cold start (splash) or a return
     * from Recents reports the new window a few frames before the active-window query follows, and
     * waiting for that is the 1 to 2 s of sound before the cover. Another app in front never counts.
     */
    fun windowIsUp(activePackage: String?, packageName: String, isWindowStateEvent: Boolean): Boolean =
      activePackage == packageName || (activePackage == null && isWindowStateEvent)
  }
}

/**
 * Policy for the HOME fallback: audio focus and the media key do not stop a reels app on every phone
 * (see [LockAudio]), so after the lock has been up [DELAY_MS] the service sends HOME, which stops
 * the sound for certain. Guards so the user is never trapped: not while "Leave reels" is running,
 * at least [COOLDOWN_MS] between two, and at most [MAX_COUNT] per [WINDOW_MS]; past that the lock
 * simply stays up (the sound is then best effort). Pure.
 */
class HomeFallback {
  private val sent = ArrayList<Long>()

  /** True when HOME should be sent now. [shownAtMs] is when the cover appeared (0 = not shown). */
  fun due(shownAtMs: Long, nowMs: Long, leaving: Boolean): Boolean {
    if (shownAtMs <= 0L || leaving || nowMs - shownAtMs < DELAY_MS) return false
    sent.removeAll { nowMs - it >= WINDOW_MS }
    if (sent.size >= MAX_COUNT) return false
    return sent.isEmpty() || nowMs - sent.last() >= COOLDOWN_MS
  }

  fun record(nowMs: Long) {
    sent.add(nowMs)
  }

  fun reset() {
    sent.clear()
  }

  companion object {
    const val DELAY_MS = 700L
    const val COOLDOWN_MS = 3_000L
    const val MAX_COUNT = 3
    const val WINDOW_MS = 60_000L
  }
}

/** When a lock covers an app before its reels surface is seen, and for how long it may wait. */
object EarlyCover {
  /**
   * Apps whose first screen IS the reels feed (TikTok). Others (Instagram, YouTube) open on a feed
   * or Home tab, where covering the whole app on launch would block the non-reels screens, so they
   * only get an immediate first evaluation. Add a rule key here to cover on entry too.
   */
  val COVER_ON_ENTRY_KEYS: Set<String> = linkedSetOf("tiktok", "tiktok_lite")

  /** A provisional cover with no reels surface after this long is removed (no surface found). */
  const val GRACE_MS = 3_000L

  fun coversOnEntry(ruleKey: String): Boolean = ruleKey in COVER_ON_ENTRY_KEYS

  fun expired(shownAtMs: Long, nowMs: Long): Boolean = nowMs - shownAtMs >= GRACE_MS
}
