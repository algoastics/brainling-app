package com.algoastics.brainling.core

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import com.algoastics.brainling.core.detection.BrainlingAccessibilityService
import com.algoastics.brainling.core.detection.CountStore
import com.algoastics.brainling.core.detection.DayCounts
import com.algoastics.brainling.core.detection.DetectionDebug
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BrainlingCoreModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val countListener: (DayCounts) -> Unit = { counts ->
    sendEvent(COUNT_EVENT, counts.toMap())
  }

  override fun definition() = ModuleDefinition {
    Name("BrainlingCore")

    Events(COUNT_EVENT)

    Function("isServiceEnabled") {
      val expected = ComponentName(context, BrainlingAccessibilityService::class.java)
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
      ) ?: ""
      enabled.split(':').any { ComponentName.unflattenFromString(it) == expected }
    }

    Function("openAccessibilitySettings") {
      context.startActivity(
        Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    Function("getTodayCounts") {
      CountStore.get(context).today().toMap()
    }

    Function("getDebugState") {
      DetectionDebug.snapshot()
    }

    OnStartObserving(COUNT_EVENT) {
      CountStore.get(context).addListener(countListener)
    }

    OnStopObserving(COUNT_EVENT) {
      CountStore.get(context).removeListener(countListener)
    }
  }

  companion object {
    private const val COUNT_EVENT = "onCountChange"
  }
}
