package com.algoastics.brainling.core.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DetectionStateTest {
  @Test
  fun snapshotRoundTrips() {
    val snapshot = SessionSnapshot(7, 12, 1_000L, listOf("a", "b"))
    assertEquals(snapshot, SessionSnapshot.decode(snapshot.encode()))
    val noIndex = SessionSnapshot(1, null, 0L, emptyList())
    assertEquals(noIndex, SessionSnapshot.decode(noIndex.encode()))
  }

  @Test
  fun corruptSnapshotFallsBackToEmpty() {
    assertEquals(SessionSnapshot.EMPTY, SessionSnapshot.decode("{not json"))
    assertEquals(SessionSnapshot.EMPTY, SessionSnapshot.decode(null))
  }

  @Test
  fun restoredDedupeSurvivesARestart() {
    val before = ReelCounter(dwellMs = 800, dedupeSize = 20)
    before.observe("k", 0)
    assertEquals("k", before.observe("k", 800))
    val restored = SessionSnapshot.decode(SessionSnapshot(1, 0, 1L, before.recentKeys()).encode())
    val after = ReelCounter(dwellMs = 800, dedupeSize = 20, restoredKeys = restored.recentKeys)
    after.observe("k", 10_000)
    assertEquals(null, after.observe("k", 20_000))
  }

  @Test
  fun sessionContinuesOnlyWithinGap() {
    assertTrue(SessionPolicy.continues(lastSeenAtMs = 1_000, nowMs = 61_000, gapMs = 600_000))
    assertFalse(SessionPolicy.continues(lastSeenAtMs = 1_000, nowMs = 700_000, gapMs = 600_000))
    assertFalse(SessionPolicy.continues(lastSeenAtMs = 0, nowMs = 1, gapMs = 600_000))
    assertFalse(SessionPolicy.continues(lastSeenAtMs = 5_000, nowMs = 1_000, gapMs = 600_000))
  }

  @Test
  fun feedRestartDetection() {
    assertTrue(SessionPolicy.feedRestarted(rememberedIndex = 9, firstIndex = 0))
    assertFalse(SessionPolicy.feedRestarted(rememberedIndex = 9, firstIndex = 10))
    assertFalse(SessionPolicy.feedRestarted(rememberedIndex = 1, firstIndex = 0))
    assertFalse(SessionPolicy.feedRestarted(rememberedIndex = null, firstIndex = 0))
  }
}
