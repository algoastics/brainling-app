package com.algoastics.thumbwell.core.data

import android.content.Context
import android.content.SharedPreferences
import com.algoastics.thumbwell.core.detection.BadgeDisplayTime
import com.algoastics.thumbwell.core.detection.BadgePosition
import com.algoastics.thumbwell.core.detection.BadgeSettings
import com.algoastics.thumbwell.core.detection.BadgeSide
import java.security.SecureRandom
import java.util.concurrent.CopyOnWriteArrayList

/** The accessibility disclosure the user must have accepted before anything is counted. */
object Disclosure {
  /** Bump when the S06 disclosure text changes; consent for an older version stops counting. */
  const val CURRENT_VERSION = "1"
}

/** Consent record kept by the native side: when, and which disclosure version. */
data class ConsentRecord(val atMs: Long, val version: String) {
  fun toMap(): Map<String, Any> = mapOf("atMs" to atMs.toDouble(), "version" to version)
}

/**
 * Small native settings store (SharedPreferences, app-private): consent, day start, the logical
 * day high-water mark and the install-local fingerprint salt. Read on any thread.
 */
class CorePrefs private constructor(context: Context) {
  private val prefs: SharedPreferences =
    context.applicationContext.getSharedPreferences(NAME, Context.MODE_PRIVATE)

  @Volatile private var consentCache: ConsentRecord? = readConsent()

  private fun readConsent(): ConsentRecord? {
    val version = prefs.getString(KEY_CONSENT_VERSION, null) ?: return null
    val at = prefs.getLong(KEY_CONSENT_AT, 0L)
    return if (at > 0L) ConsentRecord(at, version) else null
  }

  fun consent(): ConsentRecord? = consentCache

  /** True when consent is logged for the current disclosure version. */
  fun consentValid(): Boolean = consentCache?.version == Disclosure.CURRENT_VERSION

  fun setConsent(version: String, nowMs: Long = System.currentTimeMillis()): ConsentRecord {
    require(version.isNotBlank() && version.length <= 32) { "bad disclosure version" }
    val record = ConsentRecord(nowMs, version)
    prefs.edit().putString(KEY_CONSENT_VERSION, version).putLong(KEY_CONSENT_AT, nowMs).commit()
    consentCache = record
    return record
  }

  /** Minutes after local midnight at which a Thumbwell day starts (default 04:00 = 240). */
  fun dayStartMinutes(): Int = prefs.getInt(KEY_DAY_START, ThumbwellDay.DEFAULT_START_MINUTES)

  fun setDayStartMinutes(minutes: Int) {
    require(minutes in 0 until MINUTES_PER_DAY) { "day start out of range" }
    prefs.edit().putInt(KEY_DAY_START, minutes).commit()
  }

  /**
   * Logical day key for [nowMs]. A day key never moves backwards: a clock set back, a time-zone
   * change or a new day start that would reopen a closed day keeps the latest key instead, so a
   * day is never closed (or started) twice.
   */
  @Synchronized
  fun currentDayKey(nowMs: Long, zone: java.util.TimeZone = java.util.TimeZone.getDefault()): String {
    val computed = ThumbwellDay.key(nowMs, zone, dayStartMinutes())
    val last = prefs.getString(KEY_LAST_DAY, null)
    if (last != null && computed <= last) return last
    prefs.edit().putString(KEY_LAST_DAY, computed).apply()
    return computed
  }

  /** The daily limit with its pending raise; a pending limit is promoted once its day starts. */
  @Synchronized
  fun dailyLimit(todayKey: String): LimitState {
    val stored = LimitState(
      effective = prefs.getInt(KEY_LIMIT, DailyLimit.DEFAULT),
      pending = if (prefs.contains(KEY_LIMIT_PENDING)) prefs.getInt(KEY_LIMIT_PENDING, 0) else null,
      pendingFromDay = prefs.getString(KEY_LIMIT_FROM, null),
    )
    val resolved = DailyLimit.resolve(stored, todayKey)
    if (resolved != stored) writeLimit(resolved)
    return resolved
  }

  /** Lowering applies now; raising applies from [nextDayKey]; the first-ever set applies now. */
  @Synchronized
  fun setDailyLimit(value: Int, todayKey: String, nextDayKey: String): LimitState {
    // The very first choice (onboarding) is not a raise: nothing was set before it.
    val next = if (prefs.contains(KEY_LIMIT)) {
      DailyLimit.set(dailyLimit(todayKey), value, todayKey, nextDayKey)
    } else {
      DailyLimit.initial(value)
    }
    writeLimit(next)
    return next
  }

