package com.algoastics.thumbwell.core.lock

/**
 * Where the lock covers (LOCK-A). Pure, no android types. The lock covers the reels container
 * edge to edge like the reels, and never the bottom tab bar or the system navigation bar, so the
 * user can always tap another tab.
 *
 * Order of preference for the base area: the reels container bounds from the accessibility tree
 * ([Source.SURFACE]), else the app window ([Source.APP]), else the whole screen ([Source.SCREEN]).
 * The navigation bar is left out of the whole-screen fallback (tree bounds end above it already). The tab bar is left out when its bounds are known; with a
 * fallback base (no usable container) and no known tab bar, a default tab bar height is taken off.
 */
object LockBounds {
  enum class Source { SURFACE, APP, SCREEN }

  data class Result(val box: Box, val source: Source)

  /** Typical bottom tab bar height, used only when the base is a fallback and no bar was found. */
  const val DEFAULT_TAB_BAR_DP = 56

  /** A container narrower or shorter than this share of the screen is not "the reels area". */
  private const val MIN_SURFACE_WIDTH_PCT = 80
  private const val MIN_SURFACE_HEIGHT_PCT = 40

  /** After all cuts the lock must keep at least this share of the screen height, else no tab cut. */
  private const val MIN_RESULT_HEIGHT_PCT = 25

  fun select(
    surface: Box?,
    tabBar: Box?,
    app: Box?,
    screenW: Int,
    screenH: Int,
    navBarPx: Int,
    density: Float,
  ): Result {
    val s = surface?.clampTo(screenW, screenH)
    val usable = s != null &&
      s.width >= screenW * MIN_SURFACE_WIDTH_PCT / 100 &&
      s.height >= screenH * MIN_SURFACE_HEIGHT_PCT / 100
    val a = app?.clampTo(screenW, screenH)?.takeIf { it.width > 0 && it.height > 0 }
    val (base, source) = when {
      usable -> s!! to Source.SURFACE
      a != null -> a to Source.APP
      else -> Box(0, 0, screenW, screenH) to Source.SCREEN
    }
    // The tree's bounds (container, app window) already end at the navigation bar; only the whole
    // screen fallback has to leave it out.
    val aboveNav = if (source == Source.SCREEN) {
      base.copy(bottom = minOf(base.bottom, screenH - navBarPx.coerceAtLeast(0)))
    } else {
      base
    }
    val bar = tabBar?.clampTo(screenW, screenH)
    val cutAt = when {
      bar != null && isBottomBar(bar, aboveNav, screenW) -> bar.top
      source != Source.SURFACE -> aboveNav.bottom - (DEFAULT_TAB_BAR_DP * density + 0.5f).toInt()
      else -> aboveNav.bottom
    }
    val cut = aboveNav.copy(bottom = minOf(aboveNav.bottom, cutAt))
    val minHeight = screenH * MIN_RESULT_HEIGHT_PCT / 100
    val box = if (cut.height >= minHeight || aboveNav.height < minHeight) cut else aboveNav
    return Result(box, source)
  }

  /** A wide bar in the lower half of the base area: the bottom tab bar, not some inner row. */
  fun isBottomBar(bar: Box, base: Box, screenW: Int): Boolean =
    bar.height > 0 &&
      bar.width >= screenW / 2 &&
      bar.top >= base.top + base.height / 2 &&
      bar.top < base.bottom

  /**
   * Structural test for a bottom tab bar when no id is known (TikTok): a wide, low, short row with
   * several clickable children, in the bottom fifth of the screen. Bounds, counts and flags only.
   */
  fun looksLikeTabBar(box: Box, clickableChildren: Int, screenW: Int, screenH: Int, density: Float): Boolean {
    val minH = (40 * density).toInt()
    val maxH = (110 * density).toInt()
    return clickableChildren >= 3 &&
      box.width >= screenW * 9 / 10 &&
      box.height in minH..maxH &&
      box.top >= screenH * 7 / 10
  }
}

/** Which tab "Leave reels" taps to get out of the reels tab inside the app (LOCK-B). Pure. */
object HomeTab {
  /**
   * [homeIds] are view ids (no package prefix) of the Home tab itself; [barIds] are view ids of the
   * tab bar whose [homeIndex]-th item is Home when no id is given. These live in code, not in the
   * signed rules file, so the rules signature is untouched; moving them into the rules would need a
   * schema bump and a re-sign.
   */
  data class Spec(val homeIds: List<String>, val barIds: List<String>, val homeIndex: Int)

  private val SPECS: Map<String, Spec> = mapOf(
    // Instagram: tab_bar holds feed_tab (Home), search_tab, creation_tab, clips_tab, profile_tab.
    "instagram" to Spec(listOf("feed_tab"), listOf("tab_bar"), 0),
    // YouTube: the pivot bar has no ids on its items; Home is the first item (Shorts is second).
    "youtube" to Spec(emptyList(), listOf("pivot_bar"), 0),
  )

  /** Null for apps with no Home tab to go to (TikTok: the reels are Home). */
  fun specFor(ruleKey: String): Spec? = SPECS[ruleKey]

  /** One item of a tab bar: its position among the siblings, left edge and whether it can be clicked. */
  data class Item(val index: Int, val left: Int, val clickable: Boolean)

  /**
   * The Home item: the [homeIndex]-th from the start edge (leftmost, or rightmost when [rtl]).
   * A row with fewer than 3 items is not a tab bar, and null is returned so the caller falls back.
   */
  fun chooseByIndex(items: List<Item>, homeIndex: Int, rtl: Boolean): Item? {
    if (items.size < 3) return null
    val ordered = if (rtl) items.sortedByDescending { it.left } else items.sortedBy { it.left }
    return ordered.getOrNull(homeIndex)
  }
}
