package com.vhanma.scalaraudioforge

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

object DspEngine {
    fun process(
        input: FloatArray,
        channels: Int,
        sampleRate: Int,
        frameStart: Long,
        transforms: List<TransformSpec>
    ): FloatArray {
        if (input.isEmpty() || channels <= 0 || sampleRate <= 0 || transforms.isEmpty()) return input.copyOf()
        val out = input.copyOf()
        transforms.forEach { applyFull(out, channels, sampleRate, frameStart, it.kind) }
        peakProtect(out)
        return out
    }

    private fun applyFull(x: FloatArray, ch: Int, sr: Int, start: Long, kind: TransformKind) {
        when (kind) {
            TransformKind.PUHARICH_8 -> envelope(x, ch, sr, start, 8.0, 0.55)
            TransformKind.SCHUMANN_783 -> envelope(x, ch, sr, start, 7.83, 0.50)
            TransformKind.CONTROL_256 -> addCarrier(x, ch, sr, start, 256.0, 0.08)
            TransformKind.GATEWAY_STEREO -> gateway(x, ch, sr, start)
            TransformKind.TESLA_HARMONICS -> harmonics(x, ch, sr, start)
            TransformKind.MEYL_VORTEX -> stereoRotate(x, ch, sr, start)
            TransformKind.PHASE_OPPOSED -> phaseOpposed(x, ch)
            TransformKind.STANDING_WAVE -> standing(x, ch, sr, start)
            TransformKind.ADVANCED_RETARDED -> reversePair(x, ch, conjugate = false)
            TransformKind.DNA_WATER -> dnaWater(x, ch, sr, start)
            TransformKind.TRIPLE_ELF -> tripleElf(x, ch, sr, start)
            TransformKind.BRAIN_LADDER -> brainLadder(x, ch, sr, start)
            TransformKind.PHASER_SWEEP -> phaserSweep(x, ch, sr, start)
            TransformKind.CHIRP_SPREAD -> chirp(x, ch, sr, start)
            TransformKind.LONGITUDINAL_MONO -> longitudinalMono(x, ch)
            TransformKind.BEARDEN_CONJUGATE -> reversePair(x, ch, conjugate = true)
            TransformKind.INFORMATION_CARRIER -> informationCarrier(x, ch, sr, start)
        }
    }

