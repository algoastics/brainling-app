package com.algoastics.thumbwell.core.rules

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

/** Periodic (6 h) and on-app-open ruleset refresh. Failures keep the current ruleset. */
class RulesRefreshWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    RulesManager.get(applicationContext).refresh()
    return Result.success()
  }
}
