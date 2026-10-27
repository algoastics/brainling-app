package com.algoastics.thumbwell.core

import android.content.Context
import android.content.Intent
import android.provider.Settings
import com.algoastics.thumbwell.core.data.CorePrefs
import com.algoastics.thumbwell.core.data.CountRepository
import com.algoastics.thumbwell.core.data.DayCounts
import com.algoastics.thumbwell.core.detection.DetectionDebug
import com.algoastics.thumbwell.core.health.HealthMonitor
import com.algoastics.thumbwell.core.health.HealthStatus
import com.algoastics.thumbwell.core.rules.RulesManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS bridge. Every function is async: reads go through Room and SharedPreferences on background
 * threads, and the settings intent is started on the main thread. The bridge is read-only for
 * counts; JS cannot write them.
 */
class ThumbwellCoreModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val countListener: (DayCounts) -> Unit = { counts ->
    sendEvent(COUNT_EVENT, counts.toMap())
  }

  private val healthListener: (HealthStatus) -> Unit = { status ->
    sendEvent(HEALTH_EVENT, status.toMap())
  }

  override fun definition() = ModuleDefinition {
    Name("ThumbwellCore")

    Events(COUNT_EVENT, HEALTH_EVENT)

    OnCreate {
      appContext.reactContext?.let(ThumbwellWork::onAppOpen)
    }

    AsyncFunction("isServiceEnabled") {
      HealthMonitor.isServiceEnabled(context)
    }

    AsyncFunction("openAccessibilitySettings") {
      context.startActivity(
        Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getTodayCounts") {
      CountRepository.get(context).today().toMap()
    }

    /** Per-day counts and ads seen, newest first (default 30 days, max 400). */
    AsyncFunction("getDailyCounts") { limit: Int? ->
      CountRepository.get(context).history(limit ?: DEFAULT_HISTORY_DAYS)
    }

    /** Counting status for the "counting paused" UI: service, consent, per-app enabled, flags. */
    AsyncFunction("getCountingStatus") {
      CountingStatus.read(context)
    }

    /** Logs the user's consent for [version] of the disclosure (timestamp = now). */
    AsyncFunction("setConsent") { version: String ->
      CorePrefs.get(context).setConsent(version).toMap()
    }

    AsyncFunction("getConsent") {
      CorePrefs.get(context).consent()?.toMap()
    }

    /** Minutes after local midnight at which the Thumbwell day starts (default 240 = 04:00). */
    AsyncFunction("getDayStartMinutes") {
      CorePrefs.get(context).dayStartMinutes()
    }

    AsyncFunction("setDayStartMinutes") { minutes: Int ->
      CorePrefs.get(context).setDayStartMinutes(minutes)
      CountRepository.get(context).today().toMap()
    }

    AsyncFunction("getHealth") {
      HealthMonitor.get(context).check(HealthMonitor.REASON_QUERY).toMap()
    }

    AsyncFunction("getRulesStatus") {
      RulesManager.get(context).status()
    }

    AsyncFunction("getDebugState") {
      DetectionDebug.snapshot()
    }

    AsyncFunction("captureLayout") {
      DetectionDebug.armCapture()
    }

    AsyncFunction("stopCapture") {
      DetectionDebug.stopCapture()
    }

    OnStartObserving(COUNT_EVENT) {
      CountRepository.get(context).addListener(countListener)
    }

    OnStopObserving(COUNT_EVENT) {
      CountRepository.get(context).removeListener(countListener)
    }

    OnStartObserving(HEALTH_EVENT) {
      HealthMonitor.get(context).addListener(healthListener)
    }

    OnStopObserving(HEALTH_EVENT) {
      HealthMonitor.get(context).removeListener(healthListener)
    }
  }

  companion object {
    private const val COUNT_EVENT = "onCountChange"
    private const val HEALTH_EVENT = "onHealthChange"
    private const val DEFAULT_HISTORY_DAYS = 30
  }
}
