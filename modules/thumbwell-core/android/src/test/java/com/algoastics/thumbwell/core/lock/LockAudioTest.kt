package com.algoastics.thumbwell.core.lock

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LockAudioTest {
  private class FakePort : AudioPort {
    val calls = ArrayList<String>()
    override fun requestFocus(): Boolean { calls.add("focus"); return true }
    override fun abandonFocus() { calls.add("abandon") }
    override fun dispatchPause() { calls.add("pause") }
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
}
