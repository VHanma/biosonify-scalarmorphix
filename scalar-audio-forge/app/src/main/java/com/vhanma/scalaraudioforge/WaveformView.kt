package com.vhanma.scalaraudioforge

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

class WaveformView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {
    private val grid = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(45, 49, 64); strokeWidth = 1f }
    private val wave = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(156, 124, 255); strokeWidth = 2f }
    private val spectrumPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(73, 210, 180); strokeWidth = 3f }
    private var samples = FloatArray(0)
    private var spectrum = FloatArray(0)

    fun setSamples(value: FloatArray) {
        if (value.isEmpty()) return
        samples = downsample(value, 1400)
        spectrum = spectrumOf(value, 64)
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawColor(Color.rgb(13, 16, 24))
        val mid = height * 0.37f
        canvas.drawLine(0f, mid, width.toFloat(), mid, grid)
        if (samples.size > 1) {
            val amp = height * 0.31f
            var lastX = 0f
            var lastY = mid
            samples.forEachIndexed { index, s ->
                val x = index.toFloat() / (samples.size - 1) * width
                val y = mid - s.coerceIn(-1f, 1f) * amp
                if (index > 0) canvas.drawLine(lastX, lastY, x, y, wave)
                lastX = x
                lastY = y
            }
        }
        val base = height * .96f
        val top = height * .58f
        if (spectrum.isNotEmpty()) {
            val bar = width.toFloat() / spectrum.size
            for (i in spectrum.indices) {
                val h = spectrum[i].coerceIn(0f, 1f) * (base - top)
                val x = i * bar + bar * .5f
                canvas.drawLine(x, base, x, base - h, spectrumPaint)
            }
        }
    }

    private fun downsample(input: FloatArray, max: Int): FloatArray {
        if (input.size <= max) return input.copyOf()
        val out = FloatArray(max)
        val step = input.size.toDouble() / max
        for (i in out.indices) out[i] = input[(i * step).toInt().coerceAtMost(input.lastIndex)]
        return out
    }

    private fun spectrumOf(input: FloatArray, bins: Int): FloatArray {
        val n = minOf(1024, input.size)
        if (n < 8) return FloatArray(0)
        val out = FloatArray(bins)
        var max = 1e-9
        for (k in 0 until bins) {
            var re = 0.0
            var im = 0.0
            for (i in 0 until n) {
                val angle = 2.0 * PI * k * i / n
                val window = 0.5 - 0.5 * cos(2.0 * PI * i / (n - 1))
                val v = input[i] * window
                re += v * cos(angle)
                im -= v * sin(angle)
            }
            val mag = sqrt(re * re + im * im)
            out[k] = mag.toFloat()
            if (mag > max) max = mag
        }
        for (i in out.indices) out[i] = (out[i] / max.toFloat()).coerceIn(0f, 1f)
        return out
    }
}
