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
