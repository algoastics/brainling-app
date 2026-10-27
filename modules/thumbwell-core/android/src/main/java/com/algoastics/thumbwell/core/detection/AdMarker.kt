package com.algoastics.thumbwell.core.detection

import java.util.Locale

/**
 * Detects the app's ad label ("Sponsored", "Ad") on a settled reel. Matching is against short
 * label nodes only: a node whose whole text or content description is a label, or a label
 * followed by a separator ("Sponsored · Shop now", "Ad · 0:15"). Captions that merely contain
 * the word never match. Case-insensitive, so localized labels can be added to the rules.
 *
 * Privacy: node text is only compared here and never stored, returned or logged.
 */
object AdMarker {
  /** Fallback labels while the bundled signed rules predate the optional adLabels field. */
  private val DEFAULTS = mapOf(
    "instagram" to listOf("Sponsored"),
    "facebook" to listOf("Sponsored"),
    "facebook_lite" to listOf("Sponsored"),
    "tiktok" to listOf("Sponsored", "Ad"),
    "tiktok_lite" to listOf("Sponsored", "Ad"),
    "youtube" to listOf("Sponsored", "Ad"),
    "snapchat" to listOf("Sponsored", "Ad"),
  )
  private const val SEPARATORS = "·•|-–—:("
  private const val MAX_LABEL_NODE = 48
  private const val MAX_NODES = 400
  private const val MAX_DEPTH = 24

  fun labelsFor(ruleKey: String, ruleLabels: List<String>): List<String> =
    ruleLabels.ifEmpty { DEFAULTS[ruleKey].orEmpty() }

  /** True when [value] is exactly one of [labels] or one followed by a separator. */
  fun isLabel(value: CharSequence?, labels: List<String>): Boolean {
    if (value == null || value.length > MAX_LABEL_NODE) return false
    val v = value.toString().trim().lowercase(Locale.ROOT)
    return labels.any { raw ->
      val label = raw.lowercase(Locale.ROOT)
      if (v == label) return@any true
      if (!v.startsWith(label)) return@any false
      val rest = v.substring(label.length).trimStart()
      rest.isNotEmpty() && rest[0] in SEPARATORS
    }
  }

  /** Breadth-first, bounded scan of a subtree for an ad label node. */
  fun <T> containsAd(
    root: T,
    labels: List<String>,
    children: (T) -> List<T>,
    values: (T) -> List<CharSequence?>,
  ): Boolean {
    if (labels.isEmpty()) return false
    val queue = ArrayDeque(listOf(root to 0))
    var seen = 0
    while (queue.isNotEmpty() && seen++ < MAX_NODES) {
      val (node, depth) = queue.removeFirst()
      if (values(node).any { isLabel(it, labels) }) return true
      if (depth < MAX_DEPTH) children(node).forEach { queue.addLast(it to depth + 1) }
    }
    return false
  }
}
