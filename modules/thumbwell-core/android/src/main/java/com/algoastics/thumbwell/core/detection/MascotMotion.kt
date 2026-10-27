package com.algoastics.thumbwell.core.detection

/** Blink timing of one mood: random gap between blinks, how long the eyes stay closed. */
data class BlinkSpec(
  val minDelayMs: Long,
  val maxDelayMs: Long,
  val closeMs: Long,
  /** Chance (0..1) that a blink is followed by a quick second one. */
  val doubleChance: Double,
)

/**
 * Pure blink timing rules for the overlay mascot ([CountBadge] applies them). A normal person
 * blinks every 2-5 s, each blink 100-150 ms; calm moods follow that, tired moods blink slower and
 * longer, the fried mood blinks fast and nervously. Randomness is passed in as a 0..1 unit so
 * this stays deterministic and unit-testable.
 */
object MascotMotion {
  /** Eyes-open gap between the two blinks of a double blink. */
  const val DOUBLE_BLINK_GAP_MS = 110L

  fun blink(mood: MascotMood): BlinkSpec = when (mood) {
    MascotMood.GLOWING -> BlinkSpec(2500, 4500, 140, 0.12)
    MascotMood.HAPPY -> BlinkSpec(2000, 4000, 130, 0.15)
    MascotMood.MEH -> BlinkSpec(3000, 5000, 190, 0.05)
    MascotMood.FRIED -> BlinkSpec(1000, 2200, 100, 0.25)
    MascotMood.ZOMBIE -> BlinkSpec(4500, 7000, 420, 0.0)
  }

  private fun clamp(unit: Double): Double = unit.coerceIn(0.0, 1.0)

  /** Delay until the next blink; [unit] is a random value in 0..1. */
  fun nextBlinkDelayMs(mood: MascotMood, unit: Double): Long {
    val spec = blink(mood)
    return spec.minDelayMs + (clamp(unit) * (spec.maxDelayMs - spec.minDelayMs)).toLong()
  }

  fun isDoubleBlink(mood: MascotMood, unit: Double): Boolean = clamp(unit) < blink(mood).doubleChance
}
