package com.algoastics.thumbwell.core.rules

import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Structural fallback for apps whose view ids are obfuscated: a node of one of [classNames] that
 * covers at least the given fraction of the screen, optionally containing a matching [descendant].
 * Uses only class names, bounds and flags; never text.
 */
data class StructureRule(
  val classNames: Set<String>,
  val minWidthFraction: Float,
  val minHeightFraction: Float,
  val requireScrollable: Boolean,
  val requireLongClickable: Boolean,
  val descendant: StructureRule?,
)

/** Detection rules for one app family (regional and patched variants share one rule). */
data class AppRule(
  val key: String,
  val packageNames: List<String>,
  val enabled: Boolean,
  /** View ids (without the "pkg:id/" prefix) that mean "a short-video surface is on screen". */
  val surfaceIds: List<String>,
  /** Exact content descriptions of internal player components (labels, never user content). */
  val contentDescriptions: List<String>,
  val structure: StructureRule?,
  /**
   * DM signature: when all of these view ids are visible the reel on screen was opened from a
   * direct message, so it is not counted. Empty = the app has no DM exclusion.
   */
  val dmSignatureIds: List<String>,
  /**
   * View ids of the paging container (RecyclerView/ViewPager) whose TYPE_VIEW_SCROLLED events
   * carry the reel position. Needed when the surface id is a page child rather than the pager
   * itself (YouTube, TikTok). Empty = scroll events must come from a [surfaceIds] view.
   */
  val pagerIds: List<String> = emptyList(),
  /**
   * Optional class filter for [pagerIds], for apps that reuse one id on nested pagers (TikTok's
   * tab pagers and its vertical feed pager are all `viewpager`). Matched against the event's or
   * the source node's class name.
   */
  val pagerClassNames: List<String> = emptyList(),
  /**
   * Optional ad labels ("Sponsored", "Ad", localized variants) shown on sponsored reels; a reel
   * carrying one is not counted. Compared case-insensitively against whole label nodes only.
   */
  val adLabels: List<String> = emptyList(),
) {
  val hasSignal: Boolean
    get() = surfaceIds.isNotEmpty() || contentDescriptions.isNotEmpty() || structure != null
}

/**
 * Detection ruleset: data only, never code. Remote copies are Ed25519-signed and verified by
 * [RulesVerifier] before this parser ever sees them.
 */
