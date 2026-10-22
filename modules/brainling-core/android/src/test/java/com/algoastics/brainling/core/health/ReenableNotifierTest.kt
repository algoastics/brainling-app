package com.algoastics.brainling.core.health

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReenableNotifierTest {
  @Test
  fun remindsOnlyWhenARunningServiceGetsDisabled() {
    assertTrue(ReenableNotifier.shouldNotify("ok", "disabled"))
    assertTrue(ReenableNotifier.shouldNotify("not_running", "disabled"))
    assertFalse(ReenableNotifier.shouldNotify(null, "disabled"))
    assertFalse(ReenableNotifier.shouldNotify("disabled", "disabled"))
    assertFalse(ReenableNotifier.shouldNotify("ok", "not_running"))
  }
}
