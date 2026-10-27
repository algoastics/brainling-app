package com.algoastics.thumbwell.core.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppIconsTest {
  @Test
  fun onlySupportedPackagesCanBeAskedFor() {
    assertTrue(AppIcons.allowed("com.instagram.android"))
    assertTrue(AppIcons.allowed("com.google.android.youtube"))
    assertTrue(AppIcons.allowed("com.zhiliaoapp.musically"))
    assertTrue(AppIcons.allowed("com.ss.android.ugc.trill"))
    assertFalse(AppIcons.allowed("com.whatsapp"))
    assertFalse(AppIcons.allowed("com.facebook.katana"))
    assertFalse(AppIcons.allowed(""))
  }

  @Test
  fun sizeIsClamped() {
    assertEquals(AppIcons.MIN_SIZE_PX, AppIcons.clampSize(1))
    assertEquals(96, AppIcons.clampSize(96))
    assertEquals(AppIcons.MAX_SIZE_PX, AppIcons.clampSize(100_000))
  }
}
