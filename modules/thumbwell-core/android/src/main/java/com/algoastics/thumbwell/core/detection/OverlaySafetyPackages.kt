package com.algoastics.thumbwell.core.detection

/**
 * Windows Thumbwell must never draw over (F07 item 10): Android Settings, the Accessibility
 * settings screens and the package installer's uninstall dialog, including OEM variants. If the
 * foreground window belongs to one of these packages, the badge and the lock overlay are hidden at
 * once. Hide only: nothing is pressed, and nothing re-shows until a tracked reels surface is on
 * screen again.
 *
 * Pure Kotlin so the list and the matcher are unit-tested without a device. The package names are
 * from public AOSP/OEM knowledge; check them on real phones (docs/TESTING-phase0.md, F07-10).
 */
object OverlaySafetyPackages {
  /** Exact package names. */
  val EXACT: Set<String> = linkedSetOf(
    // AOSP / Pixel / most OEMs: Settings, Accessibility settings, permission and uninstall dialogs.
    "com.android.settings",
    "com.google.android.packageinstaller",
    "com.android.packageinstaller",
    "com.google.android.permissioncontroller",
    "com.android.permissioncontroller",
    // Samsung One UI.
    "com.samsung.accessibility",
    "com.samsung.android.packageinstaller",
    // Xiaomi / MIUI / HyperOS.
    "com.miui.securitycenter",
    "com.miui.packageinstaller",
    "com.lbe.security.miui",
    // Huawei / EMUI.
    "com.huawei.systemmanager",
    // TalkBack and the Accessibility Menu.
    "com.google.android.marvin.talkback",
    // Not com.android.systemui: transient SystemUI windows (volume panel, shade) pass in front of a
    // reels app while it scrolls and must not make the badge vanish. They hide it as a normal leave.
  )

  /** Prefix patterns. Each ends with a dot, so "com.oplus." never matches "com.oplusfoo". */
  val PREFIXES: List<String> = listOf(
    "com.android.settings.", // Settings Intelligence and other Settings parts
    "com.samsung.android.settings", // com.samsung.android.settings and its parts
    "com.samsung.android.app.settings", // e.g. com.samsung.android.app.settings.bixby
    "com.google.android.accessibility.", // Accessibility Menu and related
    "com.coloros.", // ColorOS (OPPO / realme): settings, safecenter, installer
    "com.oplus.", // ColorOS 12+ / OxygenOS: settings, security permission, appdetail
    "com.vivo.", // Funtouch / OriginOS: settings, permission manager, installer
    "com.bbk.", // vivo / BBK system apps
    "com.iqoo.", // iQOO secure
    "com.huawei.android.settings",
    "com.hihonor.", // Honor
  )

  /** True when [packageName] is a window Thumbwell must stay off. Null or blank is not a match. */
  fun matches(packageName: String?): Boolean {
    val pkg = packageName?.trim()?.lowercase()
    if (pkg.isNullOrEmpty()) return false
    if (pkg in EXACT) return true
    return PREFIXES.any { pkg.startsWith(it) }
  }
}
