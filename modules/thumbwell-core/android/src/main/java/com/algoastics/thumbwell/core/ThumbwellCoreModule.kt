package com.algoastics.thumbwell.core

import android.content.Context
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.algoastics.thumbwell.core.data.AppIcons
import com.algoastics.thumbwell.core.data.CorePrefs
import com.algoastics.thumbwell.core.data.CountRepository
import com.algoastics.thumbwell.core.data.DayCounts
import com.algoastics.thumbwell.core.data.ThumbwellDay
import com.algoastics.thumbwell.core.detection.BadgeDisplayTime
import com.algoastics.thumbwell.core.detection.BadgeSettings
import com.algoastics.thumbwell.core.detection.DetectionDebug
import com.algoastics.thumbwell.core.detection.ThumbwellAccessibilityService
import com.algoastics.thumbwell.core.health.HealthMonitor
import com.algoastics.thumbwell.core.health.HealthStatus
import com.algoastics.thumbwell.core.lock.LimitEngine
import com.algoastics.thumbwell.core.lock.LockState
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

  private val lockListener: (LockState) -> Unit = { state ->
    sendEvent(LOCK_EVENT, state.toMap())
  }

  override fun definition() = ModuleDefinition {
    Name("ThumbwellCore")

    Events(COUNT_EVENT, HEALTH_EVENT, LOCK_EVENT)

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

    /** True when "Display over other apps" is granted, so the lock can be drawn below banners. */
    AsyncFunction("canDrawOverlays") {
      Settings.canDrawOverlays(context)
    }

    /**
     * Opens the system "Display over other apps" page for this app (grant or turn off), or the app
     * info page on a phone that has no such page. Started on the main thread.
     */
    AsyncFunction("openOverlaySettings") {
      val uri = Uri.parse("package:${context.packageName}")
      val overlay = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, uri)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(overlay)
      } catch (e: ActivityNotFoundException) {
        context.startActivity(
          Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, uri)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      }
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
      LimitEngine.get(context).refreshBlocking()
      CountRepository.get(context).today().toMap()
    }

    /**
     * The installed app's own launcher icon as a base64 PNG (`sizePx` default 96), or null when it
     * is not installed. Only the supported packages can be asked for.
     */
    AsyncFunction("getAppIcon") { packageName: String, sizePx: Int? ->
      AppIcons.pngBase64(context.packageManager, packageName, sizePx ?: DEFAULT_ICON_PX)
    }

    /**
     * The daily limit: `{effective, pending, pendingFromDay}`. Lowering applies at once; raising
     * applies from the next logical day (shown as `pending`).
     */
    AsyncFunction("getDailyLimit") {
      val prefs = CorePrefs.get(context)
      prefs.dailyLimit(prefs.currentDayKey(System.currentTimeMillis())).toMap()
    }

    AsyncFunction("setDailyLimit") { value: Int ->
      val prefs = CorePrefs.get(context)
      val now = System.currentTimeMillis()
      val zone = java.util.TimeZone.getDefault()
      val start = prefs.dayStartMinutes()
      val today = prefs.currentDayKey(now, zone)
      val next = ThumbwellDay.key(ThumbwellDay.nextCloseMs(now, zone, start), zone, start)
      val limit = prefs.setDailyLimit(value, today, next)
      // Lowering applies now, so the lock may start (or, never, end) right away.
      LimitEngine.get(context).refreshBlocking()
      limit.toMap()
    }

    /**
     * Floating badge settings (S43-P0): `{enabled, displayTime: '1s'|'2s'|'3s'|'always',
     * hideWhenResting}`. Defaults: on, 'always', false. Stored natively; the badge reads them live.
     */
    AsyncFunction("getBadgeSettings") {
      badgeMap(CorePrefs.get(context).badgeSettings())
    }

    /** Partial update: omitted fields keep their value. Returns the saved settings. */
    AsyncFunction("setBadgeSettings") { patch: Map<String, Any?> ->
      val prefs = CorePrefs.get(context)
      val current = prefs.badgeSettings()
      val time = patch["displayTime"]?.let { key ->
        BadgeDisplayTime.entries.firstOrNull { it.key == key }
          ?: throw IllegalArgumentException("bad displayTime")
      }
      val next = BadgeSettings(
        enabled = patch["enabled"] as? Boolean ?: current.enabled,
        displayTime = time ?: current.displayTime,
        hideWhenResting = patch["hideWhenResting"] as? Boolean ?: current.hideWhenResting,
      )
      prefs.setBadgeSettings(next)
      badgeMap(next)
    }

    /** Deletes all counts, events, ad tallies, seen state, consent, limit and day start. */
    AsyncFunction("clearAllData") {
      ThumbwellAccessibilityService.requestClear()
      CountRepository.get(context).clearAll()
      CorePrefs.get(context).clearAll()
      LimitEngine.get(context).refreshBlocking()
    }

    /**
     * The limit lock: `{locked, limit, total, lockedUntilMs}` (`lockedUntilMs` is null when not
     * locked). Computed natively; the overlay itself never depends on JS.
     */
    AsyncFunction("getLockState") {
      LimitEngine.get(context).refreshBlocking().toMap()
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

    OnStartObserving(LOCK_EVENT) {
      LimitEngine.get(context).addListener(lockListener)
    }

    OnStopObserving(LOCK_EVENT) {
      LimitEngine.get(context).removeListener(lockListener)
    }

    OnStartObserving(HEALTH_EVENT) {
      HealthMonitor.get(context).addListener(healthListener)
    }

    OnStopObserving(HEALTH_EVENT) {
      HealthMonitor.get(context).removeListener(healthListener)
    }
  }

  private fun badgeMap(s: BadgeSettings): Map<String, Any> = mapOf(
    "enabled" to s.enabled,
    "displayTime" to s.displayTime.key,
    "hideWhenResting" to s.hideWhenResting,
  )

  companion object {
    private const val COUNT_EVENT = "onCountChange"
    private const val HEALTH_EVENT = "onHealthChange"
    private const val LOCK_EVENT = "lockStateChanged"
    private const val DEFAULT_HISTORY_DAYS = 30
    private const val DEFAULT_ICON_PX = 96
  }
}
