package com.algoastics.thumbwell.core.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DisclosureTest {
  @Test fun currentVersionIsThree() = assertEquals("3", Disclosure.CURRENT_VERSION)

  @Test fun olderConsentIsNotAccepted() {
    assertFalse(Disclosure.accepts("1"))
    assertFalse(Disclosure.accepts("2"))
  }

  @Test fun versionThreeConsentIsAccepted() = assertTrue(Disclosure.accepts("3"))

  @Test fun missingOrOtherConsentIsNotAccepted() {
    assertFalse(Disclosure.accepts(null))
    assertFalse(Disclosure.accepts(""))
    assertFalse(Disclosure.accepts("4"))
  }
}
