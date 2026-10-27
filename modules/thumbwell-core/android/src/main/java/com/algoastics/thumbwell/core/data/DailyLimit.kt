package com.algoastics.thumbwell.core.data

/**
 * The daily reel limit with the anti-cheat rule (F06): lowering applies at once, raising applies
 * from the next logical day. Pure logic; [CorePrefs] persists the state. Day keys are
 * `yyyy-MM-dd` strings from [ThumbwellDay], so they compare as text.
 */
data class LimitState(
  /** The limit in force today. */
  val effective: Int,
  /** A higher limit waiting for [pendingFromDay], or null. */
  val pending: Int? = null,
  /** The first day [pending] applies (a day key), or null. */
  val pendingFromDay: String? = null,
) {
  fun toMap(): Map<String, Any?> =
    mapOf("effective" to effective, "pending" to pending, "pendingFromDay" to pendingFromDay)
}

object DailyLimit {
  const val DEFAULT = 60
  const val MIN = 0
  const val MAX = 1000

  fun valid(value: Int): Boolean = value in MIN..MAX

  /** Promotes a pending limit once [todayKey] has reached its start day. */
  fun resolve(state: LimitState, todayKey: String): LimitState {
    val pending = state.pending ?: return state
    val from = state.pendingFromDay
    return if (from == null || todayKey >= from) LimitState(pending) else state
  }

  /**
   * Applies a user change made on [todayKey]; [nextDayKey] is the day after it. Lower than the
   * limit in force: effective now, any pending raise is dropped. Higher: waits until [nextDayKey].
   * Equal: cancels a pending raise.
   */
  fun set(state: LimitState, value: Int, todayKey: String, nextDayKey: String): LimitState {
    require(valid(value)) { "daily limit out of range" }
    val current = resolve(state, todayKey)
    return when {
      value < current.effective -> LimitState(value)
      value > current.effective -> LimitState(current.effective, value, nextDayKey)
      else -> LimitState(current.effective)
    }
  }
}
