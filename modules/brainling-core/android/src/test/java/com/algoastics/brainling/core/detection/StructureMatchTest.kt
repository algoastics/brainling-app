package com.algoastics.brainling.core.detection

import com.algoastics.brainling.core.rules.StructureRule
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StructureMatchTest {
  private val pager = StructureRule(
    classNames = setOf("androidx.recyclerview.widget.RecyclerView"),
    minWidthFraction = 0.95f,
    minHeightFraction = 0.8f,
    requireScrollable = true,
    requireLongClickable = false,
    descendant = null,
  )

  private fun matches(className: String?, w: Int, h: Int, scrollable: Boolean = true) =
    StructureMatch.matches(pager, className, w, h, 1080, 2400, scrollable, longClickable = false)

  @Test
  fun fullScreenScrollablePagerMatches() {
    assertTrue(matches("androidx.recyclerview.widget.RecyclerView", 1080, 2100))
  }

  @Test
  fun wrongClassSmallOrStaticNodesDoNotMatch() {
    assertFalse(matches("android.widget.FrameLayout", 1080, 2400))
    assertFalse(matches("androidx.recyclerview.widget.RecyclerView", 1080, 900))
    assertFalse(matches("androidx.recyclerview.widget.RecyclerView", 1080, 2400, scrollable = false))
    assertFalse(matches(null, 1080, 2400))
    assertFalse(matches("androidx.recyclerview.widget.RecyclerView", 0, 0))
  }
}
