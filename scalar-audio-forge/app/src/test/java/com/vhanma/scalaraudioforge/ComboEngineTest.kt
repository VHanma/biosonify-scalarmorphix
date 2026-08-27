package com.vhanma.scalaraudioforge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ComboEngineTest {
    @Test fun allUniquePairsAreCovered() {
        val n=TransformKind.entries.size
        assertEquals(n*(n-1)/2,ComboEngine.allPairs.size)
        assertEquals(136,ComboEngine.allPairs.size)
    }
    @Test fun everyPairHasUsefulPrediction() {
        ComboEngine.allPairs.forEach { report ->
            assertEquals(2,report.methods.size)
            assertTrue(report.summary.isNotBlank())
            assertTrue(report.why.isNotBlank())
            assertTrue(report.bestUse.isNotBlank())
            report.scores.values().forEach { assertTrue(it in 0..5) }
        }
    }
    @Test fun monoCenterAndStereoRecommendSideBySide() {
        val report=ComboEngine.pair(TransformKind.LONGITUDINAL_MONO,TransformKind.GATEWAY_STEREO)
        assertEquals(RecommendedRoute.SIDE_BY_SIDE,report.route)
        assertEquals(ConflictLevel.HIGH,report.conflict)
    }
    @Test fun informationAndChirpRecommendFullMerge() {
        val report=ComboEngine.pair(TransformKind.INFORMATION_CARRIER,TransformKind.CHIRP_SPREAD)
        assertEquals(RecommendedRoute.FULL_MERGE,report.route)
        assertEquals(5,report.scores.information)
    }
    @Test fun nWayStacksArePredictedDynamically() {
        val report=ComboEngine.analyze(listOf(TransformKind.PUHARICH_8,TransformKind.TESLA_HARMONICS,TransformKind.MEYL_VORTEX,TransformKind.INFORMATION_CARRIER))
        assertEquals(4,report.methods.size)
        assertTrue(report.summary.contains("carrier",true)||report.summary.contains("harmonic",true))
    }
}
