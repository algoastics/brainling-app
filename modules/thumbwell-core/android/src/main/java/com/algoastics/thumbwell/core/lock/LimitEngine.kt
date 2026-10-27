package com.algoastics.thumbwell.core.lock

import android.content.Context
import com.algoastics.thumbwell.core.data.CorePrefs
import com.algoastics.thumbwell.core.data.CountRepository
import com.algoastics.thumbwell.core.data.DayCounts
import java.util.TimeZone
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors

/**
 * Keeps the lock state: today's total from the counter store against the effective daily limit
 * (lowering applies now, raising from the next logical day; see `DailyLimit`). Lives in the app
 * process next to the accessibility service and never touches the JS runtime. Listeners fire only
 * when the state changes. Room stays the source of truth: the total is re-read from it on demand.
 */
class LimitEngine private constructor(context: Context) {
  private val counts = CountRepository.get(context)
  private val prefs = CorePrefs.get(context)
  private val executor = Executors.newSingleThreadExecutor { r -> Thread(r, "thumbwell-limit") }
  private val listeners = CopyOnWriteArraySet<(LockState) -> Unit>()

  /** The latest state; readable from any thread. */
  @Volatile var state: LockState = LockState(locked = false, limit = -1, total = 0, lockedUntilMs = null)
    private set

  private val countsListener: (DayCounts) -> Unit = { day -> update(day.total) }

  init {
    counts.addListener(countsListener)
  }

  /** Recomputes in the background (limit, day start or data changed). */
  fun refresh() {
    executor.execute { update(counts.today().total) }
  }

  /** Recomputes now and returns the result. Blocks; never call on the main thread. */
  fun refreshBlocking(): LockState {
    update(counts.today().total)
    return state
  }

  fun addListener(listener: (LockState) -> Unit) {
    listeners.add(listener)
  }

  fun removeListener(listener: (LockState) -> Unit) {
    listeners.remove(listener)
  }

  @Synchronized
  private fun update(total: Int) {
    val now = System.currentTimeMillis()
    val limit = prefs.dailyLimit(prefs.currentDayKey(now)).effective
    val next = LockRules.state(total, limit, now, prefs.dayStartMinutes(), TimeZone.getDefault())
    val previous = state
    state = next
    if (next != previous) listeners.forEach { it(next) }
  }

  companion object {
    @Volatile private var instance: LimitEngine? = null

    fun get(context: Context): LimitEngine =
      instance ?: synchronized(this) {
        instance ?: LimitEngine(context.applicationContext).also { instance = it }
      }
  }
}
