package com.algoastics.thumbwell.core

/**
 * Phase 0 build flags. Code for the apps and UI below stays in the tree but is switched off; Phase 1
 * flips the defaults (or a signed ruleset enables the app once its flag allows it).
 *
 * A flag only ever narrows what the signed ruleset enables: a remote ruleset cannot turn on an app
 * whose flag is off here.
 */
object FeatureFlags {
  /** Facebook Reels (`facebook`, `facebook_lite`). Phase 1, opt-in. */
  @Volatile var facebookEnabled = false

  /** Snapchat Spotlight (`snapchat`). Phase 1, opt-in. */
  @Volatile var snapchatEnabled = false

  /** The floating Thumb badge (F07). On in Phase 0; the user's "Floating badge" switch controls it. */
  @Volatile var countBadgeEnabled = true

  /** True when the app family [key] may be counted in this build. */
  fun allowsApp(key: String): Boolean = when (key) {
    "facebook", "facebook_lite" -> facebookEnabled
    "snapchat" -> snapchatEnabled
    else -> true
  }

  fun toMap(): Map<String, Any> = mapOf(
    "facebook" to facebookEnabled,
    "snapchat" to snapchatEnabled,
    "countBadge" to countBadgeEnabled,
  )
}
