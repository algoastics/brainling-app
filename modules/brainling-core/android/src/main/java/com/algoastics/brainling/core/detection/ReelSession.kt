package com.algoastics.brainling.core.detection

/** Identity of a reel-player pager (or surface) node: its window plus the node's hash. */
data class PlayerKey(val windowId: Int, val nodeId: Long) {
  override fun toString() = "w$windowId:${java.lang.Long.toHexString(nodeId)}"
}

/**
 * Per-app counting state machine (pure; unit-tested). A reel counts when it settles on screen
 * for [settleMs] after a page change (pager index, swipe fallback, page flip) or a player open.
 *
 * Dedupe is per player only: each open player keeps the set of reels it already counted (by page
 * index, or by the visible page view's identity when no index is known), so swiping back within
 * the player never recounts, and returning to the same reel after a background, screen off,
 * sheet, shade, pager dropout or TikTok nested-pager jump does not either. The set starts empty
 * whenever a new player opens: a new node or window, a reopen after the player was closed, a
 * reused node showing a different reel after it was covered, or a pager reset. Nothing is shared
 * between players or persisted.
 */
class ReelSession(private val settleMs: Long = SETTLE_MS) {
  enum class Decision { COUNTED, SETTLING, SEEN, NO_REEL }

  /** How the player left the screen. */
  enum class Exit {
    /** The surface went away inside the app: the next reel shown is a new open. */
    CLOSED,
    /** Covered (sheet, profile, shade) or no active window (screen off). */
    COVERED,
    /** Another app is in front. */
    BACKGROUND,
  }

  data class Result(val decision: Decision, val player: PlayerKey?, val index: Int?, val reason: String)

  private class Player {
    var index: Int? = null
    val seen = HashSet<String>()
    val seenSigs = HashSet<Long>()
    var lastSig: Long? = null
    var evalIndex: Int? = null
    var aliasIndex: Int? = null
    var aliasSig: Long? = null
    /** How this player last left the screen, null while it is (or was never) away. */
    var exit: Exit? = null
  }

  private val players = LinkedHashMap<PlayerKey, Player>()
  private var currentKey: PlayerKey? = null
  private var current: Player? = null
  private var pendingReel: String? = null
  private var pendingSince = 0L
  private var reason = "open"
  private var awayIndex: Int? = null
  private var probationUntil = 0L

  val index: Int? get() = current?.index

  /** The pager reported [newIndex]. */
  fun onIndex(newIndex: Int, nowMs: Long = 0L) {
    val p = current
    if (p == null) {
      // Reported while the player is covered/away; checked when it returns.
      awayIndex = newIndex
      return
    }
    val old = p.index
    if (old == newIndex) return
    if (probationUntil > nowMs) {
      // Just returned from being covered, and the pager names a different reel than the one it
      // left on: the app reused this node for a newly opened player.
      probationUntil = 0L
      val key = currentKey!!
      current = Player().also { it.index = newIndex; players[key] = it }
      reason = "covered then different reel"
      return
    }
    p.index = newIndex
    if (old == null) {
      // The first index of a player may name the reel already counted without one; decided at
      // the next evaluation by comparing the visible page view.
      p.aliasIndex = newIndex
      p.aliasSig = p.lastSig
      return
    }
    reason = "index $old->$newIndex"
  }

  /** A swipe (fallback) or page flip moved by [step] without a pager index. */
  fun onStep(step: Int, why: String) {
    val p = current ?: return
    p.index = (p.index ?: 0) + step
    reason = why
  }

  /** The tracked player left the screen. */
  fun exit(how: Exit) {
    val key = currentKey ?: return
    pendingReel = null
    // Remembered (with its seen set) so a back navigation to it restores instead of recounting.
    current?.exit = how
    currentKey = null
    current = null
    awayIndex = null
    probationUntil = 0L
  }

