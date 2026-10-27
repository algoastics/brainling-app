package com.algoastics.thumbwell.core.data

import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * A Thumbwell day runs from its start time (default 04:00, user-changeable) to the same time next
 * day in local time, so a late-night session counts toward the evening it started in. Every count
 * stores the day key computed in the time zone it happened in, so travelling or a DST shift never
 * moves counts that are already recorded.
 */
object ThumbwellDay {
  const val DEFAULT_START_MINUTES = 4 * 60

  /** Day key (yyyy-MM-dd) of the Thumbwell day containing [epochMs] in [zone]. */
  fun key(
    epochMs: Long,
    zone: TimeZone = TimeZone.getDefault(),
    startMinutes: Int = DEFAULT_START_MINUTES,
  ): String {
    val cal = dayStart(epochMs, zone, startMinutes)
    return String.format(
      Locale.US,
      "%04d-%02d-%02d",
      cal.get(Calendar.YEAR),
      cal.get(Calendar.MONTH) + 1,
      cal.get(Calendar.DAY_OF_MONTH),
    )
  }

  /** Epoch ms of the local day start that ends the day containing [epochMs]. */
  fun nextCloseMs(
    epochMs: Long,
    zone: TimeZone = TimeZone.getDefault(),
    startMinutes: Int = DEFAULT_START_MINUTES,
  ): Long {
    val cal = dayStart(epochMs, zone, startMinutes)
    cal.add(Calendar.DAY_OF_MONTH, 1)
    setStart(cal, startMinutes)
    return cal.timeInMillis
  }

  private fun dayStart(epochMs: Long, zone: TimeZone, startMinutes: Int): Calendar {
    val cal = Calendar.getInstance(zone, Locale.US)
    cal.timeInMillis = epochMs
    val minuteOfDay = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
    if (minuteOfDay < startMinutes) cal.add(Calendar.DAY_OF_MONTH, -1)
    setStart(cal, startMinutes)
    return cal
  }

  private fun setStart(cal: Calendar, startMinutes: Int) {
    cal.set(Calendar.HOUR_OF_DAY, startMinutes / 60)
    cal.set(Calendar.MINUTE, startMinutes % 60)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
  }
}
