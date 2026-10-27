package com.algoastics.thumbwell.core.lock

import java.io.File
import java.util.TimeZone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LockLogicTest {
  private val karachi = TimeZone.getTimeZone("Asia/Karachi")
  private val newYork = TimeZone.getTimeZone("America/New_York")

  private fun utc(iso: String): Long = java.time.Instant.parse(iso).toEpochMilli()

  // --- limit boundary, zero mode ---

  @Test fun belowTheLimitIsNotLocked() {
    val s = LockRules.state(59, 60, utc("2026-10-27T17:15:00Z"), 240, karachi)
    assertFalse(s.locked)
    assertNull(s.lockedUntilMs)
  }

  @Test fun reachingTheLimitLocks() {
    val s = LockRules.state(60, 60, utc("2026-10-27T17:15:00Z"), 240, karachi)
    assertTrue(s.locked)
    assertEquals(utc("2026-10-27T23:00:00Z"), s.lockedUntilMs)
    assertEquals(60, s.limit)
    assertEquals(60, s.total)
  }

  @Test fun overTheLimitStaysLocked() {
    assertTrue(LockRules.reached(75, 60))
  }

  @Test fun zeroModeLocksBeforeTheFirstReel() {
    val s = LockRules.state(0, 0, utc("2026-10-27T17:15:00Z"), 240, karachi)
    assertTrue(s.locked)
  }

  @Test fun loweringBelowTodaysTotalLocksAtOnce() {
    // 40 reels seen; the user lowers 60 to 30: the engine recomputes with the new effective limit.
    val now = utc("2026-10-27T17:15:00Z")
    assertFalse(LockRules.state(40, 60, now, 240, karachi).locked)
    assertTrue(LockRules.state(40, 30, now, 240, karachi).locked)
  }

  @Test fun raisingKeepsTodaysEffectiveLimit() {
    // A raise is pending (effective stays 60), so the lock holds today.
    val now = utc("2026-10-27T17:15:00Z")
    assertTrue(LockRules.state(60, 60, now, 240, karachi).locked)
  }

  // --- day roll and locked-until ---

  @Test fun lockLiftsByItselfAtTheDayStart() {
    val s = LockRules.state(60, 60, utc("2026-10-27T17:15:00Z"), 240, karachi)
    val until = s.lockedUntilMs!!
    assertTrue(LockRules.activeAt(s, until - 1))
    assertFalse(LockRules.activeAt(s, until))
    assertFalse(LockRules.activeAt(LockState(false, 60, 10, null), 0L))
  }

  @Test fun lockedUntilMatchesTheJsUtil() {
    // Same cases as src/lock/__tests__/lockTime.test.ts.
    assertEquals(utc("2026-10-27T23:00:00Z"), LockClock.lockedUntilMs(utc("2026-10-27T17:15:00Z"), 240, karachi))
    assertEquals(utc("2026-10-26T23:00:00Z"), LockClock.lockedUntilMs(utc("2026-10-26T21:30:00Z"), 240, karachi))
    assertEquals(utc("2026-10-27T23:00:00Z"), LockClock.lockedUntilMs(utc("2026-10-26T23:00:00Z"), 240, karachi))
    assertEquals(utc("2026-10-28T08:00:00Z"), LockClock.lockedUntilMs(utc("2026-10-27T12:00:00Z"), 240, newYork))
    assertEquals(utc("2026-11-01T09:00:00Z"), LockClock.lockedUntilMs(utc("2026-10-31T20:00:00Z"), 240, newYork))
    assertEquals(utc("2026-03-08T08:00:00Z"), LockClock.lockedUntilMs(utc("2026-03-07T20:00:00Z"), 240, newYork))
    assertEquals(utc("2027-01-01T04:00:00Z"), LockClock.lockedUntilMs(utc("2026-12-31T20:00:00Z"), 240, TimeZone.getTimeZone("UTC")))
  }

  @Test fun lockedUntilFollowsACustomDayStart() {
    val now = utc("2026-10-27T17:15:00Z")
    assertEquals("06:30", LockClock.format(LockClock.lockedUntilMs(now, 6 * 60 + 30, karachi), karachi))
    assertEquals("00:00", LockClock.format(LockClock.lockedUntilMs(now, 0, karachi), karachi))
    assertEquals("04:00", LockClock.format(LockClock.lockedUntilMs(now, 240, karachi), karachi))
  }

  @Test fun formatUsesTheZoneNotUtc() {
    assertEquals("04:00", LockClock.format(utc("2026-10-28T08:00:00Z"), newYork))
    assertEquals("09:00", LockClock.format(utc("2026-10-28T04:00:00Z"), karachi))
  }

  // --- when to show ---

  @Test fun limitReelWaitsForTheNextSwipe() {
    val t = LockTrigger()
    t.onState(locked = false, onSurface = true)
    t.onState(locked = true, onSurface = true) // the limit reel was just counted
    assertFalse(t.mayShow(locked = true, onSurface = true))
    assertTrue(t.onSwipe())
    assertTrue(t.mayShow(locked = true, onSurface = true))
    assertFalse(t.onSwipe())
  }

  @Test fun arrivingWhileLockedShowsAtOnce() {
    val t = LockTrigger()
    t.onState(locked = true, onSurface = false)
    t.onSurfaceEntered()
    assertTrue(t.mayShow(locked = true, onSurface = true))
  }

  @Test fun leavingAndReturningReleasesTheWait() {
    val t = LockTrigger()
    t.onState(locked = false, onSurface = true)
    t.onState(locked = true, onSurface = true)
    t.onSurfaceEntered()
    assertTrue(t.mayShow(locked = true, onSurface = true))
  }

  @Test fun unlockingClearsTheWaitAndNothingShowsOffSurface() {
    val t = LockTrigger()
    t.onState(locked = false, onSurface = true)
    t.onState(locked = true, onSurface = true)
    t.onState(locked = false, onSurface = true)
    assertFalse(t.mayShow(locked = false, onSurface = true))
    assertFalse(t.mayShow(locked = true, onSurface = false))
  }

  @Test fun countsWhileAlreadyLockedDoNotRearmTheWait() {
    val t = LockTrigger()
    t.onState(locked = true, onSurface = false)
    t.onSurfaceEntered()
    t.onState(locked = true, onSurface = true) // total changed, still locked
    assertTrue(t.mayShow(locked = true, onSurface = true))
  }

  // --- text-input guard and multi-window ---

  @Test fun editableOrEditTextIsATextInput() {
    assertTrue(OverlayGuard.isTextInput(true, "android.view.View"))
    assertTrue(OverlayGuard.isTextInput(false, "android.widget.EditText"))
    assertTrue(OverlayGuard.isTextInput(false, "androidx.appcompat.widget.AppCompatEditText"))
    assertFalse(OverlayGuard.isTextInput(false, "android.widget.FrameLayout"))
    assertFalse(OverlayGuard.isTextInput(false, null))
  }

  @Test fun verdictOrder() {
    val d = OverlayGuard::decide
    assertEquals(OverlayGuard.Verdict.SHOW, d(true, true, false, false))
    assertEquals(OverlayGuard.Verdict.WAIT_TEXT_INPUT, d(true, true, true, false))
    assertEquals(OverlayGuard.Verdict.WAIT_TEXT_INPUT, d(true, true, true, true))
    assertEquals(OverlayGuard.Verdict.BACK_FALLBACK, d(true, true, false, true))
    assertEquals(OverlayGuard.Verdict.NOT_ACTIVE, d(false, true, false, false))
    assertEquals(OverlayGuard.Verdict.NOT_ACTIVE, d(true, false, false, false))
  }

  @Test fun splitScreenIsMultiWindow() {
    assertFalse(OverlayGuard.isMultiWindow(Box(0, 0, 1080, 2400), 1080, 2400))
    assertFalse(OverlayGuard.isMultiWindow(Box(0, 0, 1080, 2260), 1080, 2400)) // 3-button nav
    assertTrue(OverlayGuard.isMultiWindow(Box(0, 0, 1080, 1200), 1080, 2400))
    assertTrue(OverlayGuard.isMultiWindow(Box(0, 0, 540, 2400), 1080, 2400))
    assertFalse(OverlayGuard.isMultiWindow(null, 1080, 2400))
  }

  @Test fun coverBoxPrefersTheSurfaceThenTheAppWindow() {
    val screen = Box(0, 0, 1080, 2400)
    val feed = Box(0, 120, 1080, 2200)
    assertEquals(feed, OverlayGuard.coverBox(feed, screen, 1080, 2400))
    // A small surface (a player inside a page) falls back to the app window.
    assertEquals(screen, OverlayGuard.coverBox(Box(100, 300, 500, 600), screen, 1080, 2400))
    assertEquals(screen, OverlayGuard.coverBox(Box(100, 300, 500, 600), null, 1080, 2400))
    // Out-of-screen bounds are clamped.
    assertEquals(Box(0, 0, 1080, 2400), OverlayGuard.coverBox(Box(-10, -10, 1200, 2500), null, 1080, 2400))
  }

  // --- Leave reels: BACK, loop cooldown, HOME ---

  @Test fun backThatWorksEndsTheFlow() {
    val f = LeaveFlow()
    assertEquals(LeaveFlow.Action.BACK, f.press())
    assertTrue(f.busy)
    assertNull(f.backChecked(1_000, stillOnReels = false))
    assertFalse(f.busy)
    assertEquals(LeaveFlow.Action.BACK, f.press())
  }

  @Test fun backLoopWaitsThenGoesHome() {
    val f = LeaveFlow()
    assertEquals(LeaveFlow.Action.BACK, f.press())
    val end = f.backChecked(1_000, stillOnReels = true)
    assertEquals(1_000 + LeaveFlow.COOLDOWN_MS, end)
    assertNull(f.press()) // presses during the cooldown are ignored
    assertNull(f.cooldownElapsed(1_200, stillOnReels = true)) // too early
    assertEquals(LeaveFlow.Action.HOME, f.cooldownElapsed(end!!, stillOnReels = true))
    assertFalse(f.busy)
  }

  @Test fun noHomeWhenTheUserAlreadyLeftDuringTheCooldown() {
    val f = LeaveFlow()
    f.press()
    val end = f.backChecked(0, stillOnReels = true)!!
    assertNull(f.cooldownElapsed(end, stillOnReels = false))
    assertFalse(f.busy)
  }

  @Test fun doubleTapDuringTheBackCheckIsIgnored() {
    val f = LeaveFlow()
    assertEquals(LeaveFlow.Action.BACK, f.press())
    assertNull(f.press())
  }

  @Test fun resetAbortsAFlow() {
    val f = LeaveFlow()
    f.press()
    f.reset()
    assertFalse(f.busy)
    assertNull(f.backChecked(0, true))
  }

  // --- shared copy ---

  private fun strings(): Map<String, String> {
    val file = listOf("src/main/res/values/thumbwell_lock_strings.xml",
      "modules/thumbwell-core/android/src/main/res/values/thumbwell_lock_strings.xml")
      .map(::File).first { it.exists() }
    val xml = file.readText()
    val plain = Regex("""<string name="([a-z_]+)">(.*)</string>""").findAll(xml)
      .associate { it.groupValues[1] to it.groupValues[2] }
    val plurals = Regex("""<plurals name="([a-z_]+)">(.*?)</plurals>""", RegexOption.DOT_MATCHES_ALL)
      .findAll(xml).flatMap { block ->
        Regex("""<item quantity="([a-z]+)">(.*)</item>""").findAll(block.groupValues[2]).map {
          "${block.groupValues[1]}:${it.groupValues[1]}" to it.groupValues[2]
        }
      }.toMap()
    return (plain + plurals).mapValues { it.value.replace("\\'", "'") }
  }

  @Test fun overlayCopyIsTheSharedLockCopy() {
    val s = strings()
    assertEquals("That's %1\$d reel. Time for a break.", s["thumbwell_lock_title:one"])
    assertEquals("That's %1\$d reels. Time for a break.", s["thumbwell_lock_title:other"])
    assertEquals("Leave reels", s["thumbwell_lock_leave"])
    assertEquals("Daily limit reached", s["thumbwell_lock_chip"])
    assertEquals("Today: %1\$d reel", s["thumbwell_lock_today:one"])
    assertEquals("Today: %1\$d reels", s["thumbwell_lock_today:other"])
    assertEquals(
      "Reels, Shorts and TikTok are locked until %1\$s. DMs and the rest of each app still work.",
      s["thumbwell_lock_body"],
    )
  }

  @Test fun afterASafetyWindowTheLockOnlyReturnsOnANewSurfaceEntry() {
    // Lock appeared mid-play and waits for the swipe; the user opens Settings (hidden, surface
    // forgotten), comes back: arriving counts as a new entry, so it shows at once, not before.
    val trigger = LockTrigger()
    trigger.onState(locked = true, onSurface = true)
    assertFalse(trigger.mayShow(locked = true, onSurface = false))
    trigger.onSurfaceEntered()
    assertTrue(trigger.mayShow(locked = true, onSurface = true))
    assertFalse(trigger.mayShow(locked = true, onSurface = false))
  }
}
