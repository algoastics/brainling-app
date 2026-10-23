package com.algoastics.brainling.core.detection

/** Identity of a reel-player pager (or surface) node: its window plus the node's hash. */
data class PlayerKey(val windowId: Int, val nodeId: Long)

/**
 * Detects when a different reel player is attached (pure; unit-tested). Opening a player from a
 * profile grid, a feed video or a horizontal reels row creates a new pager node, often while the
 * app's previous session is still within the session gap. Treating that pager as a continuation
 * kept the old page index, so its first reel produced an already-counted key, and its early swipes
 * replayed indices already in the dedupe ring. A new player instead starts a fresh session so its
 * initial reel counts once it has been on screen for [settleMs].
 *
 * Players seen recently are remembered with their session, so returning to the same node (app
 * background/foreground, a comment sheet or overlay closing, the selector briefly choosing
 * another candidate) restores the old position instead of recounting.
 */
class PlayerTracker(private val settleMs: Long = SETTLE_MS, private val capacity: Int = 8) {
  data class State(val sessionId: Int, val pageIndex: Int?, val pageId: Long? = null)

  enum class Kind { SAME, RESTORED, NEW, ADOPTED }

  data class Attach(val kind: Kind, val state: State? = null)

  private var current: PlayerKey? = null
  private var attachedAtMs = Long.MIN_VALUE / 2
  private var startPageId: Long? = null
  private var aliasOpen = false
  private val saved = LinkedHashMap<PlayerKey, State>()
  private val seenPages = HashSet<Long>()

  val tracked: PlayerKey? get() = current

  /**
   * Feeds the player on screen. [state] is the session's current position, saved for the
   * player being replaced. [continuing] is true when the session gap policy says this is a
   * return to the same browsing (only used for the first player seen since the service started,
   * which has no remembered node to compare against).
   */
  fun attach(key: PlayerKey?, state: State, nowMs: Long, continuing: Boolean, visiblePageId: Long?): Attach {
    if (key == null) return Attach(Kind.SAME)
    val previous = current
    if (previous == key) return Attach(Kind.SAME)
    if (previous != null) remember(previous, state)
    current = key
    attachedAtMs = nowMs
    seenPages.clear()
    saved.remove(key)?.let { restored ->
      // Same node, but showing a different reel than when it left: the app reused the pager
      // for a new player (e.g. Instagram feed player -> profile -> grid reel). Count it as new.
      val reused = restored.pageId != null && visiblePageId != null && restored.pageId != visiblePageId
      if (!reused) {
        aliasOpen = false
        visiblePageId?.let(seenPages::add)
        return Attach(Kind.RESTORED, restored)
      }
    }
    if (previous == null && continuing) {
      aliasOpen = false
      return Attach(Kind.ADOPTED)
    }
    startNew(nowMs, visiblePageId)
    return Attach(Kind.NEW)
  }

  private fun startNew(nowMs: Long, visiblePageId: Long?) {
    attachedAtMs = nowMs
    startPageId = visiblePageId
    aliasOpen = true
    seenPages.clear()
    visiblePageId?.let(seenPages::add)
  }

  /**
   * Called each evaluation of the tracked player. Returns true when its pager was reset under us:
   * the index jumped back by more than one page to a page view never shown in this player, which
   * a swipe cannot do but a new adapter (same pager reused for a new player) does. The caller
   * then starts a new session; the player settles again before counting.
   */
  fun pagerReset(previousIndex: Int?, index: Int?, visiblePageId: Long?, nowMs: Long): Boolean {
    val reset = previousIndex != null && index != null && index < previousIndex - 1 &&
      visiblePageId != null && visiblePageId !in seenPages
    if (reset) startNew(nowMs, null).also { aliasOpen = false }
    visiblePageId?.let(seenPages::add)
    return reset
  }

  /**
   * The player left the screen. When the app went to the background ([closedInApp] false) its
   * position is remembered so the return never recounts. When the user closed the player inside
   * the app, the next player shown is a new one even if the app reuses the same node.
   */
  fun detach(state: State, closedInApp: Boolean) {
    current?.let { if (closedInApp) saved.remove(it) else remember(it, state) }
    current = null
    aliasOpen = false
  }

  /** False until a newly attached player has been on screen for [settleMs]. */
  fun isSettled(nowMs: Long): Boolean = nowMs - attachedAtMs >= settleMs

  /**
   * True when the first page index reported by a new player still describes the reel shown when
   * it attached (same visible page view, or unknown), so the new index's key is the same reel as
   * the "start" key and must not count again. Answers once per attach.
   */
  fun firstIndexIsStartReel(visiblePageId: Long?): Boolean {
    if (!aliasOpen) return false
    aliasOpen = false
    val start = startPageId
    return start == null || visiblePageId == null || start == visiblePageId
  }

  fun reset() {
    current = null
    saved.clear()
    aliasOpen = false
  }

  private fun remember(key: PlayerKey, state: State) {
    saved.remove(key)
    saved[key] = state
    while (saved.size > capacity) saved.remove(saved.keys.first())
  }

  companion object {
    /** A newly opened player counts its initial reel only after it has settled this long. */
    const val SETTLE_MS = 1_000L
  }
}
