package com.algoastics.thumbwell.core.rules

import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import com.algoastics.thumbwell.core.BuildConfig
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Owns the active ruleset: the bundled signed default, replaced by a newer verified remote copy
 * when one is configured. The last good remote copy is kept in app-private storage and verified
 * again on every load; anything that fails falls back to the bundled ruleset.
 */
class RulesManager private constructor(context: Context) {
  private val appContext = context.applicationContext
  private val verifier = RulesVerifier.trusted()
  private val prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  private val storedFile = File(appContext.noBackupFilesDir, STORED_FILE)
  private val listeners = CopyOnWriteArraySet<(RuleSet) -> Unit>()

  @Volatile var active: RuleSet
    private set

  @Volatile var source: String = SOURCE_BUNDLED
    private set

  init {
    active = loadBest()
  }

  private fun loadBest(): RuleSet {
    val bundled = verifier.verify(
      appContext.assets.open(BUNDLED_ASSET).bufferedReader().use { it.readText() },
    )
    val stored = readStored()
    val best = if (stored != null && stored.version > bundled.version) stored else bundled
    source = if (best === stored) SOURCE_REMOTE else SOURCE_BUNDLED
    if (best.version > highestVersion()) prefs.edit().putInt(KEY_HIGHEST, best.version).apply()
    return best
  }

  private fun readStored(): RuleSet? {
    if (!storedFile.exists()) return null
    return try {
      verifier.verify(storedFile.readText())
    } catch (e: Exception) {
      storedFile.delete()
      recordResult("STORED_${(e as? RulesRejectedException)?.reason ?: "UNREADABLE"}")
      null
    }
  }

  private fun highestVersion(): Int = prefs.getInt(KEY_HIGHEST, 0)

  /** Remote ruleset URL baked in at build time (EAS env THUMBWELL_RULES_URL), or null. */
  fun remoteUrl(): String? = try {
    val info = appContext.packageManager.getApplicationInfo(
      appContext.packageName,
      PackageManager.GET_META_DATA,
    )
    info.metaData?.getString(META_RULES_URL)?.takeIf { it.isNotBlank() }
  } catch (e: PackageManager.NameNotFoundException) {
    null
  }

  /**
   * Fetches, verifies and applies a newer remote ruleset. Blocking network call: run it from a
   * worker or background thread only. Returns the outcome name for status reporting.
   */
  @Synchronized
  fun refresh(): String {
    val url = remoteUrl() ?: return recordResult(RESULT_NOT_CONFIGURED)
    val outcome = try {
      if (!url.startsWith("https://")) RulesVerifier.reject(RulesRejection.INSECURE_URL)
      val text = download(url)
      val candidate = verifier.verify(text)
      RulesPolicy.check(candidate, active.version, highestVersion(), System.currentTimeMillis())
        ?.let { RulesVerifier.reject(it) }
      store(text)
      prefs.edit().putInt(KEY_HIGHEST, candidate.version).apply()
      active = candidate
      source = SOURCE_REMOTE
      listeners.forEach { it(candidate) }
      "APPLIED_V${candidate.version}"
    } catch (e: RulesRejectedException) {
      e.reason.name
    }
    debugLog("refresh: $outcome")
    return recordResult(outcome)
  }

  private fun download(url: String): String {
    val connection = try {
      URL(url).openConnection() as HttpURLConnection
    } catch (e: IOException) {
      RulesVerifier.reject(RulesRejection.NETWORK_ERROR)
    }
    try {
      connection.connectTimeout = TIMEOUT_MS
      connection.readTimeout = TIMEOUT_MS
      connection.useCaches = false
      connection.setRequestProperty("Accept", "application/json")
      if (connection.responseCode != HttpURLConnection.HTTP_OK) {
        RulesVerifier.reject(RulesRejection.HTTP_ERROR)
      }
      // Redirects never leave HTTPS (HttpURLConnection does not follow protocol changes).
      if (connection.url.protocol != "https") RulesVerifier.reject(RulesRejection.INSECURE_URL)
      val limit = RulesVerifier.MAX_ENVELOPE_CHARS + 1
      val bytes = connection.inputStream.use { input ->
        val buffer = ByteArray(limit)
        var total = 0
        while (total < limit) {
          val read = input.read(buffer, total, limit - total)
          if (read < 0) break
          total += read
        }
        buffer.copyOf(total)
      }
      if (bytes.size >= limit) RulesVerifier.reject(RulesRejection.TOO_LARGE)
      return String(bytes, Charsets.UTF_8)
    } catch (e: IOException) {
      RulesVerifier.reject(RulesRejection.NETWORK_ERROR)
    } finally {
      connection.disconnect()
    }
  }

  private fun store(text: String) {
    val tmp = File(storedFile.parentFile, "$STORED_FILE.tmp")
    tmp.writeText(text)
    if (!tmp.renameTo(storedFile)) {
      tmp.delete()
      RulesVerifier.reject(RulesRejection.STORAGE_ERROR)
    }
  }

  private fun recordResult(result: String): String {
    prefs.edit()
      .putString(KEY_LAST_RESULT, result)
      .putLong(KEY_LAST_CHECK, System.currentTimeMillis())
      .apply()
    return result
  }

  fun status(): Map<String, Any?> {
    val rules = active
    return mapOf(
      "version" to rules.version,
      "source" to source,
      "expiresAtMs" to rules.expiresAtMs.toDouble(),
      "remoteConfigured" to (remoteUrl() != null),
      "lastResult" to prefs.getString(KEY_LAST_RESULT, null),
      "lastCheckAtMs" to prefs.getLong(KEY_LAST_CHECK, 0L).takeIf { it > 0 }?.toDouble(),
      "apps" to rules.apps.map {
        mapOf("key" to it.key, "packageNames" to it.packageNames, "enabled" to it.enabled)
      },
    )
  }

  fun addListener(listener: (RuleSet) -> Unit) {
    listeners.add(listener)
  }

  fun removeListener(listener: (RuleSet) -> Unit) {
    listeners.remove(listener)
  }

  private fun debugLog(message: String) {
    if (BuildConfig.DEBUG) Log.d(TAG, message)
  }

  companion object {
    const val BUNDLED_ASSET = "thumbwell/rules.signed.json"
    const val META_RULES_URL = "com.algoastics.thumbwell.RULES_URL"
    const val SOURCE_BUNDLED = "bundled"
    const val SOURCE_REMOTE = "remote"
    private const val RESULT_NOT_CONFIGURED = "NOT_CONFIGURED"
    private const val TAG = "ThumbwellRules"
    private const val PREFS = "thumbwell_rules"
    private const val STORED_FILE = "rules.remote.signed.json"
    private const val KEY_HIGHEST = "highest_version"
    private const val KEY_LAST_RESULT = "last_result"
    private const val KEY_LAST_CHECK = "last_check_ms"
    private const val TIMEOUT_MS = 15_000

    @Volatile private var instance: RulesManager? = null

    fun get(context: Context): RulesManager =
      instance ?: synchronized(this) { instance ?: RulesManager(context).also { instance = it } }
  }
}
