package com.algoastics.brainling.core.detection

/**
 * Per-app counting state machine. Feed it the key of the item currently on screen (or null when
 * no reels surface is visible). An item counts once it has stayed on screen for [dwellMs]; the
 * last [dedupeSize] counted keys are never counted again. The dedupe ring can be saved and
 * restored so it survives service restarts.
 */
class ReelCounter(
  private val dwellMs: Long,
  private val dedupeSize: Int,
  restoredKeys: List<String> = emptyList(),
) {
  private var pendingKey: String? = null
  private var pendingSince = 0L
  private val recent = ArrayDeque(restoredKeys.takeLast(dedupeSize))

  /** Returns the key when this observation completes a count, otherwise null. */
  fun observe(key: String?, nowMs: Long): String? {
    if (key == null) {
      pendingKey = null
      return null
    }
    if (key != pendingKey) {
      pendingKey = key
      pendingSince = nowMs
      return null
    }
    if (nowMs - pendingSince < dwellMs || key in recent) return null
    remember(key)
    return key
  }

  /** Marks [key] as already seen without counting it (e.g. a reel opened from a DM). */
  fun suppress(key: String) {
    if (key !in recent) remember(key)
  }

  /** True while an item is waiting for its dwell to complete. */
  fun hasPending(): Boolean = pendingKey != null && pendingKey !in recent

  /** Counted keys, oldest first, for persistence. */
  fun recentKeys(): List<String> = recent.toList()

  private fun remember(key: String) {
    recent.addLast(key)
    while (recent.size > dedupeSize) recent.removeFirst()
  }
}
