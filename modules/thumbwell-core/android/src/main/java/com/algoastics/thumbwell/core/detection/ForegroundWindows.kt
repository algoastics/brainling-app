package com.algoastics.thumbwell.core.detection

/**
 * Which kind of window is in front, for the badge and lock watches. Pure Kotlin, unit-tested.
 *
 * - [Kind.TRACKED]: the reels app itself.
 * - [Kind.SAFETY]: Settings, Accessibility settings, installers ([OverlaySafetyPackages]).
 * - [Kind.HOME]: a launcher / home app. Home, Recents on every OEM whose Recents lives in the
 *   launcher (Pixel, Samsung, Xiaomi, ColorOS), and the app drawer all come through here.
 * - [Kind.RECENTS]: a Recents window found by class name (AOSP SystemUI `RecentsActivity`, a
 *   launcher's `RecentsActivity`). `com.android.systemui` as a package is NOT immediate: its shade,
 *   volume panel and so on pass in front of a reels app while it scrolls ([Kind.OTHER]).
 * - [Kind.OTHER]: anything else, an unknown or transient window: debounced by [BadgeForeground].
 *
 * SAFETY, HOME and RECENTS are an "immediate leave": the badge and the lock hide at once.
 */
object ForegroundWindows {
  enum class Kind { TRACKED, SAFETY, HOME, RECENTS, OTHER }

  /** Launchers resolved by the HOME intent are the source of truth; these are the fallback. */
  val KNOWN_LAUNCHERS: Set<String> = linkedSetOf(
    "com.google.android.apps.nexuslauncher", // Pixel
    "com.android.launcher3", // AOSP
    "com.android.launcher", // AOSP / some OEMs
    "com.android.launcher2",
    "com.sec.android.app.launcher", // Samsung One UI
    "com.miui.home", // Xiaomi / MIUI / HyperOS
    "com.mi.android.globallauncher", // POCO / Mi global
    "com.oppo.launcher", // ColorOS
    "com.oneplus.launcher",
    "net.oneplus.launcher",
    "com.huawei.android.launcher",
    "com.hihonor.android.launcher",
    "com.vivo.launcher",
    "com.bbk.launcher2",
    "com.transsion.hilauncher",
    "com.realme.launcher",
    "com.motorola.launcher3",
    "com.teslacoilsw.launcher", // Nova
    "com.microsoft.launcher",
    "bitpit.launcher", // Niagara
  )

  /** Class-name tokens of a Recents activity or window (AOSP, Quickstep, MIUI, ColorOS). */
  private val RECENTS_TOKENS = listOf("recentsactivity", "recentstransitionactivity", "recentsview")

  fun isRecentsClass(className: String?): Boolean {
    val name = className?.lowercase() ?: return false
    return RECENTS_TOKENS.any { name.contains(it) }
  }

  /** [homePackages] are the launchers the device resolved ([HomePackages] on Android). */
  fun classify(
    activePackage: String?,
    className: String?,
    trackedPackage: String,
    homePackages: Set<String> = emptySet(),
  ): Kind {
    val pkg = activePackage?.trim()?.lowercase()
    if (pkg.isNullOrEmpty()) return Kind.OTHER
    if (pkg == trackedPackage.lowercase()) return Kind.TRACKED
    if (OverlaySafetyPackages.matches(pkg)) return Kind.SAFETY
    if (pkg in KNOWN_LAUNCHERS || homePackages.any { it.equals(pkg, ignoreCase = true) }) return Kind.HOME
    if (isRecentsClass(className)) return Kind.RECENTS
    return Kind.OTHER
  }

  /** True for the classes that hide the overlays without the debounce. */
  fun isImmediateLeave(kind: Kind): Boolean =
    kind == Kind.SAFETY || kind == Kind.HOME || kind == Kind.RECENTS

  /** Launcher packages from the HOME intent: the default one first, then every home app. */
  fun mergeHomePackages(default: String?, all: Collection<String>): Set<String> {
    val out = LinkedHashSet<String>()
    // "android" is the resolver shown when no default home is set; it is not a launcher.
    default?.takeIf { it.isNotBlank() && it != "android" }?.let(out::add)
    all.filter { it.isNotBlank() && it != "android" }.forEach(out::add)
    return out
  }
}