  private fun writeLimit(state: LimitState) {
    val edit = prefs.edit().putInt(KEY_LIMIT, state.effective)
    if (state.pending != null) edit.putInt(KEY_LIMIT_PENDING, state.pending) else edit.remove(KEY_LIMIT_PENDING)
    if (state.pendingFromDay != null) edit.putString(KEY_LIMIT_FROM, state.pendingFromDay) else edit.remove(KEY_LIMIT_FROM)
    edit.commit()
  }

  private val badgeListeners = CopyOnWriteArrayList<() -> Unit>()

  /** Floating badge switches (S43-P0): on by default, 2 s, tuck at the edge. */
  fun badgeSettings(): BadgeSettings = BadgeSettings(
    enabled = prefs.getBoolean(KEY_BADGE_ON, true),
    displayTime = BadgeDisplayTime.fromKey(prefs.getString(KEY_BADGE_TIME, null)),
    hideWhenResting = prefs.getBoolean(KEY_BADGE_HIDE, false),
  )

  fun setBadgeSettings(settings: BadgeSettings) {
    prefs.edit()
      .putBoolean(KEY_BADGE_ON, settings.enabled)
      .putString(KEY_BADGE_TIME, settings.displayTime.key)
      .putBoolean(KEY_BADGE_HIDE, settings.hideWhenResting)
      .commit()
    badgeListeners.forEach { it() }
  }

  /** Where the badge was last dropped: the edge and the top of the pill in dp. */
  fun badgePosition(): BadgePosition = BadgePosition(
    side = if (prefs.getString(KEY_BADGE_SIDE, null) == "left") BadgeSide.LEFT else BadgeSide.RIGHT,
    yDp = prefs.getFloat(KEY_BADGE_Y, BadgePosition.DEFAULT_Y_DP),
  )

  fun setBadgePosition(position: BadgePosition) {
    prefs.edit()
      .putString(KEY_BADGE_SIDE, if (position.side == BadgeSide.LEFT) "left" else "right")
      .putFloat(KEY_BADGE_Y, position.yDp)
      .apply()
  }

  /** Called (on the writing thread) after the badge settings change. */
  fun addBadgeListener(listener: () -> Unit) {
    badgeListeners.add(listener)
  }

  fun removeBadgeListener(listener: () -> Unit) {
    badgeListeners.remove(listener)
  }

  /** Deletes every setting this store keeps (consent, limit, day start, day mark, badge, salt). */
  @Synchronized
  fun clearAll() {
    prefs.edit().clear().commit()
    consentCache = null
    badgeListeners.forEach { it() }
  }

  /** Random per-install salt for fingerprint hashes; never leaves the device. */
  @Synchronized
  fun fingerprintSalt(): ByteArray {
    prefs.getString(KEY_SALT, null)?.let { return android.util.Base64.decode(it, android.util.Base64.NO_WRAP) }
    val salt = ByteArray(16).also(SecureRandom()::nextBytes)
    prefs.edit().putString(KEY_SALT, android.util.Base64.encodeToString(salt, android.util.Base64.NO_WRAP)).commit()
    return salt
  }

  companion object {
    private const val NAME = "thumbwell_core_settings"
    private const val KEY_CONSENT_VERSION = "consent_version"
    private const val KEY_CONSENT_AT = "consent_at_ms"
    private const val KEY_DAY_START = "day_start_minutes"
    private const val KEY_LAST_DAY = "last_day_key"
    private const val KEY_LIMIT = "daily_limit"
    private const val KEY_LIMIT_PENDING = "daily_limit_pending"
    private const val KEY_LIMIT_FROM = "daily_limit_pending_from"
    private const val KEY_SALT = "fingerprint_salt"
    private const val KEY_BADGE_ON = "badge_enabled"
    private const val KEY_BADGE_TIME = "badge_display_time"
    private const val KEY_BADGE_HIDE = "badge_hide_when_resting"
    private const val KEY_BADGE_SIDE = "badge_side"
    private const val KEY_BADGE_Y = "badge_y_dp"
    const val MINUTES_PER_DAY = 24 * 60

    @Volatile private var instance: CorePrefs? = null

    fun get(context: Context): CorePrefs =
      instance ?: synchronized(this) { instance ?: CorePrefs(context).also { instance = it } }
  }
}
