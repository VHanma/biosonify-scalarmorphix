package com.vhanma.scalaraudioforge

import kotlin.math.abs

object MatrixEngine {
    fun outputChannels(inputChannels: Int, matrix: ForgeMatrix): Int =
        if (matrix.enabled && matrix.branches.isNotEmpty() && matrix.mode == MergeMode.STEREO_SIDE_BY_SIDE) 2
        else inputChannels

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

        return when (matrix.mode) {
            MergeMode.FULL_MERGE -> fullMerge(input, channels, sampleRate, frameStart, active, matrix.master)
            MergeMode.STEREO_SIDE_BY_SIDE -> sideBySide(input, channels, sampleRate, frameStart, active, matrix.master)
        }
    }

    private fun fullMerge(
        input: FloatArray,
        channels: Int,
        sampleRate: Int,
        frameStart: Long,
        branches: List<ForgeBranch>,
        master: List<TransformSpec>
    ): FloatArray {
        // Keep the original signal exactly once. Each branch contributes its complete
        // transformation delta, so adding more methods does not duplicate the dry audio.
        val merged = input.copyOf()
        branches.forEach { branch ->
            val processed = DspEngine.process(input, channels, sampleRate, frameStart, branch.transforms)
            for (i in merged.indices) merged[i] += processed[i] - input[i]
        }
        peakProtect(merged)
        return if (master.isEmpty()) merged
        else DspEngine.process(merged, channels, sampleRate, frameStart, master)
    }

    private fun sideBySide(
        input: FloatArray,
        channels: Int,
        sampleRate: Int,
        frameStart: Long,
        branches: List<ForgeBranch>,
        master: List<TransformSpec>
    ): FloatArray {
        val frames = input.size / channels
        val out = FloatArray(frames * 2)

        // Begin with one dry copy on each side, then add only each branch's full
        // transformation delta to its assigned side. Branches alternate L/R.
        for (f in 0 until frames) {
            val baseLeft = input[f * channels]
            val baseRight = if (channels > 1) input[f * channels + 1] else baseLeft
            out[f * 2] = baseLeft
            out[f * 2 + 1] = baseRight
        }

        branches.forEachIndexed { index, branch ->
            val side = index % 2
            val processed = DspEngine.process(input, channels, sampleRate, frameStart, branch.transforms)
            for (f in 0 until frames) {
                val sourceChannel = if (channels == 1) 0 else side.coerceAtMost(channels - 1)
                val srcIndex = f * channels + sourceChannel
                val base = input[srcIndex]
                val changed = processed[srcIndex]
                out[f * 2 + side] += changed - base
            }
        }

        peakProtect(out)
        return if (master.isEmpty()) out
        else DspEngine.process(out, 2, sampleRate, frameStart, master)
    }

    private fun peakProtect(x: FloatArray) {
        var peak = 0f
        for (value in x) peak = maxOf(peak, abs(value))
        if (peak > 1f) {
            val gain = 0.995f / peak
            for (i in x.indices) x[i] *= gain
        }
    }
}
