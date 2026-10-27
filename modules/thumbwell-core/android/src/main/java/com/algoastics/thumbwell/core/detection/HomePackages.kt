package com.algoastics.thumbwell.core.detection

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.SystemClock

/**
 * The launcher (home) apps of this device, from the HOME intent: the default one plus every app
 * that handles it. Cached for [TTL_MS] (the default home can change). Needs the HOME `<queries>`
 * entry in the module manifest on Android 11+, no permission. Main thread only.
 */
class HomePackages(private val context: Context) {
  private var cached: Set<String> = emptySet()
  private var loadedAt = 0L

  fun get(): Set<String> {
    val now = SystemClock.elapsedRealtime()
    if (loadedAt == 0L || now - loadedAt > TTL_MS) {
      loadedAt = now
      cached = load()
    }
    return cached
  }

  private fun load(): Set<String> = try {
    val pm = context.packageManager
    val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
    val default = pm.resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName
    val all = pm.queryIntentActivities(home, 0).mapNotNull { it.activityInfo?.packageName }
    ForegroundWindows.mergeHomePackages(default, all)
  } catch (e: RuntimeException) {
    emptySet() // the built-in launcher list still applies
  }

  private companion object {
    const val TTL_MS = 60_000L
  }
}
