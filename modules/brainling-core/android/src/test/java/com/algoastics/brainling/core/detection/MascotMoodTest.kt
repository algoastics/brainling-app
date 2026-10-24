package com.algoastics.brainling.core.detection

import org.junit.Assert.assertEquals
import org.junit.Test

class MascotMoodTest {
  @Test
  fun thresholdsMatchTestingScale() {
    assertEquals(MascotMood.GLOWING, MascotMoods.forCount(0))
    assertEquals(MascotMood.GLOWING, MascotMoods.forCount(9))
    assertEquals(MascotMood.HAPPY, MascotMoods.forCount(10))
    assertEquals(MascotMood.HAPPY, MascotMoods.forCount(29))
    assertEquals(MascotMood.MEH, MascotMoods.forCount(30))
    assertEquals(MascotMood.MEH, MascotMoods.forCount(44))
    assertEquals(MascotMood.FRIED, MascotMoods.forCount(45))
    assertEquals(MascotMood.FRIED, MascotMoods.forCount(69))
    assertEquals(MascotMood.ZOMBIE, MascotMoods.forCount(70))
    assertEquals(MascotMood.ZOMBIE, MascotMoods.forCount(1000))
  }

  @Test
  fun negativeCountIsGlowing() {
    assertEquals(MascotMood.GLOWING, MascotMoods.forCount(-1))
  }
}
