package com.algoastics.brainling.core.rules

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class RuleSetTest {
  private val sourceText = File("../rules/rules.json").readText()
  private val source = RuleSet.parse(sourceText)

  private fun withApps(apps: String, schema: Int = RuleSet.SCHEMA) = """
    {"schema":$schema,"version":1,"issuedAt":"2026-10-21T00:00:00Z","expiresAt":"2027-10-21T00:00:00Z",
     "dwellMs":800,"dedupeSize":20,"sessionGapMs":600000,"surfaceRetryDelaysMs":[150],"apps":[$apps]}
  """.trimIndent()

  @Test
  fun sourceRulesEnableAllFiveAppFamilies() {
    val enabledKeys = source.apps.filter { it.enabled }.map { it.key }.toSet()
    assertEquals(
      setOf("instagram", "youtube", "tiktok", "tiktok_lite", "facebook", "facebook_lite", "snapchat"),
      enabledKeys,
    )
    assertEquals(800L, source.dwellMs)
    assertEquals(20, source.dedupeSize)
  }

  @Test
  fun variantsMapToTheirFamily() {
    assertEquals("youtube", source.ruleFor("app.revanced.android.youtube")?.key)
    assertEquals("youtube", source.ruleFor("com.google.android.apps.youtube.kids")?.key)
    assertEquals("tiktok", source.ruleFor("com.ss.android.ugc.trill")?.key)
    assertEquals("tiktok", source.ruleFor("com.ss.android.ugc.aweme")?.key)
    assertEquals(listOf("simplayer_api_player_view"), source.ruleFor("com.zhiliaoapp.musically.go")?.surfaceIds)
    assertEquals(listOf("video_view"), source.ruleFor("com.facebook.lite")?.surfaceIds)
    assertEquals(listOf("spotlight_container"), source.ruleFor("com.snapchat.android")?.surfaceIds)
    assertNull(source.ruleFor("com.whatsapp"))
  }

  @Test
  fun instagramExcludesDmReelsAndFacebookHasFallbacks() {
    val instagram = requireNotNull(source.ruleFor("com.instagram.android"))
    assertEquals(listOf("clips_viewer_view_pager"), instagram.surfaceIds)
    assertEquals(
      listOf("sender_username_or_fullname", "sender_timestamp", "reply_bar_edittext"),
      instagram.dmSignatureIds,
    )
    val facebook = requireNotNull(source.ruleFor("com.facebook.katana"))
    assertEquals(2, facebook.contentDescriptions.size)
    assertNotNull(facebook.structure?.descendant)
  }

  @Test
  fun disabledAppsAreIgnored() {
    val rules = RuleSet.parse(
      withApps("""{"key":"tiktok","packageNames":["com.zhiliaoapp.musically"],"enabled":false}"""),
    )
    assertNull(rules.ruleFor("com.zhiliaoapp.musically"))
    assertTrue(rules.enabledPackages.isEmpty())
  }

  @Test(expected = IllegalArgumentException::class)
  fun rejectsOtherSchema() {
    RuleSet.parse(withApps("", schema = 1))
  }

  @Test(expected = IllegalArgumentException::class)
  fun rejectsEnabledAppWithoutSignal() {
    RuleSet.parse(withApps("""{"key":"snapchat","packageNames":["com.snapchat.android"],"enabled":true}"""))
  }

  @Test(expected = IllegalArgumentException::class)
  fun rejectsMalformedViewId() {
    RuleSet.parse(
      withApps("""{"key":"a","packageNames":["com.a.b"],"enabled":true,"surfaceIds":["x/../y"]}"""),
    )
  }

  @Test(expected = IllegalArgumentException::class)
  fun rejectsPackageInTwoApps() {
    RuleSet.parse(
      withApps(
        """{"key":"a","packageNames":["com.a.b"],"enabled":true,"surfaceIds":["x"]},
           {"key":"b","packageNames":["com.a.b"],"enabled":true,"surfaceIds":["y"]}""",
      ),
    )
  }

  @Test(expected = IllegalArgumentException::class)
  fun rejectsNonPositiveDwell() {
    RuleSet.parse(JSONObject(withApps("")).put("dwellMs", 0).toString())
  }

  @Test(expected = IllegalArgumentException::class)
  fun rejectsTooDeepStructure() {
    val leaf = """{"classNames":["a.B"]}"""
    var nested = leaf
    repeat(4) { nested = """{"classNames":["a.B"],"descendant":$nested}""" }
    RuleSet.parse(
      withApps("""{"key":"a","packageNames":["com.a.b"],"enabled":true,"structure":$nested}"""),
    )
  }

  @Test
  fun countingDiffersOnlyOnTimingChanges() {
    val same = RuleSet.parse(JSONObject(sourceText).put("version", 99).toString())
    val slower = RuleSet.parse(JSONObject(sourceText).put("dwellMs", 1200).toString())
    assertEquals(false, source.countingDiffers(same))
    assertEquals(true, source.countingDiffers(slower))
  }
}
