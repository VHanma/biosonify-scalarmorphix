package com.vhanma.scalaraudioforge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.sin

class MatrixEngineTest {
    private val sampleRate = 48_000

    private fun monoTone(frames: Int = 4096): FloatArray = FloatArray(frames) { i ->
        (0.4 * sin(2.0 * PI * 440.0 * i / sampleRate)).toFloat()
    }

    private fun stereoTone(frames: Int = 4096): FloatArray = FloatArray(frames * 2) { i ->
        val frame = i / 2
        val hz = if (i % 2 == 0) 440.0 else 660.0
        (0.35 * sin(2.0 * PI * hz * frame / sampleRate)).toFloat()
    }

    @Test
    fun everyTransformProducesFiniteBoundedAudio() {
        val input = stereoTone()
        for (kind in TransformKind.entries) {
            val output = DspEngine.process(input, 2, sampleRate, 0L, listOf(TransformSpec(kind)))
            assertEquals("Length changed for $kind", input.size, output.size)
            assertFalse("NaN/Inf produced by $kind", output.any { !it.isFinite() })
            assertTrue("Out-of-range sample produced by $kind", output.all { it in -1f..1f })
        }
    }

    @Test
    fun fullMergeKeepsOriginalOnlyOnceAndStaysBounded() {
        val input = stereoTone()
        val matrix = ForgeMatrix(
            enabled = true,
            mode = MergeMode.FULL_MERGE,
            branches = listOf(
                ForgeBranch("A", listOf(TransformSpec(TransformKind.PUHARICH_8))),
                ForgeBranch("B", listOf(TransformSpec(TransformKind.CONTROL_256))),
                ForgeBranch("C", listOf(TransformSpec(TransformKind.TESLA_HARMONICS)))
            )
        )
        val output = MatrixEngine.process(input, 2, sampleRate, 0L, matrix)
        assertEquals(input.size, output.size)
        assertFalse(output.any { !it.isFinite() })
        assertTrue(output.all { it in -1f..1f })
        assertTrue(output.indices.any { kotlin.math.abs(output[it] - input[it]) > 1e-5f })
    }

    @Test
    fun sideBySideExpandsMonoToStereo() {
        val input = monoTone()
        val matrix = ForgeMatrix(
            enabled = true,
            mode = MergeMode.STEREO_SIDE_BY_SIDE,
            branches = listOf(
                ForgeBranch("Left", listOf(TransformSpec(TransformKind.PUHARICH_8))),
                ForgeBranch("Right", listOf(TransformSpec(TransformKind.INFORMATION_CARRIER)))
            )
        )
        assertEquals(2, MatrixEngine.outputChannels(1, matrix))
        val output = MatrixEngine.process(input, 1, sampleRate, 0L, matrix)
        assertEquals(input.size * 2, output.size)
        assertFalse(output.any { !it.isFinite() })
        assertTrue(output.all { it in -1f..1f })
    }

    @Test
    fun sideBySideActuallySeparatesTwoMethods() {
        val input = monoTone()
        val matrix = ForgeMatrix(
            enabled = true,
            mode = MergeMode.STEREO_SIDE_BY_SIDE,
            branches = listOf(
                ForgeBranch("Left", listOf(TransformSpec(TransformKind.PUHARICH_8))),
                ForgeBranch("Right", listOf(TransformSpec(TransformKind.CONTROL_256)))
            )
        )
        val output = MatrixEngine.process(input, 1, sampleRate, 0L, matrix)
        var different = false
        for (frame in input.indices) {
            if (kotlin.math.abs(output[frame * 2] - output[frame * 2 + 1]) > 1e-5f) {
                different = true
                break
            }
        }
        assertTrue("Stereo sides should contain independently processed copies", different)
    }
}
