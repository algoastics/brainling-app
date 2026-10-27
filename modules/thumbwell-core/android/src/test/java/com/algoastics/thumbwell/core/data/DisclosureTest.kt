package com.algoastics.thumbwell.core.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DisclosureTest {
  @Test fun currentVersionIsTwo() = assertEquals("2", Disclosure.CURRENT_VERSION)

  @Test fun versionOneConsentIsNotAccepted() = assertFalse(Disclosure.accepts("1"))

  @Test fun versionTwoConsentIsAccepted() = assertTrue(Disclosure.accepts("2"))

  @Test fun missingOrOtherConsentIsNotAccepted() {
    assertFalse(Disclosure.accepts(null))
    assertFalse(Disclosure.accepts(""))
    assertFalse(Disclosure.accepts("3"))
  }
}
