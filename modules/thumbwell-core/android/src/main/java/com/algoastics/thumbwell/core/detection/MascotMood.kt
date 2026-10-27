package com.algoastics.thumbwell.core.detection

/** The five mascot moods, mildest first. Pure Kotlin, no Android dependencies. */
enum class MascotMood { GLOWING, HAPPY, MEH, FRIED, ZOMBIE }

/**
 * Mood for a platform's reel count, shown by the overlay mascot ([CountBadge]).
 *
 * TEMPORARY internal testing scale (real design later); this is the ONE place to tune it natively.
 * Each value is the lowest count of that mood: glowing 0-9, happy 10-29, meh 30-44, fried 45-69,
 * zombie 70+. Keep in sync with PLATFORM_MOOD_THRESHOLDS in src/components/mascot/platformMood.ts.
 */
object MascotMoods {
  const val HAPPY_FROM = 10
  const val MEH_FROM = 30
  const val FRIED_FROM = 45
  const val ZOMBIE_FROM = 70

  fun forCount(count: Int): MascotMood = when {
    count < HAPPY_FROM -> MascotMood.GLOWING
    count < MEH_FROM -> MascotMood.HAPPY
    count < FRIED_FROM -> MascotMood.MEH
    count < ZOMBIE_FROM -> MascotMood.FRIED
    else -> MascotMood.ZOMBIE
  }
}