data class RuleSet(
  val version: Int,
  val issuedAtMs: Long,
  val expiresAtMs: Long,
  val dwellMs: Long,
  val dedupeSize: Int,
  /** A return to a reels surface within this gap continues the previous browsing session. */
  val sessionGapMs: Long,
  /** Re-checks after a window change, for apps (YouTube) that render the surface late. */
  val surfaceRetryDelaysMs: List<Long>,
  val apps: List<AppRule>,
) {
  private val byPackage: Map<String, AppRule> =
    apps.filter { it.enabled }.flatMap { app -> app.packageNames.map { it to app } }.toMap()

  fun ruleFor(packageName: CharSequence?): AppRule? = packageName?.let { byPackage[it.toString()] }

  val enabledPackages: Set<String> get() = byPackage.keys

  /** True when [other] needs fresh counters (different dwell or dedupe window). */
  fun countingDiffers(other: RuleSet): Boolean =
    dwellMs != other.dwellMs || dedupeSize != other.dedupeSize

  companion object {
    /** Schema written by sign-rules.mjs. 3 adds the optional pagerIds / pagerClassNames
     * and adLabels. */
    const val SCHEMA = 3
    val SUPPORTED_SCHEMAS = setOf(2, 3)
    private val KEY = Regex("^[a-z][a-z0-9_]{0,31}$")
    private val PACKAGE = Regex("^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+$")
    private val VIEW_ID = Regex("^[A-Za-z0-9_]{1,100}$")
    private val CLASS_NAME = Regex("^[A-Za-z0-9_.$]{1,200}$")
    private const val MAX_STRUCTURE_DEPTH = 4

    /** Parses and validates a ruleset payload; throws if it is malformed or out of range. */
    fun parse(json: String): RuleSet {
      val root = JSONObject(json)
      require(root.getInt("schema") in SUPPORTED_SCHEMAS) { "unsupported schema" }
      val version = root.getInt("version")
      val dwellMs = root.getLong("dwellMs")
      val dedupeSize = root.getInt("dedupeSize")
      val sessionGapMs = root.getLong("sessionGapMs")
      val retries = longs(root.getJSONArray("surfaceRetryDelaysMs"))
      require(version > 0) { "version must be positive" }
      require(dwellMs in 100..10_000) { "dwellMs out of range" }
      require(dedupeSize in 1..500) { "dedupeSize out of range" }
      require(sessionGapMs in 0..86_400_000) { "sessionGapMs out of range" }
      require(retries.size <= 10 && retries.all { it in 1..5_000 }) { "bad surfaceRetryDelaysMs" }

      val appsJson = root.getJSONArray("apps")
      val apps = (0 until appsJson.length()).map { i -> parseApp(appsJson.getJSONObject(i)) }
      val packages = apps.flatMap { it.packageNames }
      require(packages.toSet().size == packages.size) { "package in two apps" }
      require(apps.map { it.key }.toSet().size == apps.size) { "duplicate key" }

      val issuedAtMs = parseInstant(root.getString("issuedAt"))
      val expiresAtMs = parseInstant(root.getString("expiresAt"))
      require(expiresAtMs > issuedAtMs) { "expiresAt before issuedAt" }
      return RuleSet(
        version, issuedAtMs, expiresAtMs, dwellMs, dedupeSize, sessionGapMs, retries, apps,
      )
    }

    private fun parseApp(app: JSONObject): AppRule {
      val rule = AppRule(
        key = app.getString("key"),
        packageNames = strings(app.getJSONArray("packageNames")),
        enabled = app.getBoolean("enabled"),
        surfaceIds = optStrings(app, "surfaceIds"),
        contentDescriptions = optStrings(app, "contentDescriptions"),
        structure = app.optJSONObject("structure")?.let { parseStructure(it, 1) },
        dmSignatureIds = optStrings(app, "dmSignatureIds"),
        pagerIds = optStrings(app, "pagerIds"),
        pagerClassNames = optStrings(app, "pagerClassNames"),
        adLabels = optStrings(app, "adLabels"),
      )
      require(KEY.matches(rule.key)) { "bad key" }
      require(rule.packageNames.isNotEmpty() && rule.packageNames.all { PACKAGE.matches(it) }) {
        "bad packageNames"
      }
      val ids = rule.surfaceIds + rule.dmSignatureIds + rule.pagerIds
      require(ids.all { VIEW_ID.matches(it) }) { "bad view id" }
      require(rule.pagerClassNames.all { CLASS_NAME.matches(it) }) { "bad pagerClassNames" }
      require(rule.pagerClassNames.isEmpty() || rule.pagerIds.isNotEmpty()) {
        "pagerClassNames without pagerIds"
      }
      require(rule.adLabels.size <= 20 && rule.adLabels.all { it.trim().length in 1..32 }) {
        "bad adLabels"
      }
      require(rule.contentDescriptions.all { it.length in 1..200 }) { "bad content description" }
      require(!rule.enabled || rule.hasSignal) { "enabled app without a detection signal" }
      return rule
    }

    private fun parseStructure(json: JSONObject, depth: Int): StructureRule {
      require(depth <= MAX_STRUCTURE_DEPTH) { "structure too deep" }
      val rule = StructureRule(
        classNames = strings(json.getJSONArray("classNames")).toSet(),
        minWidthFraction = json.optDouble("minWidthFraction", 0.0).toFloat(),
        minHeightFraction = json.optDouble("minHeightFraction", 0.0).toFloat(),
        requireScrollable = json.optBoolean("requireScrollable", false),
        requireLongClickable = json.optBoolean("requireLongClickable", false),
        descendant = json.optJSONObject("descendant")?.let { parseStructure(it, depth + 1) },
      )
      require(rule.classNames.isNotEmpty() && rule.classNames.all { CLASS_NAME.matches(it) }) {
        "bad structure classNames"
      }
      require(rule.minWidthFraction in 0f..1f && rule.minHeightFraction in 0f..1f) {
        "bad structure fraction"
      }
      return rule
    }

    private fun optStrings(json: JSONObject, name: String): List<String> =
      json.optJSONArray(name)?.let(::strings) ?: emptyList()

    private fun strings(array: JSONArray): List<String> =
      (0 until array.length()).map { array.getString(it) }

    private fun longs(array: JSONArray): List<Long> = (0 until array.length()).map { array.getLong(it) }

    /** Parses a UTC instant in the form 2026-10-21T00:00:00Z. */
    fun parseInstant(value: String): Long {
      val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
        isLenient = false
      }
      return requireNotNull(format.parse(value)) { "bad instant" }.time
    }
  }
}
