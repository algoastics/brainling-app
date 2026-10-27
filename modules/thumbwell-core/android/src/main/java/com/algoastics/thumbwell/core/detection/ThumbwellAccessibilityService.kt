package com.algoastics.thumbwell.core.detection

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.algoastics.thumbwell.core.BuildConfig
import com.algoastics.thumbwell.core.FeatureFlags
import com.algoastics.thumbwell.core.data.CorePrefs
import com.algoastics.thumbwell.core.data.CountRepository
import com.algoastics.thumbwell.core.data.CountedReel
import com.algoastics.thumbwell.core.data.DayCounts
import com.algoastics.thumbwell.core.health.HealthMonitor
import com.algoastics.thumbwell.core.lock.LimitEngine
import com.algoastics.thumbwell.core.lock.LockController
import com.algoastics.thumbwell.core.lock.OverlayGuard
import com.algoastics.thumbwell.core.rules.AppRule
import com.algoastics.thumbwell.core.rules.RuleSet
import com.algoastics.thumbwell.core.rules.RulesManager

/**
 * Counts reels in the apps enabled by the active [RuleSet]. Reads only view ids, class names,
 * bounds, scroll positions and exact component labels; never reads, logs, stores or uploads
 * screen text. Every callback runs on the main thread; Room and prefs writes happen elsewhere.
 */
