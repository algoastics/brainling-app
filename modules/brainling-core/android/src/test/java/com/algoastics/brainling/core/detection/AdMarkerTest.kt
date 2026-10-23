package com.algoastics.brainling.core.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AdMarkerTest {
  /** Fake view tree: text/contentDescription plus children. */
  private class N(val text: String? = null, val desc: String? = null, vararg val kids: N)

  private fun ad(root: N, labels: List<String>) =
    AdMarker.containsAd(root, labels, { it.kids.toList() }, { listOf(it.text, it.desc) })

  private val ig = AdMarker.labelsFor("instagram", emptyList())
  private val fb = AdMarker.labelsFor("facebook", emptyList())
  private val tiktok = AdMarker.labelsFor("tiktok", emptyList())

  private fun reel(vararg overlay: N) =
    N(null, null, N(desc = "Video player"), N(null, null, N("brand.official"), *overlay), N(desc = "Like"))

  @Test
  fun instagramSponsoredReelIsAnAd() {
    assertTrue(ad(reel(N("Sponsored")), ig))
  }

  @Test
  fun facebookSponsoredLabelWithSeparatorIsAnAd() {
    assertTrue(ad(reel(N(desc = "Sponsored · Shop now")), fb))
    assertTrue(ad(reel(N("SPONSORED")), fb))
  }

  @Test
  fun tiktokAdTokenIsAnAd() {
    assertTrue(ad(reel(N("Ad")), tiktok))
    assertFalse(ad(reel(N("Add comment..."), N("Adidas")), tiktok))
  }

  @Test
  fun captionContainingSponsoredIsNotAnAd() {
    assertFalse(ad(reel(N("Not sponsored, I just love this café ☕")), ig))
    assertFalse(ad(reel(N("Sponsored by nobody lol this trip was all me")), ig))
  }

  @Test
  fun paidPartnershipIsCreatorContent() {
    assertFalse(ad(reel(N("Paid partnership"), N("Paid partnership with brand.official")), ig))
  }

  @Test
  fun rulesLabelsOverrideDefaultsAndAreCaseInsensitive() {
    assertEquals(listOf("Gesponsert"), AdMarker.labelsFor("instagram", listOf("Gesponsert")))
    assertTrue(ad(reel(N("gesponsert")), listOf("Gesponsert")))
    assertFalse(ad(reel(N("Sponsored")), emptyList()))
  }
}
