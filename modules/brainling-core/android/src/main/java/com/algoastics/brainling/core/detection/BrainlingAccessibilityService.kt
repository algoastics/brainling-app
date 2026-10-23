package com.algoastics.brainling.core.detection

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import com.algoastics.brainling.core.BuildConfig
import com.algoastics.brainling.core.data.CountRepository
import com.algoastics.brainling.core.data.DayCounts
import com.algoastics.brainling.core.health.HealthMonitor
import com.algoastics.brainling.core.rules.AppRule
import com.algoastics.brainling.core.rules.RuleSet
import com.algoastics.brainling.core.rules.RulesManager
import java.security.MessageDigest

/**
 * Counts reels in the apps enabled by the active [RuleSet]. Reads only view ids, class names,
 * bounds, scroll positions and exact component labels; never reads, logs, stores or uploads
 * screen text. Every callback runs on the main thread; Room and prefs writes happen elsewhere.
 */
class BrainlingAccessibilityService : AccessibilityService() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var counts: CountRepository
  private lateinit var stateStore: DetectionStateStore
  private lateinit var health: HealthMonitor
  private var rulesManager: RulesManager? = null
  private var rules: RuleSet? = null
  private val sessions = mutableMapOf<String, Session>()
  private val scheduled = mutableSetOf<String>()
  private val rulesListener: (RuleSet) -> Unit = { updated -> handler.post { applyRules(updated) } }

  // Tester live count badge (BuildConfig.TESTER_MODE). Counts arrive on the repository thread and
  // are cached here on the main thread, so showing the badge never touches the database.
  private var badge: CountBadge? = null
  private var badgePackage: String? = null
  private var badgeAppKey: String? = null
  private var todayCounts: Map<String, Int> = emptyMap()
  private val countsListener: (DayCounts) -> Unit = { day -> handler.post { onCounts(day.apps) } }
  private val badgeWatch = object : Runnable {
    override fun run() {
      val pkg = badgePackage ?: return
      // Events only arrive from target apps, so leaving to another app is noticed here.
      if (rootInActiveWindow?.packageName?.toString() != pkg) hideBadge()
      else handler.postDelayed(this, BADGE_WATCH_MS)
    }
  }

  /** Browsing state for one package; the persisted part lives in [DetectionStateStore]. */
  private class Session(val counter: ReelCounter, snapshot: SessionSnapshot) {
    var id = snapshot.sessionId
    /** Highest session id issued, so a new player never reuses a restored player's id. */
    var maxId = snapshot.sessionId
    var pageIndex: Int? = snapshot.pageIndex
    var lastSeenAtMs = snapshot.lastSeenAtMs
    var onSurface = false
    var awaitingFirstIndex = false
    var surfaceHeight = 0
    var retryStep = Int.MAX_VALUE
    var pager = PagerTracker()
    val flips = PageFlipDetector()
    /** True when a pager index arrived since the last evaluation (see [PageFlipDetector]). */
    var indexMoved = false
    /** Bounds of the feed pager at the last evaluation; scroll events from elsewhere are not it. */
    var pagerBounds: Rect? = null
    /** Which reel player (pager node + window) this session is on; see [PlayerTracker]. */
    val players = PlayerTracker()
    /** True after entering the surface, until the first player is attached. */
    var continuing = false
    var hadPager = false
    /** Last pager index reported since the tracked player left (see [PlayerTracker.restoreRefuted]). */
    var indexSinceExit: Int? = null

    /** Page index and visible page view at the last evaluation on the tracked player. */
    var lastIndex: Int? = null
    var lastPageId: Long? = null

    fun position() = PlayerTracker.State(id, pageIndex, lastPageId)

    fun snapshot() = SessionSnapshot(id, pageIndex, lastSeenAtMs, counter.recentKeys())
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    connected = true
    counts = CountRepository.get(this)
    stateStore = DetectionStateStore(this)
    health = HealthMonitor.get(this)
    health.onServiceConnected()
    if (BuildConfig.TESTER_MODE) {
      badge = CountBadge(this)
      counts.addListener(countsListener)
      Thread({ countsListener(counts.today()) }, "brainling-badge-init").start()
    }
    val manager = try {
      RulesManager.get(this)
    } catch (e: Exception) {
      // The bundled ruleset failed verification: count nothing rather than trust it.
      Log.w(TAG, "no valid ruleset: ${e.javaClass.simpleName}")
      null
    }
    rulesManager = manager
    manager?.addListener(rulesListener)
    manager?.active?.let(::applyRules)
  }

  /** Activates [updated]: narrows the observed packages and resets counters if timing changed. */
  private fun applyRules(updated: RuleSet) {
    val previous = rules
    rules = updated
    if (previous == null || previous.countingDiffers(updated)) {
      persistAll()
      sessions.clear()
    }
    sessions.keys.retainAll(updated.enabledPackages)
    serviceInfo?.let { info ->
      info.packageNames = updated.enabledPackages.toTypedArray()
      serviceInfo = info
    }
    debugLog("rules v${updated.version} packages=${updated.enabledPackages.size}")
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent) {
    val active = rules ?: return
    val packageName = event.packageName?.toString() ?: return
    val rule = active.ruleFor(packageName) ?: return
    health.heartbeat()
    val session = session(packageName, active)
    when (event.eventType) {
      AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
        val verdict = if (session.onSurface) onScrolled(session, rule, event) else "off-surface"
        DetectionDebug.logEvent(this, packageName, event, verdict)
      }
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
        session.retryStep = 0
        // The screen changed: re-select the pager, never filter scrolls by the old one's bounds.
        session.pagerBounds = null
        DetectionDebug.logEvent(this, packageName, event, "window")
      }
      else -> DetectionDebug.logEvent(this, packageName, event, "content")
    }
    schedule(packageName, THROTTLE_MS)
  }

  /**
   * Routes one scroll event: the feed pager's events carry the index; same-id outer pagers are
   * dropped; other vertical scrolls covering most of the surface (a pager we could not match,
   * e.g. YouTube's recycler sending events from a wrapper) only count as swipe movement.
   */
  private fun onScrolled(session: Session, rule: AppRule, event: AccessibilityEvent): String {
    val now = SystemClock.elapsedRealtime()
    val scroll = NodeInspector.scrollOf(event)
    val sourceBounds = NodeInspector.sourceBounds(event)
    val known = session.pagerBounds
    if (NodeInspector.isPagerEvent(event, rule) && (known == null || sourceBounds == null || sourceBounds == known)) {
      session.pager.onScroll(scroll, session.surfaceHeight, now)?.let { onPageIndex(session, it) }
      return "pager"
    }
    if (NodeInspector.isOtherPagerEvent(event, rule)) return "other-pager"
    val height = sourceBounds?.height() ?: 0
    if (scroll.scrollDeltaY != 0 && session.surfaceHeight > 0 && height * 2 >= session.surfaceHeight) {
      session.pager.onScroll(scroll.copy(fromIndex = -1, toIndex = -1, scrollY = -1, maxScrollY = 0), session.surfaceHeight, now)
      return "movement"
    }
    return "ignored"
  }

  private fun onCounts(apps: Map<String, Int>) {
    todayCounts = apps
    val key = badgeAppKey ?: return
    badge?.show(key, apps[key] ?: 0)
  }

  /** Shows the badge for [packageName]'s app; a no-op when it already shows the same text. */
  private fun showBadge(packageName: String, appKey: String) {
    val pill = badge ?: return
    val wasShown = pill.isShown && badgePackage == packageName
    badgePackage = packageName
    badgeAppKey = appKey
    pill.show(appKey, todayCounts[appKey] ?: 0)
    if (!wasShown) {
      handler.removeCallbacks(badgeWatch)
      handler.postDelayed(badgeWatch, BADGE_WATCH_MS)
    }
  }

  private fun hideBadge() {
    handler.removeCallbacks(badgeWatch)
    badgePackage = null
    badgeAppKey = null
    badge?.hide()
  }

  private fun onPageIndex(session: Session, index: Int) {
    session.indexSinceExit = index
    if (index != session.pageIndex) session.indexMoved = true
    if (session.awaitingFirstIndex) {
      session.awaitingFirstIndex = false
      if (SessionPolicy.feedRestarted(session.pageIndex, index)) session.id++
    }
    session.pageIndex = index
  }

  private fun session(packageName: String, active: RuleSet): Session =
    sessions.getOrPut(packageName) {
      val snapshot = stateStore.load(packageName)
      Session(ReelCounter(active.dwellMs, active.dedupeSize, snapshot.recentKeys), snapshot)
    }

  private fun schedule(packageName: String, delayMs: Long) {
    if (!scheduled.add(packageName)) return
    handler.postDelayed({
      scheduled.remove(packageName)
      evaluate(packageName)
    }, delayMs)
  }

  private fun evaluate(packageName: String) {
    val active = rules ?: return
    val rule = active.ruleFor(packageName) ?: return
    val session = sessions[packageName] ?: return
    val activeRoot = rootInActiveWindow
    val root = activeRoot?.takeIf { it.packageName?.toString() == packageName }
    val now = SystemClock.elapsedRealtime()
    val wallNow = System.currentTimeMillis()
    if (root != null) DetectionDebug.maybeCapture(this, packageName, root)
    val surface = root?.let { NodeInspector.findSurface(it, rule, packageName) }

    if (surface == null) {
      if (badgePackage == packageName) hideBadge()
      session.flips.reset()
      session.pagerBounds = null
      if (session.players.tracked != null) {
        session.players.detach(
          session.position(),
          when {
            root != null -> PlayerTracker.Exit.CLOSED
            activeRoot == null -> PlayerTracker.Exit.COVERED
            else -> PlayerTracker.Exit.BACKGROUND
          },
        )
        session.indexSinceExit = null
      }
      if (session.onSurface) {
        session.onSurface = false
        stateStore.save(packageName, session.snapshot())
      }
      session.counter.observe(null, now)
      val delays = active.surfaceRetryDelaysMs
      if (session.retryStep < delays.size) {
        val delay = delays[session.retryStep]
        session.retryStep++
        schedule(packageName, delay)
      }
      return
    }

    session.retryStep = Int.MAX_VALUE
    showBadge(packageName, rule.key)
    if (!session.onSurface) enterSurface(session, active.sessionGapMs, wallNow)
    session.onSurface = true
    session.lastSeenAtMs = wallNow
    // Re-selected on every evaluation; a stale or invisible node is never kept.
    val pager = root?.let { NodeInspector.findPager(it, rule, packageName, surface) }
      ?.takeIf { it.node.refresh() && it.node.isVisibleToUser }
    session.pagerBounds = pager?.bounds
    val visiblePage = pager?.let(NodeInspector::visiblePageId)
    if (pager == null && session.players.tracked != null && session.hadPager) {
      // The tracked pager is covered or gone while the surface lingers (e.g. a profile pushed
      // over the player). Leave it; re-attaching checks whether it still shows the same reel.
      session.players.detach(session.position(), PlayerTracker.Exit.COVERED)
      session.indexSinceExit = null
      session.hadPager = false
      session.counter.observe(null, now)
      return
    }
    val playerNode = pager?.node ?: surface.node
    val playerKey = playerNode?.let { PlayerKey(it.windowId, it.hashCode().toLong()) }
    val attach = session.players.attach(playerKey, session.position(), now, session.continuing, visiblePage)
    if (playerKey != null) session.continuing = false
    if (playerKey != null) session.hadPager = pager != null
    if (attach.kind != PlayerTracker.Kind.SAME) {
      session.lastIndex = session.pageIndex
      session.lastPageId = visiblePage
    }
    when (attach.kind) {
      PlayerTracker.Kind.NEW -> startPlayerSession(session)
      PlayerTracker.Kind.RESTORED -> attach.state?.let { restorePlayerSession(session, it) }
      else -> Unit
    }
    if (!session.players.isSettled(now)) {
      // A newly opened player: let it settle before its initial reel starts a dwell.
      session.counter.observe(null, now)
      schedule(packageName, PlayerTracker.SETTLE_MS)
      return
    }
    session.surfaceHeight = (pager?.bounds ?: surface.bounds).height()

    // Mid-swipe the surface on screen is neither reel; wait for the pager to settle so a
    // half-visible page never starts a dwell (and the old reel's dwell cannot complete).
    if (session.pager.isSettling(now)) {
      schedule(packageName, PagerTracker.SETTLE_MS)
      return
    }
    session.pager.settle(session.pageIndex, session.surfaceHeight, now)?.let { onPageIndex(session, it) }
    val wasUnindexed = session.pageIndex == null
    val step = session.flips.observe(visiblePage, session.indexMoved)
    val moved = session.indexMoved || step != 0
    session.indexMoved = false
    if (step != 0) {
      session.pager.markFlip()
      onPageIndex(session, (session.pageIndex ?: 0) + step)
      session.indexMoved = false
    }

    if (session.players.restoreRefuted(session.indexSinceExit, now)) {
      val index = session.indexSinceExit
      startPlayerSession(session)
      session.pageIndex = index
      session.lastIndex = index
      session.lastPageId = visiblePage
    }
    if (session.players.pagerReset(session.lastIndex, session.pageIndex, visiblePage, now)) {
      val index = session.pageIndex
      startPlayerSession(session)
      session.pageIndex = index
      session.lastIndex = index
      session.lastPageId = visiblePage
      session.counter.observe(null, now)
      schedule(packageName, PlayerTracker.SETTLE_MS)
      return
    }
    session.lastIndex = session.pageIndex
    session.lastPageId = visiblePage ?: session.lastPageId
    val key = itemKey(packageName, session.id, session.pageIndex)
    // A new player's first reported index names the reel already counted as its "start" reel.
    if (wasUnindexed && session.pageIndex != null && step == 0 &&
      session.players.firstIndexIsStartReel(visiblePage) &&
      itemKey(packageName, session.id, null) in session.counter.recentKeys()
    ) {
      session.counter.suppress(key)
    }
    val fromDm = root != null && NodeInspector.hasDmSignature(root, rule, packageName)
    val counted = if (fromDm) {
      session.counter.suppress(key)
      session.counter.observe(null, now)
      false
    } else {
      session.counter.observe(key, now) != null
    }
    if (root != null && (counted || moved)) {
      DetectionDebug.treeSnapshot(this, packageName, root, if (counted) "count" else "page ${session.pageIndex}")
    }
    if (counted) {
      counts.record(rule.key)
      stateStore.save(packageName, session.snapshot())
    }

    DetectionDebug.record(
      DetectionInfo(
        packageName = packageName,
        surfaceId = surface.signal,
        className = surface.className,
        bounds = surface.bounds.toShortString(),
        sessionId = session.id,
        itemIndex = session.pageIndex,
        indexSource = session.pager.source?.name?.lowercase(),
        keyPrefix = key.take(8),
        counted = counted,
        dmExcluded = fromDm,
        atMs = wallNow,
      ),
    )
    if (session.counter.hasPending()) schedule(packageName, active.dwellMs + DWELL_SLACK_MS)
  }

  /** Continues the previous browsing session after a short absence, else starts a new one. */
  private fun enterSurface(session: Session, sessionGapMs: Long, wallNow: Long) {
    if (SessionPolicy.continues(session.lastSeenAtMs, wallNow, sessionGapMs)) {
      session.awaitingFirstIndex = true
    } else {
      session.id++
      session.pageIndex = null
      session.awaitingFirstIndex = false
    }
    session.continuing = session.awaitingFirstIndex
  }

  /** A different reel player appeared: its reels are new, starting with the one on screen. */
  private fun startPlayerSession(session: Session) {
    session.maxId = maxOf(session.maxId, session.id) + 1
    session.id = session.maxId
    session.pageIndex = null
    session.awaitingFirstIndex = false
    session.flips.reset()
    session.indexMoved = false
    session.pager = PagerTracker()
  }

  private fun restorePlayerSession(session: Session, state: PlayerTracker.State) {
    session.maxId = maxOf(session.maxId, session.id)
    session.id = state.sessionId
    session.pageIndex = state.pageIndex
    session.awaitingFirstIndex = false
    session.flips.reset()
    session.indexMoved = false
  }

  /** Salted hash of a structural position (package, browsing session, page index). */
  private fun itemKey(packageName: String, sessionId: Int, pageIndex: Int?): String {
    val digest = MessageDigest.getInstance("SHA-256")
    digest.update(stateStore.salt)
    digest.update("$packageName|$sessionId|${pageIndex ?: "start"}".toByteArray())
    return digest.digest().joinToString("") { "%02x".format(it) }.take(KEY_HEX_CHARS)
  }

  private fun persistAll() {
    if (!::stateStore.isInitialized) return
    sessions.forEach { (packageName, session) -> stateStore.save(packageName, session.snapshot()) }
  }

  override fun onInterrupt() {
    hideBadge()
  }

  override fun onUnbind(intent: Intent?): Boolean {
    shutdown()
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    shutdown()
    super.onDestroy()
  }

  private fun shutdown() {
    if (!connected) return
    connected = false
    hideBadge()
    if (::counts.isInitialized) counts.removeListener(countsListener)
    handler.removeCallbacksAndMessages(null)
    scheduled.clear()
    rulesManager?.removeListener(rulesListener)
    persistAll()
    if (::health.isInitialized) health.onServiceStopped()
  }

  private fun debugLog(message: String) {
    if (BuildConfig.DEBUG) Log.d(TAG, message)
  }

  companion object {
    private const val TAG = "BrainlingDetect"
    private const val THROTTLE_MS = 250L
    private const val DWELL_SLACK_MS = 50L
    private const val KEY_HEX_CHARS = 16
    private const val BADGE_WATCH_MS = 1_000L

    /** True while the service is bound in this process (read by the watchdog and debug tools). */
    @Volatile var connected = false
      private set
  }
}
