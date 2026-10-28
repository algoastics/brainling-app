package com.algoastics.thumbwell.core.detection

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

  /**
   * [reelKey], [startedAtMs] (monotonic, when the reel settled on screen) and [dwellMs] (settle time
   * so far) are set for COUNTED and ad results; [isAd] marks a sponsored reel that was excluded.
   */
  data class Result(
    val decision: Decision,
    val player: PlayerKey?,
    val index: Int?,
    val reason: String,
    val reelKey: String? = null,
    val startedAtMs: Long = 0L,
    val dwellMs: Long = 0L,
    val isAd: Boolean = false,
  )

  private class Player {
    var index: Int? = null
    val seen = HashSet<String>()
    val seenSigs = HashSet<Long>()
    var lastSig: Long? = null
    var evalIndex: Int? = null
    var aliasIndex: Int? = null
    var aliasSig: Long? = null
    var aliasAtMs = 0L
    var attachedAtMs = 0L
    /** How this player last left the screen, null while it is (or was never) away. */
    var exit: Exit? = null
    /** Structural identity (window + class/resource-id path), stable if the node is rebuilt. */
    var path: String? = null
    /** Times it was returned to after leaving; >= 1 marks a long-lived tab player. */
    var restores = 0
    val longLived: Boolean get() = restores > 0 && path != null
    val seenIndexes = ArrayDeque<Int>()
    /** The last page change went toward a lower index (swipe back / up). */
    var backward = false
    /** Indices reached by a forward move and left before they settled: passed through, never watched. */
    val skipped = HashSet<Int>()
    /** Positions came only from swipes/page flips, never from a pager index. */
    var stepOnly = false

    /** An independent copy, so a structural match never shares (or wipes) the original. */
    fun copy(): Player = Player().also {
      it.index = index
      it.seen.addAll(seen)
      it.seenSigs.addAll(seenSigs)
      it.lastSig = lastSig
      it.path = path
      it.restores = restores
      it.exit = exit
      it.seenIndexes.addAll(seenIndexes)
      it.skipped.addAll(skipped)
      it.stepOnly = stepOnly
    }

    fun markSeen(reel: String, index: Int?) {
      seen.add(reel)
      if (index != null && index !in seenIndexes) seenIndexes.addLast(index)
      while (seenIndexes.size > MAX_SEEN) seen.remove("i${seenIndexes.removeFirst()}")
      if (seen.size > MAX_SEEN * 2) seen.clear().also { seenIndexes.forEach { seen.add("i$it") } }
    }

    /** Called before a move away from [old]: a reel arrived at forward and left unsettled was skipped. */
    fun leaving(old: Int?) {
      if (old == null || backward || "i$old" in seen) return
      if (skipped.size >= MAX_SEEN) skipped.clear() // bounded; forgetting only means "not counted"
      skipped.add(old)
    }

    /** True when [i] continues this player's seen range (within one page of it). */
    fun inRange(i: Int): Boolean =
      seenIndexes.isNotEmpty() && i in (seenIndexes.minOrNull()!! - 1)..(seenIndexes.maxOrNull()!! + 1)
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
    p.stepOnly = false
    if (old != null) p.leaving(old)
    if (old == null) {
      // The first index of a player may name the reel already counted without one; decided at
      // the next evaluation by comparing the visible page view.
      p.aliasIndex = newIndex
      p.aliasSig = p.lastSig
      p.aliasAtMs = nowMs
      return
    }
    p.backward = newIndex < old
    reason = "index $old->$newIndex"
  }

  /** A swipe (fallback) or page flip moved by [step] without a pager index. */
  fun onStep(step: Int, why: String) {
    val p = current ?: return
    if (p.index == null) p.stepOnly = true
    p.leaving(p.index)
    p.index = (p.index ?: 0) + step
    p.backward = step < 0
    reason = why
  }

  private var contentClicked = false

  /** A view in the app's content (not its tab bar) was tapped. */
  fun onContentClick() {
    if (current == null) contentClicked = true
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
    contentClicked = false
  }

  /**
   * One evaluation with player [key] on screen, its visible page view identity [pageSig] (null
   * when unknown) and [settling] true mid-swipe.
   */
  fun evaluate(
    key: PlayerKey,
    pageSig: Long?,
    settling: Boolean,
    nowMs: Long,
    path: String? = null,
    isAd: () -> Boolean = { false },
  ): Result {
    if (key != currentKey) attach(key, pageSig, nowMs, path)
    val p = current!!
    if (settling) {
      pendingReel = null
      return Result(Decision.SETTLING, key, p.index, "mid-swipe")
    }
    p.aliasIndex?.let { idx ->
      val sig = p.aliasSig
      // Without page-view identities (Facebook's surface path) only an index reported while the
      // opened reel was still settling names it; a later first index is a swipe to the next one.
      val sameView = if (pageSig != null && sig != null) pageSig == sig
        else p.aliasAtMs - p.attachedAtMs < settleMs
      val shownCounted = "start" in p.seen || (sig != null && "s$sig" in p.seen)
      if (sameView && shownCounted) p.markSeen(reelId(idx, null), idx)
      p.aliasIndex = null
    }
    val prev = p.evalIndex
    val now = p.index
    if (prev != null && now != null && now < prev - 1 && pageSig != null && pageSig !in p.seenSigs) {
      // The adapter was replaced under the same node (index jumped back to a reel view this
      // player never showed): a new player opened, so its reels start unseen. A fresh object, so
      // a remembered tab player's history is never wiped.
      val fresh = Player().also { it.index = now; it.path = p.path }
      players[key] = fresh
      current = fresh
      reason = "pager reset"
      return evaluate(key, pageSig, settling, nowMs, isAd = isAd)
    }
    p.evalIndex = now
    if (pageSig != null) p.lastSig = pageSig
    val reel = reelId(p.index, pageSig)
    if (reel in p.seen) {
      if (pageSig != null) p.seenSigs.add(pageSig)
      pendingReel = null
      return Result(Decision.SEEN, key, p.index, "seen in this player")
    }
    if (p.backward && p.index !in p.skipped) {
      // Primary guard: what is behind you in this player was already shown by it, unless it was
      // only passed through (skipped before it settled): that one is new and settles normally.
      p.markSeen(reel, p.index)
      if (pageSig != null) p.seenSigs.add(pageSig)
      pendingReel = null
      return Result(Decision.SEEN, key, p.index, "backward swipe")
    }
    if (reel != pendingReel) {
      pendingReel = reel
      pendingSince = nowMs
    }
    if (nowMs - pendingSince < settleMs) return Result(Decision.SETTLING, key, p.index, reason)
    val startedAt = pendingSince
    p.markSeen(reel, p.index)
    p.index?.let(p.skipped::remove)
    pageSig?.let(p.seenSigs::add)
    pendingReel = null
    // Checked only once the reel settled: a sponsored reel is marked seen (never recounted).
    if (isAd()) {
      adsSeen++
      return Result(Decision.SEEN, key, p.index, "ad", reel, startedAt, nowMs - startedAt, isAd = true)
    }
    return Result(Decision.COUNTED, key, p.index, reason, reel, startedAt, nowMs - startedAt)
  }

  /** Sponsored reels skipped (in memory only; for a later JS stat). */
  var adsSeen = 0
    private set

  fun hasPending(): Boolean = pendingReel != null

  /**
   * Day start: forgets every player's seen history. The reel on screen right now stays seen so it
   * is not counted a second time at 04:00; nothing else is remembered.
   */
  fun clearHistory() {
    val keep = currentKey?.let { k -> current?.let { p -> k to p } }
    players.clear()
    pendingReel = null
    keep?.let { (k, p) ->
      val shown = reelId(p.index, p.lastSig)
      val fresh = Player().also {
        it.index = p.index
        it.lastSig = p.lastSig
        it.path = p.path
        it.attachedAtMs = p.attachedAtMs
        it.evalIndex = p.evalIndex
        if (shown in p.seen) it.markSeen(shown, p.index)
      }
      players[k] = fresh
      current = fresh
    }
  }

  /**
   * The persistable seen state: per player (that has a structural path) its position and seen
   * positions. Identity hashes of views are process-local and not kept. No text. Null when empty.
   */
  fun snapshot(): String? {
    val list = players.entries.filter { (_, p) -> p.path != null && p.seenIndexes.isNotEmpty() }
      .toList().takeLast(MAX_PERSISTED_PLAYERS)
    if (list.isEmpty()) return null
    val array = org.json.JSONArray()
    for ((_, p) in list) {
      array.put(
        org.json.JSONObject()
          .put("path", p.path)
          .put("index", p.index ?: org.json.JSONObject.NULL)
          .put("seen", org.json.JSONArray(p.seenIndexes.toList()))
          .put("stepOnly", p.stepOnly),
      )
    }
    return org.json.JSONObject().put("v", 1).put("players", array).toString()
  }

  /** Loads a [snapshot] as away players (exit = BACKGROUND), matched later by structural path. */
  fun restore(json: String) {
    val root = try { org.json.JSONObject(json) } catch (e: org.json.JSONException) { return }
    if (root.optInt("v") != 1) return
    val array = root.optJSONArray("players") ?: return
    for (i in 0 until array.length()) {
      val o = array.optJSONObject(i) ?: continue
      val path = o.optString("path", "").ifEmpty { null } ?: continue
      val seen = o.optJSONArray("seen") ?: continue
      val p = Player()
      p.path = path
      p.restores = 1
      p.exit = Exit.BACKGROUND
      p.stepOnly = o.optBoolean("stepOnly")
      if (!o.isNull("index")) p.index = o.optInt("index")
      for (j in 0 until minOf(seen.length(), MAX_SEEN)) p.markSeen("i${seen.getInt(j)}", seen.getInt(j))
      players[PlayerKey(RESTORED_WINDOW, path.hashCode().toLong() * 31 + i)] = p
    }
  }

  private fun attach(key: PlayerKey, pageSig: Long?, nowMs: Long, path: String?) {
    // A remembered player: the same node, or (the app rebuilt the view on back navigation) a
    // player that left in the same window showing the same page view at the same index.
    val byNode = players[key]
    val byWindow = if (byNode != null || pageSig == null) null else players.entries.lastOrNull { (k, p) ->
      p.exit != null && k.windowId == key.windowId && p.lastSig == pageSig &&
        (awayIndex == null || awayIndex == p.index)
    }?.also { players.remove(it.key) }?.value
    // A long-lived tab player (e.g. Instagram's Reels tab) rebuilt under a new node: matched by
    // structure, window and an index continuing its seen range. A pager that never reports an
    // index (YouTube Shorts: page flips only) cannot say where it resumed; it resumes where it left.
    // Only when the path names the selected bottom tab and nothing in the content was tapped while
    // away (back or a tab tap), so a short opened from a thumbnail (Home shelf, a channel's
    // Shorts) with the same structure stays a new player.
    // Copied, never moved: the original node may come back (Instagram profile pagers share the
    // Reels tab's structure), and the copy's resets must not touch the original's history.
    val byPath = if (byNode != null || byWindow != null || path == null) null else players.entries.lastOrNull { (k, p) ->
      p.exit != null && p.longLived && p.path == path && k.windowId == key.windowId &&
        (awayIndex?.let(p::inRange) ?: (p.stepOnly && TAB_MARK in path && !contentClicked))
    }?.value?.copy()
    // After process death the window and node ids are gone: a restored snapshot matches by the
    // structural path alone (and an index that continues its seen range, when one is known).
    val byRestored = if (byNode != null || byWindow != null || byPath != null || path == null) null else
      players.entries.lastOrNull { (k, p) ->
        k.windowId == RESTORED_WINDOW && p.path == path && (awayIndex?.let(p::inRange) ?: true)
      }?.also { players.remove(it.key) }?.value
    val known = byNode ?: byWindow ?: byPath ?: byRestored
    val tab = known?.longLived == true
    val returning = known?.exit != null
    val sigKnown = pageSig != null && known?.lastSig != null
    // Tab players keep their history: recycled page views and a resume one page on are normal.
    val reused = returning && !tab && sigKnown && pageSig != known!!.lastSig
    val moved = returning && awayIndex != null && awayIndex != known!!.index &&
      !(tab && known.inRange(awayIndex!!))
    val p = when {
      known == null -> Player().also { it.index = awayIndex; reason = "open" }
      reused -> Player().also { reason = "reused player" }
      moved -> Player().also { it.index = awayIndex; reason = "covered then different reel" }
      else -> known
    }
    probationUntil = if (p === known && known.exit == Exit.COVERED) nowMs + settleMs else 0L
    if (p === known && returning) {
      reason = "restored"
      p.restores++
      // The pager reported where it resumed while away; that is its position now.
      awayIndex?.let { p.index = it }
    }
    if (p.path == null) p.path = path
    p.attachedAtMs = nowMs
    p.exit = null
    awayIndex = null
    contentClicked = false
    players.remove(key)
    players[key] = p
    evict()
    currentKey = key
    current = p
    attachLog = "attach player=$key from=${known?.let { if (it === byNode) "node" else if (it === byWindow) "window" else "path" } ?: "-"} index=${p.index ?: "-"} seen=${p.seen.size} players=${players.size} tab=${path?.substringAfter(TAB_MARK, "-") ?: "-"} reason=$reason"
  }

  /** Last attach decision, for one diagnostic log line per player switch (no screen text). */
  var attachLog: String? = null

  /** Ephemeral players (profile, feed-opened) are evicted first; tab players are kept. */
  private fun evict() {
    fun drop(longLived: Boolean, cap: Int) {
      val keys = players.filter { (k, p) -> k != currentKey && p.longLived == longLived }.keys
      keys.take(maxOf(0, keys.size - cap)).forEach(players::remove)
    }
    drop(longLived = false, cap = MAX_EPHEMERAL)
    drop(longLived = true, cap = MAX_TABS)
  }

  private fun reelId(index: Int?, pageSig: Long?): String = when {
    index != null -> "i$index"
    pageSig != null -> "s$pageSig"
    else -> "start"
  }

  companion object {
    /**
     * A reel counts once it has been settled on screen this long (D36: 1,000 ms). The default; the
     * signed ruleset `dwellMs`, or an app's own `dwellMs` (TikTok: 750 ms), replaces it.
     */
    const val SETTLE_MS = 1_000L
    /** Remembered ephemeral players besides the current one. */
    private const val MAX_EPHEMERAL = 32
    /** Remembered long-lived tab players (never evicted by ephemeral ones). */
    private const val MAX_TABS = 4
    /** Seen indices kept per player. */
    const val MAX_SEEN = 200
    /** Window id of players restored from a snapshot (real windows have ids >= 0). */
    const val RESTORED_WINDOW = -1
    /** Players kept in a persisted snapshot. */
    private const val MAX_PERSISTED_PLAYERS = 6
    /** Appended to a structural path with the selected bottom-tab position. */
    const val TAB_MARK = "|tab="
  }
}
