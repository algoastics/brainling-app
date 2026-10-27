package com.algoastics.thumbwell.core.detection

import java.io.File

/**
 * Layout captures from the debug screen's "capture layout" (view id, class, bounds, flags; no
 * text or content descriptions). Two-space indentation encodes depth.
 */
class LayoutFixture(val packageName: String, val nodes: List<Node>) {
  data class Bounds(val left: Int, val top: Int, val right: Int, val bottom: Int) {
    val width get() = right - left
    val height get() = bottom - top
  }

  data class Node(
    val index: Int,
    val depth: Int,
    val parent: Int?,
    val className: String,
    val viewId: String?,
    val bounds: Bounds,
    val visible: Boolean,
    val scrollable: Boolean,
  ) {
    val bareId: String? get() = viewId?.substringAfter(":id/", "")?.takeIf { it.isNotEmpty() }
  }

  fun withBareId(id: String) = nodes.filter { it.bareId == id }

  fun isAncestor(ancestor: Node, node: Node): Boolean {
    var cursor = node.parent
    while (cursor != null) {
      if (cursor == ancestor.index) return true
      cursor = nodes[cursor].parent
    }
    return false
  }

  /** The direct child of [ancestor] on the path to [node]. */
  fun childToward(ancestor: Node, node: Node): Node? {
    var current = node
    while (current.parent != null) {
      if (current.parent == ancestor.index) return current
      current = nodes[current.parent!!]
    }
    return null
  }

  companion object {
    private val LINE = Regex("""^( *)(\S+) id=(\S+) bounds=\[(-?\d+),(-?\d+)]\[(-?\d+),(-?\d+)](.*)$""")

    fun load(name: String): LayoutFixture {
      val url = requireNotNull(LayoutFixture::class.java.classLoader?.getResource("layouts/$name")) {
        "missing fixture $name"
      }
      val lines = File(url.toURI()).readLines().filter { it.isNotBlank() }
      val header = lines.first()
      require(header.startsWith("# ")) { "missing package header" }
      val stack = ArrayList<Int>()
      val nodes = ArrayList<Node>()
      for (line in lines.drop(1)) {
        val m = requireNotNull(LINE.matchEntire(line)) { "bad line: $line" }
        val depth = m.groupValues[1].length / 2
        while (stack.size > depth) stack.removeAt(stack.size - 1)
        val flags = m.groupValues[8].trim().split(' ').toSet()
        val node = Node(
          index = nodes.size,
          depth = depth,
          parent = stack.lastOrNull(),
          className = m.groupValues[2],
          viewId = m.groupValues[3].takeIf { it != "-" },
          bounds = Bounds(
            m.groupValues[4].toInt(), m.groupValues[5].toInt(),
            m.groupValues[6].toInt(), m.groupValues[7].toInt(),
          ),
          visible = "visible" in flags,
          scrollable = "scrollable" in flags,
        )
        nodes += node
        stack += node.index
      }
      return LayoutFixture(header.removePrefix("# ").substringBefore(' '), nodes)
    }
  }
}