class ThumbwellAccessibilityService : AccessibilityService() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var counts: CountRepository
  private lateinit var prefs: CorePrefs
  private lateinit var health: HealthMonitor
  private lateinit var limitEngine: LimitEngine
  private lateinit var lock: LockController
  private var rulesManager: RulesManager? = null
  private var rules: RuleSet? = null
  // Process-wide: Android rebinds the service (another accessibility client or UiAutomation
  // connecting, a settings toggle) without killing the process; per-player seen sets survive.
  private val sessions get() = SESSIONS
  private val scheduled = mutableSetOf<String>()
  private val rulesListener: (RuleSet) -> Unit = { updated -> handler.post { applyRules(updated) } }

  // Floating Thumb badge (FeatureFlags.countBadgeEnabled + the user's switch). Counts arrive on the repository thread and
  // are cached here on the main thread, so showing the badge never touches the database.
  private var badge: CountBadge? = null
  private var badgePackage: String? = null
  private var badgeAppKey: String? = null
  private var todayCounts: Map<String, Int> = emptyMap()
  private val countsListener: (DayCounts) -> Unit = { day -> handler.post { onCounts(day.apps) } }
  private val badgeSettingsListener: () -> Unit = {
    handler.post {
      if (!prefs.badgeSettings().enabled) hideBadge() else badge?.settingsChanged()
    }
  }
  private val badgeWatch = object : Runnable {
    override fun run() {
      val pkg = badgePackage ?: return
      // Events only arrive from target apps, so leaving to another app is noticed here.
      val activePkg = rootInActiveWindow?.packageName?.toString()
      if (guardSafetyWindow(activePkg)) return
      if (activePkg != pkg) hideBadge()
      else handler.postDelayed(this, BADGE_WATCH_MS)
    }
  }

  /** The counted reel whose final dwell is still running (monotonic start, wall time as row key). */
  private class OpenCount(val appKey: String, val countedAtMs: Long, val startedAtMs: Long, val index: Int?)

  /**
   * Browsing state for one package. Held in memory; the per-player seen set is also snapshotted to
   * Room ([persist]) so it survives process death, and cleared at day start.
   */
  private class Session(settleMs: Long) {
    var open: OpenCount? = null
    val reels = ReelSession(settleMs)
    var onSurface = false
    var surfaceHeight = 0
    var retryStep = Int.MAX_VALUE
    val pager = PagerTracker()
    val flips = PageFlipDetector()
    /** True when a pager index arrived since the last evaluation (see [PageFlipDetector]). */
    var indexMoved = false
    /** Bounds of the feed pager at the last evaluation; scroll events from elsewhere are not it. */
    var pagerBounds: Rect? = null
    /** True while a player is attached, and whether it was a pager (vs the surface node). */
    var attached = false
    var hadPager = false
    /** Last logged decision, so logcat gets one line per decision change. */
    var lastLog: String? = null
    /** Structural path per player node, computed once (walking ancestors is not free). */
    val paths = LinkedHashMap<PlayerKey, String>()
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    connected = true
    Log.i(TAG, "service connected sessions=${sessions.size}")
    counts = CountRepository.get(this)
    prefs = CorePrefs.get(this)
    loadSeenStates()
    health = HealthMonitor.get(this)
    health.onServiceConnected()
    limitEngine = LimitEngine.get(this)
    lock = LockController(this, limitEngine, prefs, ::isOnReels)
    lock.start()
    if (FeatureFlags.countBadgeEnabled) {
      badge = CountBadge(this, prefs, ::openThumbwell)
      prefs.addBadgeListener(badgeSettingsListener)
      counts.addListener(countsListener)
      Thread({ countsListener(counts.today()) }, "thumbwell-badge-init").start()
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

  /**
   * Loads the saved seen state once per process, off the main thread. Nothing is counted until it
   * is loaded, so a restart never recounts what the player already showed.
   */
  private fun loadSeenStates() {
    if (seenLoaded) return
    Thread({
      val states = try { counts.loadSeenStates() } catch (e: Exception) { emptyMap() }
      handler.post {
        PENDING_STATES.putAll(states)
        seenLoaded = true
      }
    }, "thumbwell-seen-load").start()
  }

  /** Counting runs only with consent logged for the current disclosure and the seen state loaded. */
  private fun countingAllowed(): Boolean = seenLoaded && prefs.consentValid()

  /** At most every 15 s: when the logical day changed, clears the seen state once. */
  private fun checkDayRollover() {
    val nowElapsed = SystemClock.elapsedRealtime()
    if (nowElapsed - lastDayCheckAt < DAY_CHECK_MS && sessionDay != null) return
    lastDayCheckAt = nowElapsed
    val day = prefs.currentDayKey(System.currentTimeMillis())
    val previous = sessionDay
    sessionDay = day
    if (previous != null && previous != day) {
      Log.i(TAG, "day rollover: seen state cleared")
      limitEngine.refresh()
      sessions.values.forEach { it.reels.clearHistory() }
      PENDING_STATES.clear()
      counts.clearSeenStates()
    }
  }

  private fun persist(packageName: String, session: Session) {
    session.reels.snapshot()?.let { counts.saveSeenState(packageName, it) }
  }

  /** Writes the final dwell of the reel still running in [session] (monotonic clock). */
  private fun closeDwell(session: Session, nowElapsed: Long) {
    val open = session.open ?: return
    session.open = null
    counts.finishDwell(open.appKey, open.countedAtMs, nowElapsed - open.startedAtMs)
  }

  /** Activates [updated]: narrows the observed packages and resets counters if timing changed. */
  private fun applyRules(updated: RuleSet) {
    val previous = rules ?: lastRules
    rules = updated
    lastRules = updated
    if (previous == null || previous.countingDiffers(updated)) {
      if (sessions.isNotEmpty()) Log.i(TAG, "sessions reset: rules v${updated.version}")
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
    if (clearRequested) {
      clearRequested = false
      sessions.clear()
      PENDING_STATES.clear()
      if (::limitEngine.isInitialized) limitEngine.refresh()
    }
    guardSafetyWindowOnEvent(event)
    val active = rules ?: return
    val packageName = event.packageName?.toString() ?: return
    val rule = active.ruleFor(packageName) ?: return
    health.heartbeat()
    if (!countingAllowed()) return
    checkDayRollover()
    val session = session(packageName, active)
    when (event.eventType) {
      AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
        val verdict = if (session.onSurface) onScrolled(session, rule, event) else "off-surface"
        // Swiping to the next item releases a lock that waits for it (see LockController).
        if (verdict == "pager" || verdict == "movement") lock.onSwipe(packageName)
        DetectionDebug.logEvent(this, packageName, event, verdict)
      }
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
        session.retryStep = 0
        // The screen changed: re-select the pager, never filter scrolls by the old one's bounds.
        session.pagerBounds = null
        DetectionDebug.logEvent(this, packageName, event, "window")
      }
      AccessibilityEvent.TYPE_VIEW_CLICKED -> {
        // A tap in the content (a thumbnail), not the tab bar: whatever player opens next is new.
        val inTabBar = event.source?.let { NodeInspector.inTabBar(it, rule, packageName) } == true
        if (!inTabBar) session.reels.onContentClick()
        DetectionDebug.logEvent(this, packageName, event, if (inTabBar) "tab-click" else "click")
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
    if (badgePackage != null) badge?.show(apps[key] ?: 0)
  }

  /**
   * Shows or hides the badge from the gate: switch on, counting allowed, on this app's reels
   * surface, no lock overlay, no focused text input. Shows THAT app's count.
   */
  private fun updateBadge(packageName: String, appKey: String, root: AccessibilityNodeInfo, locked: Boolean) {
    val pill = badge ?: return
    val open = BadgeGate.visible(
      enabled = prefs.badgeSettings().enabled,
      countingAllowed = countingAllowed(),
      onReelsSurface = true,
      lockShowing = locked || lock.isShowing,
      textInputOrKeyboard = focusedTextInput(root),
    )
    if (!open) {
      hideBadge()
      return
    }
    val wasShown = pill.isShown && badgePackage == packageName
    badgePackage = packageName
    badgeAppKey = appKey
    pill.show(todayCounts[appKey] ?: 0)
    if (!wasShown) {
      handler.removeCallbacks(badgeWatch)
      handler.postDelayed(badgeWatch, BADGE_WATCH_MS)
    }
  }

  /** Focus and flags only; the text of a field is never read. */
  private fun focusedTextInput(root: AccessibilityNodeInfo): Boolean {
    val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false
    return OverlayGuard.isTextInput(focused.isEditable, focused.className?.toString())
  }

  /**
   * F07 item 10: the badge and the lock never show over Settings, Accessibility settings or the
   * package installer (including OEM variants, see [OverlaySafetyPackages]). Returns true when
   * [packageName] is such a window and both overlays were hidden. Hide only, nothing is pressed.
   */
  private fun guardSafetyWindow(packageName: String?): Boolean {
    if (!OverlaySafetyPackages.matches(packageName)) return false
    hideBadge()
    if (::lock.isInitialized) lock.onSafetyWindow()
    return true
  }

  /** Every event, before any other work: its package, and for window changes the active window. */
  private fun guardSafetyWindowOnEvent(event: AccessibilityEvent) {
    if (guardSafetyWindow(event.packageName?.toString())) return
    val windowChange = event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
      event.eventType == AccessibilityEvent.TYPE_WINDOWS_CHANGED
    val overlaysUp = badgePackage != null || (::lock.isInitialized && lock.isShowing)
    if (windowChange && overlaysUp) guardSafetyWindow(rootInActiveWindow?.packageName?.toString())
  }

  private fun hideBadge() {
    handler.removeCallbacks(badgeWatch)
    badgePackage = null
    badgeAppKey = null
    badge?.hideNow()
  }

  /** The reels surface is gone: the badge fades out after 600 ms unless the surface returns. */
  private fun leaveBadge() {
    handler.removeCallbacks(badgeWatch)
    badgePackage = null
    badgeAppKey = null
    badge?.leave()
  }

  private fun openThumbwell() {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      startActivity(launch)
    } catch (e: RuntimeException) {
      Log.w(TAG, "open failed: ${e.javaClass.simpleName}")
    }
  }

  private fun onPageIndex(session: Session, index: Int) {
    if (index != session.reels.index) session.indexMoved = true
    session.reels.onIndex(index, SystemClock.elapsedRealtime())
  }

  private fun session(packageName: String, active: RuleSet): Session =
    sessions.getOrPut(packageName) {
      Session(maxOf(ReelSession.SETTLE_MS, active.dwellMs)).also { s ->
        PENDING_STATES.remove(packageName)?.let(s.reels::restore)
      }
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
    if (!countingAllowed()) return
    val session = sessions[packageName] ?: return
    val activeRoot = rootInActiveWindow
    val root = activeRoot?.takeIf { it.packageName?.toString() == packageName }
    val now = SystemClock.elapsedRealtime()
    if (root != null) DetectionDebug.maybeCapture(this, packageName, root)
    val surface = root?.let { NodeInspector.findSurface(it, rule, packageName) }

    if (root == null || surface == null) {
      lock.onSurfaceGone(packageName)
      if (guardSafetyWindow(activeRoot?.packageName?.toString())) {
        // Settings, Accessibility settings or an installer dialog is on top: hidden at once.
      } else if (badgePackage == packageName) leaveBadge()
      val exit = when {
        root != null -> ReelSession.Exit.CLOSED
        activeRoot == null -> ReelSession.Exit.COVERED
        else -> ReelSession.Exit.BACKGROUND
      }
      leavePlayer(session, packageName, exit)
      session.onSurface = false
      val delays = active.surfaceRetryDelaysMs
      if (session.retryStep < delays.size) {
        val delay = delays[session.retryStep]
        session.retryStep++
        schedule(packageName, delay)
      }
      return
    }

    session.retryStep = Int.MAX_VALUE
    session.onSurface = true
    // The limit lock covers the surface: reels seen under it are not counted (Room is untouched).
    // The lock has priority over the badge, so the badge is decided after the lock.
    val locked = lock.onSurface(packageName, surface.bounds, root)
    updateBadge(packageName, rule.key, root, locked)
    if (locked) return
    // Re-selected on every evaluation; a stale or invisible node is never kept.
    val pager = NodeInspector.findPager(root, rule, packageName, surface)
      ?.takeIf { it.node.refresh() && it.node.isVisibleToUser }
    session.pagerBounds = pager?.bounds
    if (pager == null && session.attached && session.hadPager) {
      // The tracked pager is covered or gone while the surface lingers (e.g. a profile pushed
      // over the player). Re-attaching decides whether it still shows the same reel.
      leavePlayer(session, packageName, ReelSession.Exit.COVERED)
      return
    }
    val playerNode = pager?.node ?: surface.node ?: return
    val playerKey = PlayerKey(playerNode.windowId, playerNode.hashCode().toLong())
    session.attached = true
    session.hadPager = pager != null
    session.surfaceHeight = (pager?.bounds ?: surface.bounds).height()
    val visiblePage = pager?.let(NodeInspector::visiblePageId)

    // Mid-swipe the surface on screen is neither reel; wait for the pager to settle so a
    // half-visible page never starts a settle timer.
    val settling = session.pager.isSettling(now)
    if (!settling) {
      session.pager.settle(session.reels.index, session.surfaceHeight, now)?.let {
        // TikTok reports one swipe as both a settled scroll and a page view flip (either
        // order); the flip tracker reconciles the pair so it moves one position.
        val swipe = session.flips.stepped(now, it - (session.reels.index ?: 0))
        if (swipe != 0) session.reels.onStep(swipe, "swipe")
      }
      val step = session.flips.observe(visiblePage, session.indexMoved, now)
      session.indexMoved = false
      if (step != 0) {
        session.pager.markFlip()
        session.reels.onStep(step, "flip")
      }
    }

    val path = session.paths.getOrPut(playerKey) {
      NodeInspector.structuralPath(playerNode) +
        (NodeInspector.selectedTab(root, rule, packageName)?.let { "${ReelSession.TAB_MARK}$it" } ?: "")
    }
    if (session.paths.size > 16) session.paths.keys.first().let(session.paths::remove)
    val adLabels = AdMarker.labelsFor(rule.key, rule.adLabels)
    val result = session.reels.evaluate(playerKey, visiblePage, settling, now, path) {
      NodeInspector.hasAdLabel(pager, surface.node ?: root, adLabels)
    }
    val counted = result.decision == ReelSession.Decision.COUNTED
    // The previous reel is over once the player points at another position.
    session.open?.let { if (session.reels.index != it.index) closeDwell(session, now) }
    session.reels.attachLog?.let { logLine(session, packageName, it); session.reels.attachLog = null }
    logDecision(session, packageName, result)
    if (counted) {
      val reel = CountedReel(
        appKey = rule.key,
        packageName = packageName,
        surface = surface.signal,
        identity = "${result.reelKey}|$path",
        dwellMs = result.dwellMs,
      )
      closeDwell(session, now)
      val at = counts.record(reel)
      session.open = OpenCount(rule.key, at, result.startedAtMs, result.index)
      persist(packageName, session)
      DetectionDebug.treeSnapshot(this, packageName, root, "count")
    } else if (result.isAd) {
      counts.recordAd(rule.key)
      persist(packageName, session)
    }
    DetectionDebug.record(
      DetectionInfo(
        packageName = packageName,
        surfaceId = surface.signal,
        className = surface.className,
        bounds = surface.bounds.toShortString(),
        sessionId = 0,
        itemIndex = result.index,
        indexSource = session.pager.source?.name?.lowercase(),
        keyPrefix = playerKey.toString(),
        counted = counted,
        dmExcluded = false,
        atMs = System.currentTimeMillis(),
      ),
    )
    when {
      settling -> schedule(packageName, PagerTracker.SETTLE_MS)
      session.reels.hasPending() -> schedule(packageName, ReelSession.SETTLE_MS / 4)
    }
  }

  private fun leavePlayer(session: Session, packageName: String, exit: ReelSession.Exit) {
    session.flips.reset()
    session.pagerBounds = null
    closeDwell(session, SystemClock.elapsedRealtime())
    if (!session.attached) return
    persist(packageName, session)
    session.attached = false
    session.hadPager = false
    session.reels.exit(exit)
    logLine(session, packageName, "exit=${exit.name.lowercase()}")
  }

  /** One concise logcat line per count decision (no screen text; player is a node hash). */
  private fun logDecision(session: Session, packageName: String, r: ReelSession.Result) {
    if (r.decision == ReelSession.Decision.SETTLING) return
    val verdict = if (r.decision == ReelSession.Decision.COUNTED) "counted" else "skipped"
    logLine(session, packageName, "player=${r.player} index=${r.index ?: "-"} $verdict reason=${r.reason}")
  }

  private fun logLine(session: Session, packageName: String, line: String) {
    if (line == session.lastLog && !line.contains(" counted ")) return
    session.lastLog = line
    Log.i(TAG, "app=$packageName $line")
  }

  override fun onInterrupt() {
    hideBadge()
    if (::lock.isInitialized) lock.hide()
  }

  /** True while [packageName] is the foreground app with a reels surface on screen. */
  private fun isOnReels(packageName: String): Boolean {
    val rule = rules?.ruleFor(packageName) ?: return false
    val root = rootInActiveWindow?.takeIf { it.packageName?.toString() == packageName } ?: return false
    return NodeInspector.findSurface(root, rule, packageName) != null
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
    if (::lock.isInitialized) lock.stop()
    if (::counts.isInitialized) {
      val now = SystemClock.elapsedRealtime()
      sessions.forEach { (pkg, s) -> closeDwell(s, now); persist(pkg, s) }
      counts.removeListener(countsListener)
    }
    if (::prefs.isInitialized) prefs.removeBadgeListener(badgeSettingsListener)
    badge?.release()
    badge = null
    handler.removeCallbacksAndMessages(null)
    scheduled.clear()
    rulesManager?.removeListener(rulesListener)
    if (::health.isInitialized) health.onServiceStopped()
  }

  private fun debugLog(message: String) {
    if (BuildConfig.DEBUG) Log.d(TAG, message)
  }

  companion object {
    private val SESSIONS = mutableMapOf<String, Session>()
    private var lastRules: RuleSet? = null

    /** Seen-state snapshots read from Room, applied as each package's session is created. */
    private val PENDING_STATES = mutableMapOf<String, String>()
    @Volatile private var seenLoaded = false
    private var sessionDay: String? = null
    private var lastDayCheckAt = 0L
    private const val DAY_CHECK_MS = 15_000L
    private const val TAG = "ThumbwellDetect"
    private const val THROTTLE_MS = 250L
    private const val BADGE_WATCH_MS = 250L

    /** Set by "delete my data": the service drops its in-memory players on the next event. */
    @Volatile private var clearRequested = false

    fun requestClear() {
      clearRequested = true
    }

    /** True while the service is bound in this process (read by the watchdog and debug tools). */
    @Volatile var connected = false
      private set
  }
}
