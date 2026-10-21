package com.algoastics.brainling.core.detection

import com.algoastics.brainling.core.BuildConfig

/** Structural info about the last detection; never contains screen text. */
data class DetectionInfo(
  val packageName: String,
  val surfaceId: String?,
  val className: String?,
  val bounds: String?,
  val itemIndex: Int?,
  val keyPrefix: String?,
  val counted: Boolean,
  val atMs: Long,
)

/** Debug-build-only holder for the Detection Debug screen. Stays empty in release builds. */
object DetectionDebug {
  @Volatile var serviceConnected: Boolean = false
  @Volatile private var last: DetectionInfo? = null

  fun record(info: DetectionInfo) {
    if (BuildConfig.DEBUG) last = info
  }

  fun snapshot(): Map<String, Any?>? {
    if (!BuildConfig.DEBUG) return null
    val info = last
    return mapOf(
      "serviceConnected" to serviceConnected,
      "last" to info?.let {
        mapOf(
          "packageName" to it.packageName,
          "surfaceId" to it.surfaceId,
          "className" to it.className,
          "bounds" to it.bounds,
          "itemIndex" to it.itemIndex,
          "keyPrefix" to it.keyPrefix,
          "counted" to it.counted,
          "atMs" to it.atMs,
        )
      },
    )
  }
}
