package com.algoastics.thumbwell.core.detection

import com.algoastics.thumbwell.core.detection.ForegroundWindows.Kind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ForegroundWindowsTest {
  private val ig = "com.instagram.android"

  @Test fun theTrackedAppKeeps() {
    assertEquals(Kind.TRACKED, ForegroundWindows.classify(ig, null, ig))
  }

  @Test fun launcherPackagesAreHome() {
    for (p in listOf("com.sec.android.app.launcher", "com.google.android.apps.nexuslauncher", "com.android.launcher3", "com.miui.home", "com.oppo.launcher")) {
      assertEquals(p, Kind.HOME, ForegroundWindows.classify(p, null, ig))
    }
    assertEquals(Kind.HOME, ForegroundWindows.classify("my.home", null, ig, setOf("my.home")))
  }

  @Test fun recentsByClassNameEvenInSystemUi() {
    assertEquals(Kind.RECENTS, ForegroundWindows.classify("com.android.systemui", "com.android.systemui.recents.RecentsActivity", ig))
    assertEquals(Kind.RECENTS, ForegroundWindows.classify("com.android.systemui", "com.android.systemui.recents.RecentsTransitionActivity", ig))
    assertEquals(Kind.RECENTS, ForegroundWindows.classify("com.vendor.shell", "com.android.quickstep.RecentsActivity", ig))
  }

  @Test fun systemUiAsAPackageIsNotAnImmediateLeave() {
    assertEquals(Kind.OTHER, ForegroundWindows.classify("com.android.systemui", null, ig))
    assertEquals(Kind.OTHER, ForegroundWindows.classify("com.android.systemui", "android.widget.FrameLayout", ig))
    assertFalse(ForegroundWindows.isImmediateLeave(Kind.OTHER))
  }

  @Test fun safetyPackagesAreSafety() {
    assertEquals(Kind.SAFETY, ForegroundWindows.classify("com.android.settings", null, ig))
    assertTrue(ForegroundWindows.isImmediateLeave(Kind.SAFETY))
  }

  @Test fun unknownAndNullWindowsAreOther() {
    assertEquals(Kind.OTHER, ForegroundWindows.classify("com.some.popup", null, ig))
    assertEquals(Kind.OTHER, ForegroundWindows.classify(null, null, ig))
    assertEquals(Kind.OTHER, ForegroundWindows.classify("  ", null, ig))
  }

  @Test fun immediateClassesAreSafetyHomeAndRecents() {
    assertEquals(
      setOf(Kind.SAFETY, Kind.HOME, Kind.RECENTS),
      Kind.values().filter(ForegroundWindows::isImmediateLeave).toSet(),
    )
  }

  @Test fun mergeKeepsTheDefaultFirstAndDropsTheResolver() {
    assertEquals(
      listOf("a.home", "b.home"),
      ForegroundWindows.mergeHomePackages("a.home", listOf("b.home", "a.home", "android", "")).toList(),
    )
    assertEquals(listOf("b.home"), ForegroundWindows.mergeHomePackages("android", listOf("b.home")).toList())
    assertTrue(ForegroundWindows.mergeHomePackages(null, emptyList()).isEmpty())
  }
}
