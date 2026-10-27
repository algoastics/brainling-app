package com.algoastics.thumbwell.core

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.algoastics.thumbwell.core.health.HealthMonitor
import com.algoastics.thumbwell.core.health.HealthWorker
import com.algoastics.thumbwell.core.rules.RulesRefreshWorker
import java.util.concurrent.TimeUnit

/** Background schedule: health watchdog every 15 min, ruleset refresh every 6 h and on open. */
object ThumbwellWork {
  private const val HEALTH_WORK = "thumbwell-health-watchdog"
  private const val RULES_WORK = "thumbwell-rules-refresh"
  private const val RULES_NOW_WORK = "thumbwell-rules-refresh-now"

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
