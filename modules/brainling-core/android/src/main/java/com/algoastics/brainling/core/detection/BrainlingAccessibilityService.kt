package com.algoastics.brainling.core.detection

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import com.algoastics.brainling.core.BuildConfig
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * Counts reels in the apps enabled by the ruleset. Reads only view IDs, class names, bounds and
 * scroll positions; never reads, logs, stores or uploads screen text.
 */
class BrainlingAccessibilityService : AccessibilityService() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var rules: RuleSet
  private lateinit var store: CountStore
  private val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
  private val sessions = mutableMapOf<String, Session>()
  private val scheduled = mutableSetOf<String>()

  private class Session(val counter: ReelCounter) {
    var id = 0
    var onSurface = false
    var surfaceHeight = 0
    var pageIndex: Int? = null
    var retriesLeft = 0
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    rules = RuleSet.parse(assets.open(RuleSet.ASSET_PATH).bufferedReader().use { it.readText() })
    store = CountStore.get(this)
    DetectionDebug.serviceConnected = true
    debugLog("connected, rules v${rules.version}")
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent) {
    if (!::rules.isInitialized) return
    val rule = rules.ruleFor(event.packageName) ?: return
    val session = sessions.getOrPut(rule.packageName) {
      Session(ReelCounter(rules.dwellMs, rules.dedupeSize))
    }
    when (event.eventType) {
      AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
        if (session.onSurface) {
          NodeInspector.pageIndex(event, session.surfaceHeight)?.let { session.pageIndex = it }
        }
      }
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> session.retriesLeft = SURFACE_RETRIES
    }
    schedule(rule, THROTTLE_MS)
  }

  private fun schedule(rule: AppRule, delayMs: Long) {
    if (!scheduled.add(rule.packageName)) return
    handler.postDelayed({
      scheduled.remove(rule.packageName)
      evaluate(rule)
    }, delayMs)
  }

  private fun evaluate(rule: AppRule) {
    val session = sessions[rule.packageName] ?: return
    val root = rootInActiveWindow
    val surface = if (root?.packageName?.toString() == rule.packageName) {
      NodeInspector.findSurface(root, rule)
    } else {
      null
    }
    val now = SystemClock.elapsedRealtime()

    if (surface == null) {
      if (session.onSurface) {
        session.onSurface = false
        session.id++
        session.pageIndex = null
      }
      session.counter.observe(null, now)
      if (session.retriesLeft > 0) {
        session.retriesLeft--
        schedule(rule, RETRY_MS)
      }
      return
    }

    session.retriesLeft = 0
    session.onSurface = true
    session.surfaceHeight = surface.bounds.height()
    val key = itemKey(rule.packageName, session.id, session.pageIndex)
    val counted = session.counter.observe(key, now) != null
    if (counted) store.increment(rule.key)

    DetectionDebug.record(
      DetectionInfo(
        packageName = rule.packageName,
        surfaceId = surface.surfaceId,
        className = surface.className,
        bounds = surface.bounds.toShortString(),
        itemIndex = session.pageIndex,
        keyPrefix = key.take(8),
        counted = counted,
        atMs = System.currentTimeMillis(),
      ),
    )
    debugLog(
      "surface=${surface.surfaceId} index=${session.pageIndex} key=${key.take(8)} counted=$counted",
    )

    if (session.counter.hasPending()) schedule(rule, rules.dwellMs + DWELL_SLACK_MS)
  }

  /** Salted hash of a structural identity (package, surface session, page index). */
  private fun itemKey(packageName: String, sessionId: Int, pageIndex: Int?): String {
    val digest = MessageDigest.getInstance("SHA-256")
    digest.update(salt)
    digest.update("$packageName|$sessionId|${pageIndex ?: "start"}".toByteArray())
    return digest.digest().joinToString("") { "%02x".format(it) }.take(16)
  }

  override fun onInterrupt() = Unit

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    DetectionDebug.serviceConnected = false
    super.onDestroy()
  }

  private fun debugLog(message: String) {
    if (BuildConfig.DEBUG) Log.d(TAG, message)
  }

  companion object {
    private const val TAG = "BrainlingDetect"
    private const val THROTTLE_MS = 250L
    private const val RETRY_MS = 300L
    private const val SURFACE_RETRIES = 3
    private const val DWELL_SLACK_MS = 50L
  }
}
