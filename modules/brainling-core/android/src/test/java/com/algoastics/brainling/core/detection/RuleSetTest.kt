package com.algoastics.brainling.core.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File

class RuleSetTest {
  private val bundled = RuleSet.parse(File("src/main/assets/${RuleSet.ASSET_PATH}").readText())

  @Test
  fun bundledRulesCoverInstagramAndYoutubeOnly() {
    assertEquals(setOf("com.instagram.android", "com.google.android.youtube"), bundled.enabledPackages)
    assertEquals(800L, bundled.dwellMs)
    assertEquals(20, bundled.dedupeSize)
  }

  @Test
  fun disabledAppsAreIgnored() {
    val rules = RuleSet.parse(
      """{"version":1,"dwellMs":800,"dedupeSize":20,"apps":[
        {"packageName":"com.zhiliaoapp.musically","key":"tiktok","enabled":false,"surfaceIds":["x"]}]}""",
    )
    assertNull(rules.ruleFor("com.zhiliaoapp.musically"))
  }

  @Test(expected = IllegalArgumentException::class)
  fun rejectsNonPositiveDwell() {
    RuleSet.parse("""{"version":1,"dwellMs":0,"dedupeSize":20,"apps":[]}""")
  }
}
