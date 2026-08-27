package com.vhanma.scalaraudioforge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LabModulesTest {
    @Test fun modulesAreDistinctAndComplete() {
        assertEquals(9, LabModules.modules.size)
        assertEquals(LabModules.modules.size, LabModules.modules.map { it.title }.distinct().size)
        val prefixes = LabModules.modules.flatMap { it.sectionPrefixes }
        assertEquals(prefixes.size, prefixes.distinct().size)
    }

    @Test fun everyCurrentSectionMapsToAModule() {
        val headings = listOf(
            "SOURCE",
            "QUICK COMBOS • FULL METHODS",
            "WAVE LIBRARY • MINI VISUAL + INFO",
            "WORKING FULL-METHOD CHAIN",
            "MATRIX LAB • FULL COPIES",
            "COMBINATION ATLAS • ALL 136 PAIRS + ANY N-WAY STACK",
            "PRESET DNA • REPRODUCIBLE RECIPE",
            "ANALYZER • ORIGINAL / PROCESSED / DIFFERENCE",
            "EXPORT ENGINE",
            "EXPERIMENT NOTEBOOK",
            "INSTALL / HELP"
        )
        headings.forEach { heading ->
            assertNotNull("Unmapped section: $heading", LabModules.moduleForSection(heading))
            assertTrue(LabModules.isSectionHeading(heading))
        }
    }
}
