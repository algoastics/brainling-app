package com.algoastics.brainling.core.data

import android.content.Context

/**
 * Moves counts recorded by the M1 spike build (SharedPreferences "brainling_counts", keys
 * "yyyy-MM-dd|appKey", midnight day boundary) into Room once, then deletes the old file.
 */
internal object SpikeCountImport {
  private const val PREFS = "brainling_counts"
  private val DATE = Regex("""\d{4}-\d{2}-\d{2}""")

  fun run(context: Context, dao: CountDao) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val entries = prefs.all
    if (entries.isEmpty()) return
    val now = System.currentTimeMillis()
    val rows = entries.mapNotNull { (field, value) ->
      val parts = field.split('|')
      val count = value as? Int
      if (parts.size != 2 || !DATE.matches(parts[0]) || count == null || count <= 0) {
        null
      } else {
        DailyAggregateEntity(parts[0], parts[1], count, now)
      }
    }
    dao.importAggregates(rows)
    prefs.edit().clear().commit()
    context.deleteSharedPreferences(PREFS)
  }
}
