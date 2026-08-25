package com.vhanma.scalaraudioforge

import kotlin.math.abs

object MatrixEngine {
    fun process(
        input: FloatArray,
        channels: Int,
        sampleRate: Int,
        frameStart: Long,
        matrix: ForgeMatrix
    ): FloatArray {
        if (!matrix.enabled || matrix.branches.isEmpty()) {
            return DspEngine.process(input, channels, sampleRate, frameStart, matrix.master)
        }

        val active = matrix.branches.filter { it.transforms.isNotEmpty() }
        if (active.isEmpty()) {
            return DspEngine.process(input, channels, sampleRate, frameStart, matrix.master)
        }

        val branchAudio = active.map {
            DspEngine.process(input, channels, sampleRate, frameStart, it.transforms)
        }
        val merged = FloatArray(input.size)

        when (matrix.mode) {
            MergeMode.NORMALIZED_WEIGHTED -> {
                val denominator = active.sumOf { abs(it.weight.coerceIn(-4f, 4f)).toDouble() }
                    .toFloat().coerceAtLeast(0.0001f)
                for (b in branchAudio.indices) {
                    val gain = active[b].weight.coerceIn(-4f, 4f) / denominator
                    val audio = branchAudio[b]
                    for (i in merged.indices) merged[i] += audio[i] * gain
                }
            }
            MergeMode.EQUAL_AVERAGE -> {
                val gain = 1f / branchAudio.size
                for (audio in branchAudio) {
                    for (i in merged.indices) merged[i] += audio[i] * gain
                }
            }
            MergeMode.ALTERNATING_POLARITY -> {
                val denominator = active.sumOf { abs(it.weight.coerceIn(-4f, 4f)).toDouble() }
                    .toFloat().coerceAtLeast(0.0001f)
                for (b in branchAudio.indices) {
                    val sign = if (b % 2 == 0) 1f else -1f
                    val gain = sign * active[b].weight.coerceIn(-4f, 4f) / denominator
                    val audio = branchAudio[b]
                    for (i in merged.indices) merged[i] += audio[i] * gain
                }
            }
        }

        return if (matrix.master.isEmpty()) merged
        else DspEngine.process(merged, channels, sampleRate, frameStart, matrix.master)
    }
}
