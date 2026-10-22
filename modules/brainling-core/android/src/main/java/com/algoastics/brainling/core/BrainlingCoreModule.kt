package com.algoastics.brainling.core

import android.content.Context
import android.content.Intent
import android.provider.Settings
import com.algoastics.brainling.core.data.CountRepository
import com.algoastics.brainling.core.data.DayCounts
import com.algoastics.brainling.core.detection.DetectionDebug
import com.algoastics.brainling.core.health.HealthMonitor
import com.algoastics.brainling.core.health.HealthStatus
import com.algoastics.brainling.core.rules.RulesManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS bridge. Every function is async: reads go through Room and SharedPreferences on background
 * threads, and the settings intent is started on the main thread. The bridge is read-only for
 * counts; JS cannot write them.
 */
class BrainlingCoreModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val countListener: (DayCounts) -> Unit = { counts ->
    sendEvent(COUNT_EVENT, counts.toMap())
  }

  private val healthListener: (HealthStatus) -> Unit = { status ->
    sendEvent(HEALTH_EVENT, status.toMap())
  }

  override fun definition() = ModuleDefinition {
    Name("BrainlingCore")

    Events(COUNT_EVENT, HEALTH_EVENT)

    OnCreate {
      appContext.reactContext?.let(BrainlingWork::onAppOpen)
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
  }
}
