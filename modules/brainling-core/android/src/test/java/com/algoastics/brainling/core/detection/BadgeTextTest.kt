package com.algoastics.brainling.core.detection

import org.junit.Assert.assertEquals
import org.junit.Test

class BadgeTextTest {
  @Test
  fun labelsEveryTargetApp() {
    assertEquals("YouTube Shorts · 7", BadgeText.format("youtube", 7))
    assertEquals("Instagram Reels · 0", BadgeText.format("instagram", 0))
    assertEquals("TikTok · 3", BadgeText.format("tiktok", 3))
    assertEquals("Facebook Reels · 1", BadgeText.format("facebook", 1))
    assertEquals("Snapchat Spotlight · 2", BadgeText.format("snapchat", 2))
  }
}
