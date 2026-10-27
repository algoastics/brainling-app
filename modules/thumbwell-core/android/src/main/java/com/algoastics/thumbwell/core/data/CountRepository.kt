package com.algoastics.thumbwell.core.data

import android.content.Context
import java.security.MessageDigest
import java.util.TimeZone
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors

/** Counts for one Thumbwell day, keyed by app rule key (e.g. "instagram"). */
data class DayCounts(
  val date: String,
  val apps: Map<String, Int>,
  val nextCloseAtMs: Long,
  val timeZone: String,
  /** Sponsored reels seen per app (excluded from [apps]); stored for later, not shown in Phase 0. */
  val ads: Map<String, Int> = emptyMap(),
) {
  val total: Int get() = apps.values.sum()

  fun toMap(): Map<String, Any> = mapOf(
    "date" to date,
    "total" to total,
    "apps" to apps,
    "ads" to ads,
    "nextCloseAtMs" to nextCloseAtMs.toDouble(),
    "timeZone" to timeZone,
  )
}

/** One counted reel as the detection layer reports it (no screen text). */
data class CountedReel(
  val appKey: String,
  val packageName: String,
  /** Rule signal that matched the surface (a view id or component label constant). */
  val surface: String,
  /** Seed of the reel identity (position or page identity), hashed with the install salt. */
  val identity: String,
  /** Monotonic dwell so far; refined by [CountRepository.finishDwell]. */
  val dwellMs: Long,
)

/**
 * Writes counted reels to Room on a single background thread and notifies listeners with the
 * updated counts for the current Thumbwell day. Reads go through the same thread, so they always
 * see earlier writes and the one-time import of spike counts. Day keys come from [CorePrefs], so
 * the user's day start applies and a day key never moves backwards.
 */
class CountRepository private constructor(context: Context) {
  private val appContext = context.applicationContext
  private val dao = ThumbwellDatabase.get(appContext).countDao()
  private val prefs = CorePrefs.get(appContext)
  private val executor = Executors.newSingleThreadExecutor { r -> Thread(r, "thumbwell-counts") }
  private val listeners = CopyOnWriteArraySet<(DayCounts) -> Unit>()

  init {
    executor.execute {
      SpikeCountImport.run(appContext, dao)
      dao.pruneEventsBefore(System.currentTimeMillis() - RAW_RETENTION_MS)
    }
  }

  /** Records one counted reel; safe to call from the main thread. Returns the stored time. */
  fun record(reel: CountedReel, nowMs: Long = System.currentTimeMillis()): Long {
    executor.execute {
      val zone = TimeZone.getDefault()
      dao.record(
        ReelEventEntity(
          appKey = reel.appKey,
          packageName = reel.packageName,
          surface = reel.surface,
          dwellMs = reel.dwellMs,
          fingerprint = fingerprint(reel.packageName, reel.identity),
          countedAtMs = nowMs,
          dayKey = prefs.currentDayKey(nowMs, zone),
          timeZone = zone.id,
          utcOffsetMin = zone.getOffset(nowMs) / MS_PER_MINUTE,
        ),
      )
      val counts = read(nowMs)
      listeners.forEach { it(counts) }
    }
    return nowMs
  }

  /** Stores the final dwell of the reel recorded at [countedAtMs]. */
  fun finishDwell(appKey: String, countedAtMs: Long, dwellMs: Long) {
    executor.execute { dao.updateDwell(appKey, countedAtMs, dwellMs.coerceIn(0, MAX_DWELL_MS)) }
  }

  /** Records one sponsored reel seen (excluded from the reel count). */
  fun recordAd(appKey: String, nowMs: Long = System.currentTimeMillis()) {
    executor.execute {
      dao.recordAd(prefs.currentDayKey(nowMs), appKey, nowMs)
      val counts = read(nowMs)
      listeners.forEach { it(counts) }
    }
  }

  /** Counts for the current Thumbwell day. Blocks; never call on the main thread. */
  fun today(): DayCounts = executor.submit<DayCounts> { read(System.currentTimeMillis()) }.get()

  /** Per-day counts and ads, newest first. Blocks; never call on the main thread. */
  fun history(limit: Int): List<Map<String, Any>> = executor.submit<List<Map<String, Any>>> {
    dao.recentDays(limit.coerceIn(1, MAX_HISTORY_DAYS)).map { day ->
      val apps = dao.aggregatesFor(day).associate { it.appKey to it.count }
      mapOf(
        "date" to day,
        "total" to apps.values.sum(),
        "apps" to apps,
        "ads" to dao.adsFor(day).associate { it.appKey to it.adsSeen },
      )
    }
  }.get()

  /** Seen-state snapshots saved for the current Thumbwell day, by package. Blocks. */
  fun loadSeenStates(): Map<String, String> = executor.submit<Map<String, String>> {
    val day = prefs.currentDayKey(System.currentTimeMillis())
    dao.clearSeenStatesExcept(day)
    dao.seenStatesFor(day).associate { it.packageName to it.payload }
  }.get()

  fun saveSeenState(packageName: String, payload: String, nowMs: Long = System.currentTimeMillis()) {
    executor.execute {
      dao.putSeenState(SeenStateEntity(packageName, prefs.currentDayKey(nowMs), payload, nowMs))
    }
  }

  /** Day start: forget every saved seen state. */
  fun clearSeenStates() {
    executor.execute { dao.clearSeenStates() }
  }

  /** Deletes every count, event, ad tally, seen state and health event, then notifies listeners. */
  fun clearAll() {
    executor.submit {
      ThumbwellDatabase.get(appContext).clearAllTables()
      val counts = read(System.currentTimeMillis())
      listeners.forEach { it(counts) }
    }.get()
  }

  fun addListener(listener: (DayCounts) -> Unit) {
    listeners.add(listener)
  }

  fun removeListener(listener: (DayCounts) -> Unit) {
    listeners.remove(listener)
  }

  private fun read(nowMs: Long): DayCounts {
    val zone = TimeZone.getDefault()
    val dayKey = prefs.currentDayKey(nowMs, zone)
    val apps = dao.aggregatesFor(dayKey).associate { it.appKey to it.count }
    val ads = dao.adsFor(dayKey).associate { it.appKey to it.adsSeen }
    return DayCounts(dayKey, apps, ThumbwellDay.nextCloseMs(nowMs, zone, prefs.dayStartMinutes()), zone.id, ads)
  }

  /** Salted SHA-256 (first 16 bytes, hex) of the package and reel identity; the seed is discarded. */
  private fun fingerprint(packageName: String, identity: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
    digest.update(prefs.fingerprintSalt())
    digest.update("$packageName|$identity".toByteArray(Charsets.UTF_8))
    return digest.digest().take(16).joinToString("") { "%02x".format(it) }
  }

  companion object {
    private const val MS_PER_MINUTE = 60_000
    private const val RAW_RETENTION_MS = 30L * 24 * 60 * 60 * 1000
    private const val MAX_DWELL_MS = 60L * 60 * 1000
    private const val MAX_HISTORY_DAYS = 400

    @Volatile private var instance: CountRepository? = null

    fun get(context: Context): CountRepository =
      instance ?: synchronized(this) { instance ?: CountRepository(context).also { instance = it } }
  }
}
