package com.algoastics.brainling.core.detection

/** Structural info about the last detection (debug builds only); never contains screen text. */
data class DetectionInfo(
  val packageName: String,
  val surfaceId: String?,
  val className: String?,
  val bounds: String?,
  val sessionId: Int,
  val itemIndex: Int?,
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
    "keyPrefix" to keyPrefix,
    "counted" to counted,
    "dmExcluded" to dmExcluded,
    "atMs" to atMs.toDouble(),
  )
}
