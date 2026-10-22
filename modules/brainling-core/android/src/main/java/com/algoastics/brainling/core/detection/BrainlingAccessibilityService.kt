package com.algoastics.brainling.core.detection

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import com.algoastics.brainling.core.BuildConfig
import com.algoastics.brainling.core.data.CountRepository
import com.algoastics.brainling.core.health.HealthMonitor
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

  /** Browsing state for one package; the persisted part lives in [DetectionStateStore]. */
  private class Session(val counter: ReelCounter, snapshot: SessionSnapshot) {
    var id = snapshot.sessionId
    var pageIndex: Int? = snapshot.pageIndex
    var lastSeenAtMs = snapshot.lastSeenAtMs
    var onSurface = false
    var awaitingFirstIndex = false
    var surfaceHeight = 0
    var retryStep = Int.MAX_VALUE
    val pager = PagerTracker()

    fun snapshot() = SessionSnapshot(id, pageIndex, lastSeenAtMs, counter.recentKeys())
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    connected = true
    counts = CountRepository.get(this)
    stateStore = DetectionStateStore(this)
    health = HealthMonitor.get(this)
    health.onServiceConnected()
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
        if (session.onSurface && NodeInspector.isPagerEvent(event, rule)) {
          val now = SystemClock.elapsedRealtime()
          session.pager.onScroll(NodeInspector.scrollOf(event), session.surfaceHeight, now)
            ?.let { onPageIndex(session, it) }
        }
      }
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> session.retryStep = 0
    }
    schedule(packageName, THROTTLE_MS)
  }

  private fun onPageIndex(session: Session, index: Int) {
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
    val root = rootInActiveWindow?.takeIf { it.packageName?.toString() == packageName }
    val now = SystemClock.elapsedRealtime()
    val wallNow = System.currentTimeMillis()
    if (root != null) DetectionDebug.maybeCapture(this, packageName, root)
    val surface = root?.let { NodeInspector.findSurface(it, rule, packageName) }

    if (surface == null) {
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
    if (!session.onSurface) enterSurface(session, active.sessionGapMs, wallNow)
    session.onSurface = true
    session.lastSeenAtMs = wallNow
    session.surfaceHeight = surface.bounds.height()

    // Mid-swipe the surface on screen is neither reel; wait for the pager to settle so a
    // half-visible page never starts a dwell (and the old reel's dwell cannot complete).
    if (session.pager.isSettling(now)) {
      schedule(packageName, PagerTracker.SETTLE_MS)
      return
    }
    session.pager.settle(session.pageIndex, session.surfaceHeight, now)?.let { onPageIndex(session, it) }

    val key = itemKey(packageName, session.id, session.pageIndex)
    val fromDm = root != null && NodeInspector.hasDmSignature(root, rule, packageName)
    val counted = if (fromDm) {
      session.counter.suppress(key)
      session.counter.observe(null, now)
      false
    } else {
      session.counter.observe(key, now) != null
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

  override fun onInterrupt() = Unit

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

    /** True while the service is bound in this process (read by the watchdog and debug tools). */
    @Volatile var connected = false
      private set
  }
}