    private fun envelope(x: FloatArray, ch: Int, sr: Int, start: Long, hz: Double, depth: Double) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            val rhythm = 0.5 + 0.5 * sin(2.0 * PI * hz * t)
            val gain = (1.0 - depth + depth * rhythm).toFloat()
            for (c in 0 until ch) x[f * ch + c] *= gain
        }
    }

    private fun addCarrier(x: FloatArray, ch: Int, sr: Int, start: Long, hz: Double, level: Double) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val carrier = (sin(2.0 * PI * hz * (start + f) / sr) * level).toFloat()
            for (c in 0 until ch) x[f * ch + c] += carrier
        }
    }

    private fun gateway(x: FloatArray, ch: Int, sr: Int, start: Long) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            val left = (sin(2.0 * PI * 252.0 * t) * 0.10).toFloat()
            val right = (sin(2.0 * PI * 260.0 * t) * 0.10).toFloat()
            if (ch == 1) x[f] += (left + right) * 0.5f
            else {
                x[f * ch] += left
                x[f * ch + 1] += right
            }
        }
    }

    private fun harmonics(x: FloatArray, ch: Int, sr: Int, start: Long) {
        val frames = x.size / ch
        val freqs = doubleArrayOf(144.0, 432.0, 864.0)
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            var v = 0.0
            for ((i, hz) in freqs.withIndex()) v += sin(2.0 * PI * hz * t) / (i + 1.0)
            val add = (v * 0.055).toFloat()
            for (c in 0 until ch) x[f * ch + c] += add
        }
    }

    private fun stereoRotate(x: FloatArray, ch: Int, sr: Int, start: Long) {
        if (ch < 2) return
        val frames = x.size / ch
        for (f in 0 until frames) {
            val angle = sin(2.0 * PI * 0.20 * (start + f) / sr) * (PI / 2.0)
            val cs = cos(angle).toFloat()
            val sn = sin(angle).toFloat()
            val i = f * ch
            val l = x[i]
            val r = x[i + 1]
            x[i] = l * cs - r * sn
            x[i + 1] = l * sn + r * cs
        }
    }

    private fun phaseOpposed(x: FloatArray, ch: Int) {
        if (ch < 2) return
        val frames = x.size / ch
        for (f in 0 until frames) {
            val i = f * ch
            val l = x[i]
            val r = x[i + 1]
            val side = (l - r) * 0.5f
            x[i] = side
            x[i + 1] = -side
        }
    }

    private fun standing(x: FloatArray, ch: Int, sr: Int, start: Long) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            val node = abs(sin(2.0 * PI * 3.0 * t)).toFloat()
            for (c in 0 until ch) x[f * ch + c] *= node
        }
    }

    private fun reversePair(x: FloatArray, ch: Int, conjugate: Boolean) {
        val frames = x.size / ch
        if (frames < 2) return
        val original = x.copyOf()
        val norm = (1.0 / sqrt(2.0)).toFloat()
        for (f in 0 until frames) {
            val rf = frames - 1 - f
            for (c in 0 until ch) {
                val forward = original[f * ch + c]
                val reverse = original[rf * ch + c] * if (conjugate) -1f else 1f
                x[f * ch + c] = (forward + reverse) * norm
            }
        }
    }

    private fun dnaWater(x: FloatArray, ch: Int, sr: Int, start: Long) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            val h = (sin(2.0 * PI * 256.0 * t) + 0.5 * sin(2.0 * PI * 512.0 * t) + 0.25 * sin(2.0 * PI * 1024.0 * t)) / 1.75
            val gain = (0.78 + h * 0.22).toFloat()
            for (c in 0 until ch) x[f * ch + c] *= gain
        }
    }

    private fun tripleElf(x: FloatArray, ch: Int, sr: Int, start: Long) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            val m = (sin(2.0 * PI * 7.83 * t) + sin(2.0 * PI * 8.0 * t) + sin(2.0 * PI * 9.0 * t)) / 3.0
            val gain = (0.72 + 0.28 * (0.5 + 0.5 * m)).toFloat()
            for (c in 0 until ch) x[f * ch + c] *= gain
        }
    }

    private fun brainLadder(x: FloatArray, ch: Int, sr: Int, start: Long) {
        val freqs = doubleArrayOf(4.0, 7.83, 8.0, 10.0, 20.0, 40.0)
        val frames = x.size / ch
        for (f in 0 until frames) {
            val global = start + f
            val seconds = global.toDouble() / sr
            val hz = freqs[((seconds / 3.0).toInt()) % freqs.size]
            val rhythm = 0.5 + 0.5 * sin(2.0 * PI * hz * seconds)
            val gain = (0.65 + 0.35 * rhythm).toFloat()
            for (c in 0 until ch) x[f * ch + c] *= gain
        }
    }

    private fun phaserSweep(x: FloatArray, ch: Int, sr: Int, start: Long) {
        val frames = x.size / ch
        var phase = 0.0
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            val sweepHz = 20.0 + 180.0 * (0.5 + 0.5 * sin(2.0 * PI * 0.08 * t))
            phase += 2.0 * PI * sweepHz / sr
            val rhythm = sin(phase)
            val gain = (0.82 + rhythm * 0.18).toFloat()
            for (c in 0 until ch) x[f * ch + c] *= gain
        }
    }

    private fun chirp(x: FloatArray, ch: Int, sr: Int, start: Long) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            val local = t % 5.0
            val f0 = 300.0
            val f1 = 3000.0
            val k = (f1 - f0) / 5.0
            val phase = 2.0 * PI * (f0 * local + 0.5 * k * local * local)
            val carrier = sin(phase)
            val gain = (0.90 + carrier * 0.10).toFloat()
            for (c in 0 until ch) x[f * ch + c] *= gain
        }
    }

    private fun longitudinalMono(x: FloatArray, ch: Int) {
        if (ch < 2) return
        val frames = x.size / ch
        for (f in 0 until frames) {
            var sum = 0f
            for (c in 0 until ch) sum += x[f * ch + c]
            val mono = sum / ch
            for (c in 0 until ch) x[f * ch + c] = mono
        }
    }

    private fun informationCarrier(x: FloatArray, ch: Int, sr: Int, start: Long) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val gf = start + f
            val block = gf / 1024L
            var z = block xor (block shl 13)
            z = z xor (z ushr 7)
            z = z xor (z shl 17)
            val sign = if ((z and 1L) == 0L) 1.0 else -1.0
            val carrier = (sign * sin(2.0 * PI * 256.0 * gf / sr) * 0.075).toFloat()
            for (c in 0 until ch) x[f * ch + c] += carrier
        }
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
