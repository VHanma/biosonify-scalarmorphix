package com.vhanma.scalaraudioforge

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.tanh

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
        transforms.forEach { spec -> apply(out, channels, sampleRate, frameStart, spec) }
        for (i in out.indices) out[i] = tanh(out[i].toDouble()).toFloat().coerceIn(-1f, 1f)
        return out
    }

    private fun apply(x: FloatArray, ch: Int, sr: Int, start: Long, s: TransformSpec) {
        val a = s.amount.coerceIn(0f, 1f)
        when (s.kind) {
            TransformKind.PUHARICH_8 -> envelope(x, ch, sr, start, 8.0, a)
            TransformKind.SCHUMANN_783 -> envelope(x, ch, sr, start, 7.83, a)
            TransformKind.CONTROL_256 -> addCarrier(x, ch, sr, start, 256.0, a * 0.16f)
            TransformKind.GATEWAY_STEREO -> gateway(x, ch, sr, start, a)
            TransformKind.TESLA_HARMONICS -> harmonics(x, ch, sr, start, a)
            TransformKind.MEYL_VORTEX -> stereoRotate(x, ch, sr, start, a)
            TransformKind.PHASE_OPPOSED -> phaseOpposed(x, ch, a)
            TransformKind.STANDING_WAVE -> standing(x, ch, sr, start, a)
            TransformKind.ADVANCED_RETARDED -> reverseBlend(x, ch, a, false)
            TransformKind.DNA_WATER -> dnaWater(x, ch, sr, start, a)
            TransformKind.TRIPLE_ELF -> tripleElf(x, ch, sr, start, a)
            TransformKind.BRAIN_LADDER -> brainLadder(x, ch, sr, start, a)
            TransformKind.PHASER_SWEEP -> phaserSweep(x, ch, sr, start, a)
            TransformKind.CHIRP_SPREAD -> chirp(x, ch, sr, start, a)
            TransformKind.LONGITUDINAL_MONO -> longitudinalMono(x, ch, a)
            TransformKind.BEARDEN_CONJUGATE -> reverseBlend(x, ch, a, true)
            TransformKind.INFORMATION_CARRIER -> informationCarrier(x, ch, sr, start, a)
        }
    }

    private fun envelope(x: FloatArray, ch: Int, sr: Int, start: Long, hz: Double, a: Float) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            val mod = 1.0 - a * 0.5 + a * 0.5 * (0.5 + 0.5 * sin(2.0 * PI * hz * t))
            for (c in 0 until ch) x[f * ch + c] *= mod.toFloat()
        }
    }

    private fun addCarrier(x: FloatArray, ch: Int, sr: Int, start: Long, hz: Double, a: Float) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val carrier = (sin(2.0 * PI * hz * (start + f) / sr) * a).toFloat()
            for (c in 0 until ch) x[f * ch + c] += carrier
        }
    }

    private fun gateway(x: FloatArray, ch: Int, sr: Int, start: Long, a: Float) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            val left = (sin(2.0 * PI * 252.0 * t) * a * 0.14).toFloat()
            val right = (sin(2.0 * PI * 260.0 * t) * a * 0.14).toFloat()
            if (ch == 1) x[f] += (left + right) * 0.5f
            else {
                x[f * ch] += left
                x[f * ch + 1] += right
            }
        }
    }

    private fun harmonics(x: FloatArray, ch: Int, sr: Int, start: Long, a: Float) {
        val frames = x.size / ch
        val freqs = doubleArrayOf(144.0, 432.0, 864.0)
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            var v = 0.0
            for ((i, hz) in freqs.withIndex()) v += sin(2.0 * PI * hz * t) / (i + 1)
            val add = (v * a * 0.08).toFloat()
            for (c in 0 until ch) x[f * ch + c] += add
        }
    }

    private fun stereoRotate(x: FloatArray, ch: Int, sr: Int, start: Long, a: Float) {
        if (ch < 2) return
        val frames = x.size / ch
        for (f in 0 until frames) {
            val angle = sin(2.0 * PI * 0.20 * (start + f) / sr) * (PI / 2.0) * a
            val cs = cos(angle).toFloat()
            val sn = sin(angle).toFloat()
            val i = f * ch
            val l = x[i]
            val r = x[i + 1]
            x[i] = l * cs - r * sn
            x[i + 1] = l * sn + r * cs
        }
    }

    private fun phaseOpposed(x: FloatArray, ch: Int, a: Float) {
        if (ch < 2) return
        val frames = x.size / ch
        for (f in 0 until frames) {
            val i = f * ch
            val l = x[i]
            val r = x[i + 1]
            val side = (l - r) * 0.5f
            x[i] = l * (1f - a) + side * a
            x[i + 1] = r * (1f - a) - side * a
        }
    }

    private fun standing(x: FloatArray, ch: Int, sr: Int, start: Long, a: Float) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            val node = abs(sin(2.0 * PI * 3.0 * t)).toFloat()
            val gain = 1f - a + a * node
            for (c in 0 until ch) x[f * ch + c] *= gain
        }
    }

    private fun reverseBlend(x: FloatArray, ch: Int, a: Float, conjugate: Boolean) {
        val frames = x.size / ch
        if (frames < 2) return
        val original = x.copyOf()
        for (f in 0 until frames) {
            val rf = frames - 1 - f
            for (c in 0 until ch) {
                val rev = original[rf * ch + c] * if (conjugate) -1f else 1f
                val i = f * ch + c
                x[i] = original[i] * (1f - a) + rev * a
            }
        }
    }

    private fun dnaWater(x: FloatArray, ch: Int, sr: Int, start: Long, a: Float) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            val h = (sin(2.0 * PI * 256.0 * t) + 0.5 * sin(2.0 * PI * 512.0 * t) + 0.25 * sin(2.0 * PI * 1024.0 * t)) / 1.75
            val gain = (1.0 - a * 0.25 + h * a * 0.20).toFloat()
            for (c in 0 until ch) x[f * ch + c] *= gain
        }
    }

    private fun tripleElf(x: FloatArray, ch: Int, sr: Int, start: Long, a: Float) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            val m = (sin(2.0 * PI * 7.83 * t) + sin(2.0 * PI * 8.0 * t) + sin(2.0 * PI * 9.0 * t)) / 3.0
            val gain = (1.0 - a * 0.35 + m * a * 0.25).toFloat()
            for (c in 0 until ch) x[f * ch + c] *= gain
        }
    }

    private fun brainLadder(x: FloatArray, ch: Int, sr: Int, start: Long, a: Float) {
        val freqs = doubleArrayOf(4.0, 7.83, 8.0, 10.0, 20.0, 40.0)
        val frames = x.size / ch
        for (f in 0 until frames) {
            val global = start + f
            val seconds = global.toDouble() / sr
            val hz = freqs[((seconds / 3.0).toInt()) % freqs.size]
            val m = (0.5 + 0.5 * sin(2.0 * PI * hz * seconds)).toFloat()
            val gain = 1f - a * 0.35f + m * a * 0.35f
            for (c in 0 until ch) x[f * ch + c] *= gain
        }
    }

    private fun phaserSweep(x: FloatArray, ch: Int, sr: Int, start: Long, a: Float) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            val sweep = 20.0 + 180.0 * (0.5 + 0.5 * sin(2.0 * PI * 0.08 * t))
            val m = sin(2.0 * PI * sweep * t)
            val gain = (1.0 - a * 0.18 + m * a * 0.12).toFloat()
            for (c in 0 until ch) x[f * ch + c] *= gain
        }
    }

    private fun chirp(x: FloatArray, ch: Int, sr: Int, start: Long, a: Float) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val t = (start + f).toDouble() / sr
            val local = t % 5.0
            val hz = 300.0 + (3000.0 - 300.0) * local / 5.0
            val carrier = sin(2.0 * PI * hz * t).toFloat()
            val gain = 1f - a * 0.15f + carrier * a * 0.08f
            for (c in 0 until ch) x[f * ch + c] *= gain
        }
    }

    private fun longitudinalMono(x: FloatArray, ch: Int, a: Float) {
        if (ch < 2) return
        val frames = x.size / ch
        for (f in 0 until frames) {
            var sum = 0f
            for (c in 0 until ch) sum += x[f * ch + c]
            val mono = sum / ch
            for (c in 0 until ch) {
                val i = f * ch + c
                x[i] = x[i] * (1f - a) + mono * a
            }
        }
    }

    private fun informationCarrier(x: FloatArray, ch: Int, sr: Int, start: Long, a: Float) {
        val frames = x.size / ch
        for (f in 0 until frames) {
            val gf = start + f
            val block = gf / 1024L
            var z = block xor (block shl 13)
            z = z xor (z ushr 7)
            z = z xor (z shl 17)
            val sign = if ((z and 1L) == 0L) 1.0 else -1.0
            val carrier = (sign * sin(2.0 * PI * 256.0 * gf / sr) * a * 0.10).toFloat()
            for (c in 0 until ch) x[f * ch + c] += carrier
        }
    }
}
