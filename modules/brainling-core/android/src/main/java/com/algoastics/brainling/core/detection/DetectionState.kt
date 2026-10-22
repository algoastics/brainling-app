package com.algoastics.brainling.core.detection

import android.content.Context
import org.bouncycastle.util.encoders.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom

/** Persisted per-app browsing session: lets counting continue across surface exits and restarts. */
data class SessionSnapshot(
  val sessionId: Int,
  val pageIndex: Int?,
  /** Wall-clock time the reels surface was last on screen (0 = never). */
  val lastSeenAtMs: Long,
  val recentKeys: List<String>,
) {
  fun encode(): String = JSONObject()
    .put("sessionId", sessionId)
    .put("pageIndex", pageIndex ?: JSONObject.NULL)
    .put("lastSeenAtMs", lastSeenAtMs)
    .put("recentKeys", JSONArray(recentKeys))
    .toString()

  companion object {
    val EMPTY = SessionSnapshot(0, null, 0L, emptyList())

    fun decode(text: String?): SessionSnapshot {
      if (text.isNullOrEmpty()) return EMPTY
      return try {
        val json = JSONObject(text)
        val keys = json.getJSONArray("recentKeys")
        SessionSnapshot(
          sessionId = json.getInt("sessionId"),
          pageIndex = if (json.isNull("pageIndex")) null else json.getInt("pageIndex"),
          lastSeenAtMs = json.getLong("lastSeenAtMs"),
          recentKeys = (0 until keys.length()).map { keys.getString(it) },
        )
      } catch (e: Exception) {
        EMPTY
      }
    }
  }
}

/** Whether a return to a reels surface continues the previous session. */
object SessionPolicy {
  fun continues(lastSeenAtMs: Long, nowMs: Long, gapMs: Long): Boolean =
    lastSeenAtMs > 0 && nowMs >= lastSeenAtMs && nowMs - lastSeenAtMs <= gapMs

  /**
   * After re-entering a continued session, a first scroll position far below the remembered one
   * means the app rebuilt its feed from the top, so this is really a new session.
   */
  fun feedRestarted(rememberedIndex: Int?, firstIndex: Int): Boolean =
    rememberedIndex != null && rememberedIndex >= RESTART_MIN_INDEX && firstIndex <= RESTART_MAX_INDEX

  private const val RESTART_MIN_INDEX = 3
  private const val RESTART_MAX_INDEX = 1
}

/**
 * App-private, never-backed-up store for the item-key salt and per-app session snapshots. Keys
 * are salted hashes of structural positions; nothing here identifies content.
 */
class DetectionStateStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  val salt: ByteArray = loadSalt()

  fun load(packageName: String): SessionSnapshot = SessionSnapshot.decode(prefs.getString(key(packageName), null))

  fun save(packageName: String, snapshot: SessionSnapshot) {
    prefs.edit().putString(key(packageName), snapshot.encode()).apply()
  }

  private fun loadSalt(): ByteArray {
    prefs.getString(KEY_SALT, null)?.let { stored ->
      runCatching { Base64.decode(stored) }.getOrNull()?.takeIf { it.size == SALT_BYTES }?.let { return it }
    }
    val fresh = ByteArray(SALT_BYTES).also { SecureRandom().nextBytes(it) }
    prefs.edit().putString(KEY_SALT, Base64.toBase64String(fresh)).commit()
    return fresh
  }

  private fun key(packageName: String) = "session|$packageName"

  companion object {
    private const val PREFS = "brainling_detection"
    private const val KEY_SALT = "salt"
    private const val SALT_BYTES = 16
  }
}
