package com.algoastics.brainling.core.detection

import android.content.Context
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.CopyOnWriteArraySet

/** Today's counts, keyed by app rule key (e.g. "instagram"). */
data class DayCounts(val date: String, val apps: Map<String, Int>) {
  val total: Int get() = apps.values.sum()

  fun toMap(): Map<String, Any> = mapOf("date" to date, "total" to total, "apps" to apps)
}

/**
 * Spike store: per-day counts in app-private SharedPreferences (no screen content, only numbers).
 * Replaced by the Room store after the spike is confirmed.
 */
class CountStore private constructor(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  private val listeners = CopyOnWriteArraySet<(DayCounts) -> Unit>()

  @Synchronized
  fun increment(appKey: String): DayCounts {
    val date = todayKey()
    val field = "$date|$appKey"
    prefs.edit().putInt(field, prefs.getInt(field, 0) + 1).apply()
    val counts = read(date)
    listeners.forEach { it(counts) }
    return counts
  }

  fun today(): DayCounts = read(todayKey())

  fun addListener(listener: (DayCounts) -> Unit) {
    listeners.add(listener)
  }

  fun removeListener(listener: (DayCounts) -> Unit) {
    listeners.remove(listener)
  }

  private fun read(date: String): DayCounts {
    val prefix = "$date|"
    val apps = prefs.all
      .filterKeys { it.startsWith(prefix) }
      .mapNotNull { (k, v) -> (v as? Int)?.let { k.removePrefix(prefix) to it } }
      .toMap()
    return DayCounts(date, apps)
  }

  private fun todayKey(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

  companion object {
    private const val PREFS = "brainling_counts"

    @Volatile private var instance: CountStore? = null

    fun get(context: Context): CountStore =
      instance ?: synchronized(this) { instance ?: CountStore(context).also { instance = it } }
  }
}
