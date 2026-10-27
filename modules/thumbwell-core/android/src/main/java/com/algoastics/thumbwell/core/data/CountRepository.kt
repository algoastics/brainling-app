package com.algoastics.thumbwell.core.data

import android.content.Context
import java.util.TimeZone
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors

/** Counts for one Thumbwell day, keyed by app rule key (e.g. "instagram"). */
data class DayCounts(
  val date: String,
  val apps: Map<String, Int>,
  val nextCloseAtMs: Long,
  val timeZone: String,
) {
  val total: Int get() = apps.values.sum()

  fun toMap(): Map<String, Any> = mapOf(
    "date" to date,
    "total" to total,
    "apps" to apps,
    "nextCloseAtMs" to nextCloseAtMs.toDouble(),
    "timeZone" to timeZone,
  )
}

/**
 * Writes counted reels to Room on a single background thread and notifies listeners with the
 * updated counts for the current Thumbwell day. Reads go through the same thread, so they always
 * see earlier writes and the one-time import of spike counts.
 */
class CountRepository private constructor(context: Context) {
  private val appContext = context.applicationContext
  private val dao = ThumbwellDatabase.get(appContext).countDao()
  private val executor = Executors.newSingleThreadExecutor { r -> Thread(r, "thumbwell-counts") }
  private val listeners = CopyOnWriteArraySet<(DayCounts) -> Unit>()

  init {
    executor.execute { SpikeCountImport.run(appContext, dao) }
  }

  /** Records one counted reel for [appKey]; safe to call from the main thread. */
  fun record(appKey: String, nowMs: Long = System.currentTimeMillis()) {
    executor.execute {
      val zone = TimeZone.getDefault()
      dao.record(
        CountEventEntity(
          appKey = appKey,
          countedAtMs = nowMs,
          dayKey = ThumbwellDay.key(nowMs, zone),
          timeZone = zone.id,
          utcOffsetMin = zone.getOffset(nowMs) / MS_PER_MINUTE,
        ),
      )
      val counts = read(nowMs)
      listeners.forEach { it(counts) }
    }
  }

  /** Counts for the current Thumbwell day. Blocks; never call on the main thread. */
  fun today(): DayCounts = executor.submit<DayCounts> { read(System.currentTimeMillis()) }.get()

  fun addListener(listener: (DayCounts) -> Unit) {
    listeners.add(listener)
  }

  fun removeListener(listener: (DayCounts) -> Unit) {
    listeners.remove(listener)
  }

  private fun read(nowMs: Long): DayCounts {
    val zone = TimeZone.getDefault()
    val dayKey = ThumbwellDay.key(nowMs, zone)
    val apps = dao.aggregatesFor(dayKey).associate { it.appKey to it.count }
    return DayCounts(dayKey, apps, ThumbwellDay.nextCloseMs(nowMs, zone), zone.id)
  }

  companion object {
    private const val MS_PER_MINUTE = 60_000

    @Volatile private var instance: CountRepository? = null

    fun get(context: Context): CountRepository =
      instance ?: synchronized(this) { instance ?: CountRepository(context).also { instance = it } }
  }
}
