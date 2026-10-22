package com.algoastics.brainling.core.health

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import com.algoastics.brainling.core.data.BrainlingDatabase
import com.algoastics.brainling.core.data.HealthEventEntity
import com.algoastics.brainling.core.detection.BrainlingAccessibilityService
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors

/** Accessibility service health as seen by the watchdog. */
enum class ServiceState(val wire: String) {
  /** Enabled in settings and bound by the system. */
  OK("ok"),

  /** Turned off in accessibility settings (or never turned on). */
  DISABLED("disabled"),

  /** Enabled in settings but not running: killed, crashed or not yet bound. */
  NOT_RUNNING("not_running"),
}

data class HealthStatus(
  val state: ServiceState,
  val serviceEnabled: Boolean,
  val serviceRunning: Boolean,
  val lastConnectedAtMs: Long,
  val lastHeartbeatAtMs: Long,
  val lastCheckAtMs: Long,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "state" to state.wire,
    "serviceEnabled" to serviceEnabled,
    "serviceRunning" to serviceRunning,
    "lastConnectedAtMs" to lastConnectedAtMs.takeIf { it > 0 }?.toDouble(),
    "lastHeartbeatAtMs" to lastHeartbeatAtMs.takeIf { it > 0 }?.toDouble(),
    "lastCheckAtMs" to lastCheckAtMs.toDouble(),
  )
}

/**
 * Service health watchdog. Checked every 15 min by [HealthWorker], on app open and on service
 * connect/disconnect. Every state change is stored in Room (`health_events`) and sent to
 * listeners. Turning the service off posts a one-tap re-enable reminder ([ReenableNotifier]);
 * the reminder is cleared once the service is running again.
 */
class HealthMonitor private constructor(context: Context) {
  private val appContext = context.applicationContext
  private val prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  private val dao by lazy { BrainlingDatabase.get(appContext).healthDao() }
  private val executor = Executors.newSingleThreadExecutor { r -> Thread(r, "brainling-health") }
  private val listeners = CopyOnWriteArraySet<(HealthStatus) -> Unit>()
  @Volatile private var lastHeartbeatWriteMs = 0L

  /** Runs a check off the calling thread (for service callbacks on the main thread). */
  fun checkAsync(reason: String) {
    executor.execute { checkNow(reason) }
  }

  /** Runs a check and returns the status. Blocks; never call on the main thread. */
  fun check(reason: String): HealthStatus = executor.submit<HealthStatus> { checkNow(reason) }.get()

  fun recentEvents(limit: Int): List<Map<String, Any>> = executor.submit<List<Map<String, Any>>> {
    dao.recent(limit.coerceIn(1, MAX_EVENTS)).map {
      mapOf("atMs" to it.atMs.toDouble(), "state" to it.state, "reason" to it.reason)
    }
  }.get()

  fun onServiceConnected() {
    prefs.edit().putLong(KEY_CONNECTED, System.currentTimeMillis()).apply()
    checkAsync(REASON_CONNECTED)
  }

  fun onServiceStopped() {
    checkAsync(REASON_STOPPED)
  }

  /** Cheap liveness marker from the service; persisted at most once a minute. */
  fun heartbeat(nowMs: Long = System.currentTimeMillis()) {
    if (nowMs - lastHeartbeatWriteMs < HEARTBEAT_WRITE_MS) return
    lastHeartbeatWriteMs = nowMs
    prefs.edit().putLong(KEY_HEARTBEAT, nowMs).apply()
  }

  fun addListener(listener: (HealthStatus) -> Unit) {
    listeners.add(listener)
  }

  fun removeListener(listener: (HealthStatus) -> Unit) {
    listeners.remove(listener)
  }

  private fun checkNow(reason: String): HealthStatus {
    val now = System.currentTimeMillis()
    val enabled = isServiceEnabled(appContext)
    val running = enabled && isServiceRunning()
    val state = when {
      !enabled -> ServiceState.DISABLED
      !running -> ServiceState.NOT_RUNNING
      else -> ServiceState.OK
    }
    val previous = prefs.getString(KEY_STATE, null)
    prefs.edit().putString(KEY_STATE, state.wire).putLong(KEY_CHECK, now).apply()
    val status = HealthStatus(
      state = state,
      serviceEnabled = enabled,
      serviceRunning = running,
      lastConnectedAtMs = prefs.getLong(KEY_CONNECTED, 0L),
      lastHeartbeatAtMs = prefs.getLong(KEY_HEARTBEAT, 0L),
      lastCheckAtMs = now,
    )
    if (previous != state.wire) {
      dao.insert(HealthEventEntity(atMs = now, state = state.wire, reason = reason))
      dao.deleteBefore(now - RETENTION_MS)
      if (ReenableNotifier.shouldNotify(previous, state.wire)) ReenableNotifier.show(appContext)
      if (state == ServiceState.OK) ReenableNotifier.cancel(appContext)
      listeners.forEach { it(status) }
    }
    return status
  }

  /**
   * Bound means the system lists the service as enabled-and-running in AccessibilityManager (a
   * crashed or killed service stays in Settings but drops out of this list), or the service
   * instance in this process is connected.
   */
  private fun isServiceRunning(): Boolean {
    if (BrainlingAccessibilityService.connected) return true
    val expected = ComponentName(appContext, BrainlingAccessibilityService::class.java)
    val manager = appContext.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
    return manager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
      .any { ComponentName.unflattenFromString(it.id) == expected }
  }

  companion object {
    const val REASON_WATCHDOG = "watchdog"
    const val REASON_APP_OPEN = "app_open"
    const val REASON_QUERY = "query"
    private const val REASON_CONNECTED = "service_connected"
    private const val REASON_STOPPED = "service_stopped"
    private const val PREFS = "brainling_health"
    private const val KEY_STATE = "state"
    private const val KEY_CHECK = "last_check_ms"
    private const val KEY_CONNECTED = "last_connected_ms"
    private const val KEY_HEARTBEAT = "last_heartbeat_ms"
    private const val HEARTBEAT_WRITE_MS = 60_000L
    private const val RETENTION_MS = 30L * 24 * 60 * 60 * 1000
    private const val MAX_EVENTS = 200

    /** True when the user has turned the service on in accessibility settings. */
    fun isServiceEnabled(context: Context): Boolean {
      val expected = ComponentName(context, BrainlingAccessibilityService::class.java)
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
      ) ?: return false
      return enabled.split(':').any { ComponentName.unflattenFromString(it) == expected }
    }

    @Volatile private var instance: HealthMonitor? = null

    fun get(context: Context): HealthMonitor =
      instance ?: synchronized(this) { instance ?: HealthMonitor(context).also { instance = it } }
  }
}
