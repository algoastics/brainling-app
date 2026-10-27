package com.algoastics.thumbwell.core.health

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

/** 15-minute watchdog: notices when the accessibility service was disabled or killed. */
class HealthWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    HealthMonitor.get(applicationContext).check(HealthMonitor.REASON_WATCHDOG)
    return Result.success()
  }
}
