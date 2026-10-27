package com.algoastics.thumbwell.core.detection

/** Structural info about the last detection (debug builds only); never contains screen text. */
data class DetectionInfo(
  val packageName: String,
  val surfaceId: String?,
  val className: String?,
  val bounds: String?,
  val sessionId: Int,
  val itemIndex: Int?,
  /** "pager" (adapter position from scroll events), "swipe" (counted settled swipes) or null. */
  val indexSource: String? = null,
  val keyPrefix: String?,
  val counted: Boolean,
  val dmExcluded: Boolean,
  val atMs: Long,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "packageName" to packageName,
    "surfaceId" to surfaceId,
    "className" to className,
    "bounds" to bounds,
    "sessionId" to sessionId,
    "itemIndex" to itemIndex,
    "indexSource" to indexSource,
    "keyPrefix" to keyPrefix,
    "counted" to counted,
    "dmExcluded" to dmExcluded,
    "atMs" to atMs.toDouble(),
  )
}