  /**
   * One evaluation with player [key] on screen, its visible page view identity [pageSig] (null
   * when unknown) and [settling] true mid-swipe.
   */
  fun evaluate(key: PlayerKey, pageSig: Long?, settling: Boolean, nowMs: Long): Result {
    if (key != currentKey) attach(key, pageSig, nowMs)
    val p = current!!
    if (settling) {
      pendingReel = null
      return Result(Decision.SETTLING, key, p.index, "mid-swipe")
    }
    p.aliasIndex?.let { idx ->
      val sig = p.aliasSig
      val sameView = pageSig == null || sig == null || pageSig == sig
      val shownCounted = "start" in p.seen || (sig != null && "s$sig" in p.seen)
      if (sameView && shownCounted) p.seen.add(reelId(idx, null))
      p.aliasIndex = null
    }
    val prev = p.evalIndex
    val now = p.index
    if (prev != null && now != null && now < prev - 1 && pageSig != null && pageSig !in p.seenSigs) {
      // The adapter was replaced under the same node (index jumped back to a reel view this
      // player never showed): a new player opened, so its reels start unseen.
      p.seen.clear()
      p.seenSigs.clear()
      reason = "pager reset"
    }
    p.evalIndex = now
    if (pageSig != null) p.lastSig = pageSig
    val reel = reelId(p.index, pageSig)
    if (reel in p.seen) {
      pendingReel = null
      return Result(Decision.SEEN, key, p.index, "seen in this player")
    }
    if (reel != pendingReel) {
      pendingReel = reel
      pendingSince = nowMs
    }
    if (nowMs - pendingSince < settleMs) return Result(Decision.SETTLING, key, p.index, reason)
    p.seen.add(reel)
    pageSig?.let(p.seenSigs::add)
    pendingReel = null
    return Result(Decision.COUNTED, key, p.index, reason)
  }

  fun hasPending(): Boolean = pendingReel != null

  private fun attach(key: PlayerKey, pageSig: Long?, nowMs: Long) {
    // A remembered player: the same node, or (the app rebuilt the view on back navigation) a
    // player that left in the same window showing the same page view at the same index.
    val byNode = players[key]
    val byWindow = if (byNode != null || pageSig == null) null else players.entries.lastOrNull { (k, p) ->
      p.exit != null && k.windowId == key.windowId && p.lastSig == pageSig &&
        (awayIndex == null || awayIndex == p.index)
    }?.also { players.remove(it.key) }?.value
    val known = byNode ?: byWindow
    val returning = known?.exit != null
    val sigKnown = pageSig != null && known?.lastSig != null
    val reused = returning && sigKnown && pageSig != known!!.lastSig
    val moved = returning && awayIndex != null && awayIndex != known!!.index
    // After a close we need positive proof it is the same reel (FB reopens reuse the node).
    val unproven = known?.exit == Exit.CLOSED && !sigKnown && awayIndex == null
    val p = when {
      known == null -> Player().also { it.index = awayIndex; reason = "open" }
      reused -> Player().also { reason = "reused player" }
      moved -> Player().also { it.index = awayIndex; reason = "covered then different reel" }
      unproven -> Player().also { reason = "reopen" }
      else -> known
    }
    probationUntil = if (p === known && known.exit == Exit.COVERED) nowMs + settleMs else 0L
    if (p === known && returning) reason = "restored"
    p.exit = null
    awayIndex = null
    players.remove(key)
    players[key] = p
    while (players.size > MAX_PLAYERS) players.remove(players.keys.first())
    currentKey = key
    current = p
  }

  private fun reelId(index: Int?, pageSig: Long?): String = when {
    index != null -> "i$index"
    pageSig != null -> "s$pageSig"
    else -> "start"
  }

  companion object {
    /** A reel counts once it has been settled on screen this long. */
    const val SETTLE_MS = 1_000L
    /** Current player plus the last few covered or exited ones. */
    private const val MAX_PLAYERS = 4
  }
}
