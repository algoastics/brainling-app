package com.algoastics.thumbwell.core.lock

import com.algoastics.thumbwell.core.detection.BadgeForeground
import org.junit.Assert.assertEquals
import org.junit.Test

class LockWatchTest {
  private val ig = "com.instagram.android"

  private fun step(f: BadgeForeground, active: String?, now: Long, lockActive: Boolean = true) =
    LockWatch.decide(lockActive, f.check(active, ig, now))

  @Test fun aSingleOddSampleNeverHidesTheLock() {
    val f = BadgeForeground()
    assertEquals(LockWatch.Action.KEEP, step(f, ig, 0))
    assertEquals(LockWatch.Action.KEEP, step(f, "com.android.systemui", 250))
    assertEquals(LockWatch.Action.KEEP, step(f, null, 500))
    assertEquals(LockWatch.Action.KEEP, step(f, ig, 750))
    assertEquals(LockWatch.Action.KEEP, step(f, "com.some.popup", 1_000))
    assertEquals(LockWatch.Action.KEEP, step(f, "com.some.popup", 1_250))
  }

  @Test fun aSafetyPackageHidesTheLockAtOnce() {
    assertEquals(LockWatch.Action.SAFETY_HIDE, step(BadgeForeground(), "com.android.settings", 0))
    assertEquals(
      LockWatch.Action.SAFETY_HIDE,
      step(BadgeForeground(), "com.google.android.packageinstaller", 0, lockActive = false),
    )
  }

  @Test fun anotherWindowThatStaysHidesTheLockAfterTheDebounce() {
    val f = BadgeForeground()
    assertEquals(LockWatch.Action.KEEP, step(f, "com.some.popup", 1_000))
    assertEquals(LockWatch.Action.KEEP, step(f, "com.some.popup", 1_250))
    assertEquals(LockWatch.Action.HIDE, step(f, "com.some.popup", 1_400))
  }

  @Test fun homeOrRecentsHidesTheLockAtOnceAndForgetsTheSurface() {
    assertEquals(LockWatch.Action.LEAVE_HIDE, step(BadgeForeground(), "com.sec.android.app.launcher", 0))
    assertEquals(
      LockWatch.Action.LEAVE_HIDE,
      LockWatch.decide(
        true,
        BadgeForeground().check("com.android.systemui", ig, 0, className = "com.android.systemui.recents.RecentsActivity"),
      ),
    )
    assertEquals(
      LockWatch.Action.LEAVE_HIDE,
      LockWatch.decide(true, BadgeForeground().check("x.home", ig, 0, homePackages = setOf("x.home"))),
    )
  }

  @Test fun theTrackedAppKeepsTheLock() {
    assertEquals(LockWatch.Action.KEEP, step(BadgeForeground(), ig, 0))
  }

  @Test fun aLockThatIsNoLongerActiveHidesAtOnce() {
    assertEquals(LockWatch.Action.HIDE, step(BadgeForeground(), ig, 0, lockActive = false))
  }
}
