package com.algoastics.thumbwell.core.detection

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OverlaySafetyPackagesTest {
  private fun assertMatches(vararg packages: String) =
    packages.forEach { assertTrue("$it should match", OverlaySafetyPackages.matches(it)) }

  private fun assertNoMatch(vararg packages: String) =
    packages.forEach { assertFalse("$it should not match", OverlaySafetyPackages.matches(it)) }

  @Test fun androidSettingsAndInstallers() = assertMatches(
    "com.android.settings",
    "com.android.settings.intelligence",
    "com.google.android.packageinstaller",
    "com.android.packageinstaller",
    "com.google.android.permissioncontroller",
    "com.android.permissioncontroller",
  )

  @Test fun samsung() = assertMatches(
    "com.samsung.accessibility",
    "com.samsung.android.settings",
    "com.samsung.android.settings.foo",
    "com.samsung.android.app.settings",
    "com.samsung.android.app.settings.bixby",
    "com.samsung.android.packageinstaller",
  )

  @Test fun xiaomiHuaweiAndSystemUi() = assertMatches(
    "com.miui.securitycenter",
    "com.miui.packageinstaller",
    "com.lbe.security.miui",
    "com.huawei.systemmanager",
    "com.huawei.android.settings",
  )

  @Test fun oppoRealmeVivoPrefixes() = assertMatches(
    "com.coloros.safecenter",
    "com.coloros.settings",
    "com.oplus.settings",
    "com.oplus.securitypermission",
    "com.oplus.appdetail",
    "com.vivo.settings",
    "com.vivo.permissionmanager",
    "com.bbk.settings",
    "com.iqoo.secure",
  )

  @Test fun accessibilityHelpers() = assertMatches(
    "com.google.android.marvin.talkback",
    "com.google.android.accessibility.accessibilitymenu",
  )

  @Test fun matchingIgnoresCaseAndSpaces() = assertMatches(" COM.ANDROID.SETTINGS ")

  @Test fun trackedAppsAndLookalikesAreNotMatched() = assertNoMatch(
    "com.instagram.android",
    "com.google.android.youtube",
    "com.zhiliaoapp.musically",
    "com.ss.android.ugc.trill",
    "com.snapchat.android",
    "com.facebook.katana",
    "com.android.settingsx",
    "com.android.setting",
    "com.oplusfoo",
    "com.colorosx.app",
    "com.android.systemui", // transient system windows are a debounced leave, not a safety hide
    "com.android.systemuix",
    "com.android.vending",
    "com.algoastics.thumbwell",
  )

  @Test fun nullAndBlankAreNotMatched() {
    assertFalse(OverlaySafetyPackages.matches(null))
    assertFalse(OverlaySafetyPackages.matches(""))
    assertFalse(OverlaySafetyPackages.matches("   "))
  }

  @Test fun prefixesEndAtAPackageBoundary() {
    // "com.coloros." style prefixes end with a dot; the Samsung ones are deliberately open ended.
    val open = setOf("com.samsung.android.settings", "com.samsung.android.app.settings", "com.huawei.android.settings")
    OverlaySafetyPackages.PREFIXES.filter { it !in open }.forEach { assertTrue("$it", it.endsWith(".")) }
  }

  @Test fun noTrackedAppIsEverInTheList() {
    val tracked = listOf("com.instagram.android", "com.google.android.youtube", "com.zhiliaoapp.musically")
    tracked.forEach { assertFalse(OverlaySafetyPackages.matches(it)) }
  }
}
