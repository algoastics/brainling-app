package com.algoastics.thumbwell.core.data

import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * A Thumbwell day runs from 04:00 to 04:00 local time, so a late-night session counts toward the
 * evening it started in. Every count stores the day key computed in the time zone it happened in,
 * so travelling or a DST shift never moves counts that are already recorded.
 */
object ThumbwellDay {
  const val CLOSE_HOUR = 4

  /** Day key (yyyy-MM-dd) of the Thumbwell day containing [epochMs] in [zone]. */
  fun key(epochMs: Long, zone: TimeZone = TimeZone.getDefault()): String {
    val cal = dayStart(epochMs, zone)
    return String.format(
      Locale.US,
      "%04d-%02d-%02d",
      cal.get(Calendar.YEAR),
      cal.get(Calendar.MONTH) + 1,
      cal.get(Calendar.DAY_OF_MONTH),
    )
  }

  /** Epoch ms of the 04:00 local day close that ends the day containing [epochMs]. */
  fun nextCloseMs(epochMs: Long, zone: TimeZone = TimeZone.getDefault()): Long {
    val cal = dayStart(epochMs, zone)
    cal.add(Calendar.DAY_OF_MONTH, 1)
    cal.set(Calendar.HOUR_OF_DAY, CLOSE_HOUR)
    return cal.timeInMillis
  }

  private fun dayStart(epochMs: Long, zone: TimeZone): Calendar {
    val cal = Calendar.getInstance(zone, Locale.US)
    cal.timeInMillis = epochMs
    if (cal.get(Calendar.HOUR_OF_DAY) < CLOSE_HOUR) cal.add(Calendar.DAY_OF_MONTH, -1)
    cal.set(Calendar.HOUR_OF_DAY, CLOSE_HOUR)
    cal.set(Calendar.MINUTE, 0)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    return cal
  }
}
