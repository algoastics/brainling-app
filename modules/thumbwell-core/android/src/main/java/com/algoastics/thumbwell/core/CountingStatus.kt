package com.algoastics.thumbwell.core

import android.content.Context
import com.algoastics.thumbwell.core.data.CorePrefs
import com.algoastics.thumbwell.core.data.Disclosure
import com.algoastics.thumbwell.core.health.HealthMonitor
import com.algoastics.thumbwell.core.health.ServiceState
import com.algoastics.thumbwell.core.rules.RuleSet
import com.algoastics.thumbwell.core.rules.RulesManager

/** Why counting is not running right now (null reason = counting). */
enum class PausedReason(val wire: String) {
  SERVICE_DISABLED("service_disabled"),
  SERVICE_NOT_RUNNING("service_not_running"),
  CONSENT_MISSING("consent_missing"),
}

/**
 * What the UI needs to show "counting paused": is the service on, is consent logged for the
 * current disclosure version, and which apps are enabled (ruleset flag and build flag both on).
 */
object CountingStatus {
  /** The first reason found, or null when counting is on. Consent is checked last on purpose. */
  fun pausedReason(serviceState: ServiceState, consentValid: Boolean): PausedReason? = when {
    serviceState == ServiceState.DISABLED -> PausedReason.SERVICE_DISABLED
    serviceState == ServiceState.NOT_RUNNING -> PausedReason.SERVICE_NOT_RUNNING
    !consentValid -> PausedReason.CONSENT_MISSING
    else -> null
  }

  fun appsEnabled(rules: RuleSet): Map<String, Boolean> =
    rules.apps.associate { it.key to (it.enabled && FeatureFlags.allowsApp(it.key)) }

  /** Blocks (health check); never call on the main thread. */
  fun read(context: Context): Map<String, Any?> {
    val prefs = CorePrefs.get(context)
    val health = HealthMonitor.get(context).check(HealthMonitor.REASON_QUERY)
    val consentValid = prefs.consentValid()
    val reason = pausedReason(health.state, consentValid)
    val apps = try {
      appsEnabled(RulesManager.get(context).active)
    } catch (e: Exception) {
      emptyMap() // no valid ruleset: nothing is counted
    }
    return mapOf(
      "paused" to (reason != null || apps.values.none { it }),
      "pausedReason" to (reason?.wire ?: if (apps.values.none { it }) "no_rules" else null),
      "serviceEnabled" to health.serviceEnabled,
      "serviceRunning" to health.serviceRunning,
      "consentLogged" to consentValid,
      "consent" to prefs.consent()?.toMap(),
      "disclosureVersion" to Disclosure.CURRENT_VERSION,
      "apps" to apps.mapValues { mapOf("enabled" to it.value) },
      "dayStartMinutes" to prefs.dayStartMinutes(),
      "flags" to FeatureFlags.toMap(),
    )
  }
}
