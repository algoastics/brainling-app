package com.algoastics.thumbwell.core.lock

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertNull
import org.junit.Test

class LockAudioTest {
  private class FakePort : AudioPort {
    val calls = ArrayList<String>()
    override fun requestFocus(): Boolean { calls.add("focus"); return true }
    override fun abandonFocus() { calls.add("abandon") }
    override fun dispatchPause() { calls.add("pause") }
    var active = false
    var muted = false
    var volume = 9
    override fun isMusicActive() = active
    override fun isMusicMuted() = muted
    override fun musicVolume() = volume
    override fun muteMusic() { calls.add("mute"); muted = true }
    override fun unmuteMusic() { calls.add("unmute"); muted = false }
    override fun setMusicVolume(index: Int) { calls.add("set$index"); volume = index }
  }

  private class FakeStore(var saved: Int? = null) : MuteStore {
    override fun save(volume: Int) { saved = volume }
    override fun clear() { saved = null }
    override fun pending() = saved
  }

  @Test fun engageTakesFocusAndPausesOnce() {
    val port = FakePort()
    val audio = LockAudio(port)
    audio.engage()
    audio.engage()
    audio.engage()
    assertEquals(listOf("focus", "pause"), port.calls)
    assertTrue(audio.isEngaged)
  }

  @Test fun releaseAbandonsOnceAndNeverWithoutEngage() {
    val port = FakePort()
    val audio = LockAudio(port)
    audio.release()
    assertTrue(port.calls.isEmpty())
    audio.engage()
    audio.release()
    audio.release()
    assertEquals(listOf("focus", "pause", "abandon"), port.calls)
    assertFalse(audio.isEngaged)
  }

  @Test fun anotherLockCycleWorksAgainAndDoesNotLeak() {
    val port = FakePort()
    val audio = LockAudio(port)
    repeat(3) { audio.engage(); audio.release() }
    assertEquals(3, port.calls.count { it == "focus" })
    assertEquals(3, port.calls.count { it == "abandon" })
  }

  @Test fun pauseAgainOnlyWhileEngaged() {
    val port = FakePort()
    val audio = LockAudio(port)
    audio.pauseAgain()
    assertTrue(port.calls.isEmpty())
    audio.engage()
    audio.pauseAgain()
    audio.release()
    audio.pauseAgain()
    assertEquals(listOf("focus", "pause", "pause", "abandon"), port.calls)
  }

  // --- layer 3: mute with exact restore ---

  @Test fun verifyMutesOnlyWhileSoundIsStillPlaying() {
    val port = FakePort()
    val store = FakeStore()
    val audio = LockAudio(port, MuteGuard(port, store))
    assertFalse(audio.verify()) // not engaged
    audio.engage()
    port.active = false // the pause or media key worked
    assertFalse(audio.verify())
    assertFalse(audio.isMuting)
    port.active = true
    assertTrue(audio.verify())
    assertTrue(port.muted)
    assertEquals(9, store.saved)
    assertFalse(audio.verify()) // already ours
  }

  @Test fun releaseRestoresTheExactVolumeAndClearsTheRecord() {
    val port = FakePort()
    val store = FakeStore()
    val audio = LockAudio(port, MuteGuard(port, store))
    audio.engage()
    port.active = true
    audio.verify()
    audio.release()
    audio.release()
    assertFalse(port.muted)
    assertEquals(9, port.volume)
    assertNull(store.saved)
    assertEquals(1, port.calls.count { it == "unmute" })
  }

  @Test fun aVolumeTheSystemDidNotRestoreIsSetBack() {
    val port = FakePort()
    val guard = MuteGuard(port, FakeStore())
    assertTrue(guard.engage())
    port.volume = 0 // some devices report 0 after unmute
    guard.release()
    assertEquals(9, port.volume)
    assertTrue(port.calls.contains("set9"))
  }

  @Test fun anAlreadySilentStreamIsNeverMutedOrUnmuted() {
    val muted = FakePort().apply { muted = true }
    val g1 = MuteGuard(muted, FakeStore())
    assertFalse(g1.engage())
    g1.release()
    assertTrue(muted.muted) // the user's own mute stays
    assertFalse(muted.calls.contains("unmute"))
    val zero = FakePort().apply { volume = 0 }
    val g2 = MuteGuard(zero, FakeStore())
    assertFalse(g2.engage())
    assertTrue(zero.calls.isEmpty())
  }

  @Test fun recoverUndoesAMuteLeftByACrash() {
    val port = FakePort().apply { muted = true; volume = 0 }
    val store = FakeStore(saved = 7)
    val audio = LockAudio(port, MuteGuard(port, store))
    audio.recover()
    assertFalse(port.muted)
    assertEquals(7, port.volume)
    assertNull(store.saved)
    audio.recover() // nothing pending any more: no second change
    assertEquals(1, port.calls.count { it == "unmute" })
  }

  @Test fun recoverWithNothingPendingTouchesNothing() {
    val port = FakePort()
    LockAudio(port, MuteGuard(port, FakeStore())).recover()
    assertTrue(port.calls.isEmpty())
  }

  @Test fun theMuteIsReleasedEvenWhenFocusWasNeverTaken() {
    val port = FakePort()
    val guard = MuteGuard(port, FakeStore())
    val audio = LockAudio(port, guard)
    guard.engage()
    audio.release()
    assertFalse(port.muted)
    assertFalse(guard.isMuting)
  }

  // --- layer 1: pause or mute control state ---

  @Test fun onlyAPlayingControlIsClicked() {
    assertEquals(PauseControl.State.PLAYING, PauseControl.stateOf("Pause"))
    assertEquals(PauseControl.State.PLAYING, PauseControl.stateOf("  MUTE video "))
    assertEquals(PauseControl.State.PAUSED, PauseControl.stateOf("Play"))
    assertEquals(PauseControl.State.PAUSED, PauseControl.stateOf("Unmute"))
    assertEquals(PauseControl.State.UNKNOWN, PauseControl.stateOf("Pause the music for later")) // not exact
    assertEquals(PauseControl.State.UNKNOWN, PauseControl.stateOf(null))
    assertTrue(PauseControl.shouldClick(PauseControl.State.PLAYING))
    assertFalse(PauseControl.shouldClick(PauseControl.State.PAUSED))
    assertFalse(PauseControl.shouldClick(PauseControl.State.UNKNOWN))
  }

  @Test fun aControlIsOnlyClickedBackWhenWeClickedItAndItReadsPaused() {
    assertTrue(PauseControl.shouldRestore(true, PauseControl.State.PAUSED))
    assertFalse(PauseControl.shouldRestore(false, PauseControl.State.PAUSED))
    assertFalse(PauseControl.shouldRestore(true, PauseControl.State.PLAYING))
    assertFalse(PauseControl.shouldRestore(true, PauseControl.State.UNKNOWN))
  }

  @Test fun theSameControlKeepsItsPositionWhenTheLabelChanges() {
    val was = Box(400, 900, 680, 1180)
    assertTrue(PauseControl.sameControl(was, Box(410, 910, 670, 1170)))
    assertFalse(PauseControl.sameControl(was, Box(0, 2000, 200, 2100)))
  }

  @Test fun everyPlayingLabelHasAPausedCounterpartNotInTheSameSet() {
    assertTrue(PauseControl.PLAYING_LABELS.intersect(PauseControl.PAUSED_LABELS).isEmpty())
    PauseControl.PLAYING_LABELS.forEach { label ->
      assertTrue(PauseControl.SEARCH_KEYS.any { label.contains(it.lowercase()) })
    }
  }
}
