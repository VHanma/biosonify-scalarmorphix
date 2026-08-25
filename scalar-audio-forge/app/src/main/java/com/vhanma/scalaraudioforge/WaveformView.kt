package com.vhanma.scalaraudioforge

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

class WaveformView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {
    private val grid = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(45, 49, 64); strokeWidth = 1f }
    private val wave = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(156, 124, 255); strokeWidth = 2f }
    private val spectrumPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeWidth = 1f }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(180, 184, 199); textSize = 24f }
    private val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; textSize = 25f }
    private val history = ArrayList<Float>(12_000)
    private val spectrogram = ArrayList<FloatArray>(260)
    private var labels: List<String> = emptyList()
    private var zoom = 1f
    private var pan = 0f
    private var lastX = 0f

    private val scaleDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(detector: ScaleGestureDetector): Boolean {
            zoom = (zoom * detector.scaleFactor).coerceIn(1f, 24f)
            clampPan()
            invalidate()
            return true
        }
    })

    fun setWaveLabels(value: List<String>) {
        labels = value.distinct().take(8)
        invalidate()
    }

    fun clearHistory() {
        history.clear()
        spectrogram.clear()
        zoom = 1f
        pan = 0f
        invalidate()
    }

    fun appendSamples(value: FloatArray) {
        if (value.isEmpty()) return
        val points = downsample(value, 160)
        for (point in points) history.add(point)
        if (history.size > 12_000) history.subList(0, history.size - 12_000).clear()
        spectrogram.add(spectrumOf(value, 48))
        if (spectrogram.size > 260) spectrogram.subList(0, spectrogram.size - 260).clear()
        clampPan()
        invalidate()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaleDetector.onTouchEvent(event)
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastX = event.x
                parent?.requestDisallowInterceptTouchEvent(true)
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                if (!scaleDetector.isInProgress && history.size > 1) {
                    val dx = event.x - lastX
                    lastX = event.x
                    val visible = visibleSampleCount()
                    val maxStart = max(0, history.size - visible)
                    if (maxStart > 0 && width > 0) {
                        val deltaStart = -dx / width * visible
                        pan = (pan + deltaStart / maxStart).coerceIn(0f, 1f)
                        invalidate()
                    }
                }
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                parent?.requestDisallowInterceptTouchEvent(false)
                return true
            }
        }
        return true
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawColor(Color.rgb(13, 16, 24))
        canvas.drawText("OUTPUT WAVEFORM", 14f, 28f, titlePaint)
        if (labels.isNotEmpty()) {
            canvas.drawText(labels.joinToString("  •  ").take(92), 14f, 55f, textPaint)
        }
        drawWaveform(canvas)
        canvas.drawText("SPECTROGRAM", 14f, height * 0.54f, titlePaint)
        drawSpectrogram(canvas)
        canvas.drawText("pinch = zoom   drag = scroll", 14f, height - 12f, textPaint)
    }

    private fun drawWaveform(canvas: Canvas) {
        val top = 66f
        val bottom = height * 0.47f
        val mid = (top + bottom) * 0.5f
        canvas.drawLine(0f, mid, width.toFloat(), mid, grid)
        if (history.size < 2) return
        val count = visibleSampleCount()
        val maxStart = max(0, history.size - count)
        val start = (pan * maxStart).toInt().coerceIn(0, maxStart)
        val end = min(history.size, start + count)
        if (end - start < 2) return
        val amp = (bottom - top) * 0.46f
        var lastDrawX = 0f
        var lastDrawY = mid
        for (i in start until end) {
            val local = i - start
            val x = local.toFloat() / (end - start - 1) * width
            val y = mid - history[i].coerceIn(-1f, 1f) * amp
            if (local > 0) canvas.drawLine(lastDrawX, lastDrawY, x, y, wave)
            lastDrawX = x
            lastDrawY = y
        }
    }

    private fun drawSpectrogram(canvas: Canvas) {
        if (spectrogram.isEmpty()) return
        val top = height * 0.57f
        val bottom = height * 0.91f
        val visibleCols = max(2, (spectrogram.size / zoom).toInt())
        val maxStart = max(0, spectrogram.size - visibleCols)
        val start = (pan * maxStart).toInt().coerceIn(0, maxStart)
        val end = min(spectrogram.size, start + visibleCols)
        if (end <= start) return
        val colW = width.toFloat() / (end - start)
        val bins = spectrogram[start].size
        val rowH = (bottom - top) / bins
        for (column in start until end) {
            val values = spectrogram[column]
            val x0 = (column - start) * colW
            for (bin in values.indices) {
                val v = values[bin].coerceIn(0f, 1f)
                val r = (30 + 180 * v).toInt().coerceIn(0, 255)
                val g = (45 + 190 * v * v).toInt().coerceIn(0, 255)
                val b = (70 + 150 * (1f - v)).toInt().coerceIn(0, 255)
                spectrumPaint.color = Color.rgb(r, g, b)
                val y1 = bottom - bin * rowH
                canvas.drawRect(x0, y1 - rowH, x0 + colW + 1f, y1, spectrumPaint)
            }
        }
        canvas.drawLine(0f, top, width.toFloat(), top, grid)
    }

    private fun visibleSampleCount(): Int {
        if (history.isEmpty()) return 0
        return max(2, (history.size / zoom).toInt()).coerceAtMost(history.size)
    }

    private fun clampPan() {
        pan = pan.coerceIn(0f, 1f)
        if (zoom <= 1.001f) pan = 0f
    }

    private fun downsample(input: FloatArray, maxPoints: Int): FloatArray {
        if (input.size <= maxPoints) return input.copyOf()
        val out = FloatArray(maxPoints)
        val step = input.size.toDouble() / maxPoints
        for (i in out.indices) {
            val from = (i * step).toInt().coerceAtMost(input.lastIndex)
            val to = (((i + 1) * step).toInt()).coerceAtMost(input.size)
            var peak = 0f
            for (j in from until max(from + 1, to)) {
                val v = input[j]
                if (kotlin.math.abs(v) > kotlin.math.abs(peak)) peak = v
            }
            out[i] = peak
        }
        return out
    }

    private fun spectrumOf(input: FloatArray, bins: Int): FloatArray {
        val n = min(768, input.size)
        if (n < 8) return FloatArray(bins)
        val out = FloatArray(bins)
        var maxMag = 1e-9
        for (k in 0 until bins) {
            val fftBin = 1 + k * (n / 2 - 1) / bins
            var re = 0.0
            var im = 0.0
            for (i in 0 until n) {
                val angle = 2.0 * PI * fftBin * i / n
                val window = 0.5 - 0.5 * cos(2.0 * PI * i / (n - 1))
                val v = input[i] * window
                re += v * cos(angle)
                im -= v * kotlin.math.sin(angle)
            }
            val magnitude = sqrt(re * re + im * im)
            out[k] = magnitude.toFloat()
            if (magnitude > maxMag) maxMag = magnitude
        }
        for (i in out.indices) out[i] = sqrt(out[i] / maxMag.toFloat()).coerceIn(0f, 1f)
        return out
    }
}
