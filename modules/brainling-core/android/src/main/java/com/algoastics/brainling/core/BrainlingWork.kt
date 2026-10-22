package com.algoastics.brainling.core

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.algoastics.brainling.core.health.HealthMonitor
import com.algoastics.brainling.core.health.HealthWorker
import com.algoastics.brainling.core.rules.RulesRefreshWorker
import java.util.concurrent.TimeUnit

/** Background schedule: health watchdog every 15 min, ruleset refresh every 6 h and on open. */
object BrainlingWork {
  private const val HEALTH_WORK = "brainling-health-watchdog"
  private const val RULES_WORK = "brainling-rules-refresh"
  private const val RULES_NOW_WORK = "brainling-rules-refresh-now"

  fun onAppOpen(context: Context) {
    val workManager = WorkManager.getInstance(context)
    val network = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
    workManager.enqueueUniquePeriodicWork(
      HEALTH_WORK,
      ExistingPeriodicWorkPolicy.KEEP,
      PeriodicWorkRequestBuilder<HealthWorker>(15, TimeUnit.MINUTES).build(),
    )
    workManager.enqueueUniquePeriodicWork(
      RULES_WORK,
      ExistingPeriodicWorkPolicy.KEEP,
      PeriodicWorkRequestBuilder<RulesRefreshWorker>(6, TimeUnit.HOURS).setConstraints(network).build(),
    )
    workManager.enqueueUniqueWork(
      RULES_NOW_WORK,
      ExistingWorkPolicy.KEEP,
      OneTimeWorkRequestBuilder<RulesRefreshWorker>().setConstraints(network).build(),
    )
    HealthMonitor.get(context).checkAsync(HealthMonitor.REASON_APP_OPEN)
  }
}
