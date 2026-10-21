package com.algoastics.brainling.core.detection

import org.json.JSONObject

/** Detection rules for one app: which view IDs mean "a reels surface is on screen". */
data class AppRule(
  val packageName: String,
  val key: String,
  val enabled: Boolean,
  val surfaceIds: List<String>,
)

/**
 * Detection ruleset. The spike uses the bundled `assets/brainling/rules.json`; signed remote
 * rulesets (Ed25519) replace it after the spike.
 */
data class RuleSet(
  val version: Int,
  val dwellMs: Long,
  val dedupeSize: Int,
  val apps: List<AppRule>,
) {
  private val byPackage = apps.filter { it.enabled }.associateBy { it.packageName }

  fun ruleFor(packageName: CharSequence?): AppRule? = packageName?.let { byPackage[it.toString()] }

  val enabledPackages: Set<String> get() = byPackage.keys

  companion object {
    const val ASSET_PATH = "brainling/rules.json"

    fun parse(json: String): RuleSet {
      val root = JSONObject(json)
      val appsJson = root.getJSONArray("apps")
      val apps = (0 until appsJson.length()).map { i ->
        val app = appsJson.getJSONObject(i)
        val ids = app.getJSONArray("surfaceIds")
        AppRule(
          packageName = app.getString("packageName"),
          key = app.getString("key"),
          enabled = app.optBoolean("enabled", false),
          surfaceIds = (0 until ids.length()).map { ids.getString(it) },
        )
      }
      val dwellMs = root.getLong("dwellMs")
      val dedupeSize = root.getInt("dedupeSize")
      require(dwellMs > 0) { "dwellMs must be positive" }
      require(dedupeSize > 0) { "dedupeSize must be positive" }
      return RuleSet(root.getInt("version"), dwellMs, dedupeSize, apps)
    }
  }
}
