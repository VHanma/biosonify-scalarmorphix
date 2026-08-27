package com.vhanma.scalaraudioforge

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import kotlin.math.PI
import kotlin.math.sin

/**
 * Lightweight animated preview of how the currently active method traits reshape
 * a representative signal. This is intentionally labelled as a representative
 * preview. The existing export analyzer remains the source of truth for the
 * user's actual processed media.
 */
class LiveAnalysisView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {
    private val grid = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(48, 54, 68)
        strokeWidth = 1f
    }
    private val sourcePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(150, 158, 178)
        strokeWidth = 2.2f
        style = Paint.Style.STROKE
    }
    private val outputPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(111, 233, 202)
        strokeWidth = 3.2f
        style = Paint.Style.STROKE
    }
    private val secondaryPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(178, 132, 255)
        strokeWidth = 2.5f
        style = Paint.Style.STROKE
    }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = 24f
    }
    private val small = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.LTGRAY
        textSize = 18f
    }

    private var methods: List<TransformKind> = emptyList()
    private var route: RecommendedRoute = RecommendedRoute.FULL_CHAIN
    private var action: String = "Ready"
    private var report: ComboReport = ComboEngine.analyze(emptyList())

    fun setState(
        activeMethods: List<TransformKind>,
        activeRoute: RecommendedRoute,
        lastAction: String
    ) {
        methods = activeMethods.distinct()
        route = activeRoute
        action = lastAction
        report = ComboEngine.analyze(methods)
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawColor(Color.rgb(12, 15, 22))
        if (width <= 0 || height <= 0) return

        val phase = (android.os.SystemClock.uptimeMillis() % 120000L) / 1000.0
        drawGrid(canvas)
        canvas.drawText("LIVE METHOD PREVIEW", 14f, 28f, text)
        canvas.drawText("$route  •  ${methods.size} active method${if (methods.size == 1) "" else "s"}", 14f, 52f, small)
        canvas.drawText(action.take(72), 14f, 76f, small)

        val topY = height * 0.45f
        val bottomY = height * 0.76f
        canvas.drawText("INPUT", 14f, topY - 34f, small)
        canvas.drawText(if (route == RecommendedRoute.SIDE_BY_SIDE) "OUTPUT L / R" else "OUTPUT", 14f, bottomY - 38f, small)

        drawSource(canvas, 14f, width - 14f, topY, phase)
        if (route == RecommendedRoute.SIDE_BY_SIDE) {
            drawProcessed(canvas, 14f, width - 14f, bottomY - 17f, phase, outputPaint, 0.0)
            drawProcessed(canvas, 14f, width - 14f, bottomY + 21f, phase, secondaryPaint, PI / 2.0)
        } else {
            drawProcessed(canvas, 14f, width - 14f, bottomY, phase, outputPaint, 0.0)
        }

        val summary = if (methods.isEmpty()) "Dry conversion preview" else report.summary
        canvas.drawText(summary.take(88), 14f, height - 18f, small)

        // ~30 fps while visible. The view stops scheduling when detached/hidden.
        if (isShown) postInvalidateDelayed(33L)
    }

    private fun drawGrid(canvas: Canvas) {
        val step = 36f
        var x = 0f
        while (x < width) {
            canvas.drawLine(x, 90f, x, height.toFloat(), grid)
            x += step
        }
        var y = 90f
        while (y < height) {
            canvas.drawLine(0f, y, width.toFloat(), y, grid)
            y += step
        }
    }

    private fun drawSource(canvas: Canvas, x0: Float, x1: Float, y: Float, phase: Double) {
        var px = x0
        var py = y
        val steps = 180
        for (i in 0..steps) {
            val t = i.toDouble() / steps
            val x = x0 + (x1 - x0) * t.toFloat()
            val yy = y - (sin(2.0 * PI * 4.0 * t + phase * 2.2) * 24.0).toFloat()
            if (i > 0) canvas.drawLine(px, py, x, yy, sourcePaint)
            px = x
            py = yy
        }
    }

    private fun drawProcessed(
        canvas: Canvas,
        x0: Float,
        x1: Float,
        y: Float,
        phase: Double,
        paint: Paint,
        laneOffset: Double
    ) {
        val s = report.scores
        val rhythmic = s.rhythmic / 5.0
        val harmonic = s.harmonic / 5.0
        val phaseAmount = s.phase / 5.0
        val carrier = s.carrier / 5.0
        val temporal = s.temporal / 5.0
        val information = s.information / 5.0
        var px = x0
        var py = y
        val steps = 220

        for (i in 0..steps) {
            val t = i.toDouble() / steps
            val x = x0 + (x1 - x0) * t.toFloat()
            val moving = phase * (2.0 + carrier * 2.5) + laneOffset
            val env = 1.0 - rhythmic * 0.40 + rhythmic * 0.40 * (1.0 + sin(2.0 * PI * (1.0 + rhythmic) * t + phase))
            var sample = sin(2.0 * PI * 4.0 * t + moving + phaseAmount * PI * 0.55)
            sample += harmonic * 0.42 * sin(2.0 * PI * 8.0 * t + moving * 1.2)
            sample += harmonic * 0.22 * sin(2.0 * PI * 12.0 * t - moving * 0.6)
            sample += carrier * 0.18 * sin(2.0 * PI * 22.0 * t + moving * 2.0)
            sample += temporal * 0.20 * sin(2.0 * PI * 4.0 * (1.0 - t) - moving)
            if (information > 0.0) {
                val bit = if (((t * 16.0).toInt() % 5) in 0..1) 1.0 else -1.0
                sample += information * 0.10 * bit
            }
            val yy = y - (sample * env * 23.0).toFloat()
            if (i > 0) canvas.drawLine(px, py, x, yy, paint)
            px = x
            py = yy
        }
    }
}
