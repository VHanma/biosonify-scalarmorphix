package com.vhanma.scalararchitectureforge;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.view.View;

import java.util.List;

public final class PulseProfileView extends View {
    private static final int BG = Color.rgb(5, 11, 13);
    private static final int CARD = Color.rgb(14, 31, 34);
    private static final int GRID = Color.rgb(42, 72, 73);
    private static final int MINT = Color.rgb(131, 241, 215);
    private static final int PURPLE = Color.rgb(144, 114, 224);
    private static final int GOLD = Color.rgb(250, 203, 101);
    private static final int TEXT = Color.rgb(235, 244, 242);
    private static final int MUTED = Color.rgb(165, 193, 188);

    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint title = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint small = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint tiny = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final RectF rect = new RectF();

    private BlueprintConfig config = new BlueprintConfig();
    private List<BlueprintConfig.PulseEvent> events;

    public PulseProfileView(Context context) {
        super(context);
        setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        fill.setStyle(Paint.Style.FILL);
        line.setStyle(Paint.Style.STROKE);
        line.setStrokeWidth(dp(1.4f));
        line.setStrokeJoin(Paint.Join.ROUND);
        line.setStrokeCap(Paint.Cap.ROUND);
        title.setTextSize(sp(13));
        title.setColor(TEXT);
        title.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        small.setTextSize(sp(10.5f));
        small.setColor(MUTED);
        tiny.setTextSize(sp(8.5f));
        tiny.setColor(MUTED);
    }

    public void setConfig(BlueprintConfig config) {
        this.config = config;
        this.events = config.buildPulseEvents();
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        canvas.drawColor(BG);
        float top = 0;
        drawPulsePanel(canvas, top, dp(180));
        top += dp(192);
        drawCoilPanel(canvas, top, dp(240));
        top += dp(252);
        drawTimingPanel(canvas, top, dp(180));
    }

    private void drawPulsePanel(Canvas canvas, float top, float height) {
        panel(canvas, top, height);
        canvas.drawText("TTL ADDRESS + CARRIER BURST PROFILE", dp(14), top + dp(23), title);
        float left = dp(14);
        float right = getWidth() - dp(14);
        float graphTop = top + dp(45);
        float graphBottom = top + height - dp(22);
        float highY = graphTop + dp(8);
        float lowY = graphBottom - dp(8);
        line.setColor(GRID);
        line.setStrokeWidth(dp(1));
        canvas.drawLine(left, highY, right, highY, line);
        canvas.drawLine(left, lowY, right, lowY, line);
        canvas.drawText("HIGH", left, highY - dp(6), tiny);
        canvas.drawText("LOW", left, lowY + dp(14), tiny);

        if (events == null || events.isEmpty()) return;
        int count = Math.min(32, events.size());
        long endUs = events.get(count - 1).startUs + events.get(count - 1).widthUs;
        path.reset();
        float lastX = left;
        float lastY = lowY;
        path.moveTo(lastX, lastY);
        for (int i = 0; i < count; i++) {
            BlueprintConfig.PulseEvent event = events.get(i);
            float startX = left + (right - left) * event.startUs / Math.max(1f, endUs);
            float endX = left + (right - left) * (event.startUs + event.widthUs) / Math.max(1f, endUs);
            float y = event.bit ? highY : lowY;
            path.lineTo(startX, lastY);
            path.lineTo(startX, y);
            path.lineTo(endX, y);
            lastX = endX;
            lastY = y;
            if (event.bit) {
                line.setColor(Color.argb(70, 131, 241, 215));
                float periodPx = Math.max(dp(2), (right - left)
                        * (1000f / config.carrierKhz) / Math.max(1f, endUs));
                for (float x = startX; x < endX; x += periodPx) {
                    canvas.drawLine(x, graphTop, x, graphBottom, line);
                }
            }
        }
        line.setColor(MINT);
        line.setStrokeWidth(dp(2));
        line.setShadowLayer(dp(5), 0, 0, Color.argb(90, 131, 241, 215));
        canvas.drawPath(path, line);
        line.clearShadowLayer();
    }

    private void drawCoilPanel(Canvas canvas, float top, float height) {
        panel(canvas, top, height);
        canvas.drawText("GENERATOR GEOMETRY", dp(14), top + dp(23), title);
        float cx = getWidth() * 0.5f;
        float cy = top + height * 0.54f;
        if (config.generatorType == BlueprintConfig.GeneratorType.SIMPLE_BIFILAR) {
            drawBifilar(canvas, cx, cy, Math.min(getWidth() * 0.35f, dp(92)));
            String label = config.turnsPairs + " bifilar pairs • AWG " + config.wireGauge;
            canvas.drawText(label, cx - small.measureText(label) / 2f,
                    top + height - dp(18), small);
        } else {
            drawCaduceus(canvas, cx, cy, Math.min(getWidth() * 0.27f, dp(76)));
            String label = config.coreMaterial + " • " + config.coreGapMm + " mm gap";
            canvas.drawText(label, cx - small.measureText(label) / 2f,
                    top + height - dp(18), small);
        }
    }

    private void drawBifilar(Canvas canvas, float cx, float cy, float radius) {
        line.setStrokeWidth(dp(2));
        int turns = 18;
        for (int strand = 0; strand < 2; strand++) {
            path.reset();
            float offset = strand == 0 ? -dp(2.2f) : dp(2.2f);
            for (int i = 0; i < 420; i++) {
                float t = i / 419f;
                double angle = t * Math.PI * turns * 2.0;
                float r = dp(10) + t * (radius - dp(10));
                float x = cx + (float) Math.cos(angle) * r + offset;
                float y = cy + (float) Math.sin(angle) * r + offset;
                if (i == 0) path.moveTo(x, y);
                else path.lineTo(x, y);
            }
            line.setColor(strand == 0 ? MINT : PURPLE);
            canvas.drawPath(path, line);
        }
        canvas.drawText("anti-parallel current pair", cx - small.measureText("anti-parallel current pair") / 2f,
                cy - radius - dp(12), small);
    }

    private void drawCaduceus(Canvas canvas, float cx, float cy, float radius) {
        line.setStrokeWidth(dp(2.2f));
        for (int strand = 0; strand < 2; strand++) {
            path.reset();
            for (int i = 0; i < 360; i++) {
                double t = i / 359.0 * Math.PI * 4.0;
                float x = cx + (float) Math.sin(t) * radius;
                float y = cy + (float) Math.sin(t * 2.0 + strand * Math.PI) * radius * 0.62f;
                if (i == 0) path.moveTo(x, y);
                else path.lineTo(x, y);
            }
            line.setColor(strand == 0 ? MINT : PURPLE);
            canvas.drawPath(path, line);
        }
        fill.setColor(Color.rgb(54, 61, 65));
        rect.set(cx - dp(18), cy - radius * 0.9f,
                cx + dp(18), cy + radius * 0.9f);
        canvas.drawRoundRect(rect, dp(8), dp(8), fill);
        fill.setColor(BG);
        float gapPx = Math.max(dp(2), (float) (config.coreGapMm * dp(10)));
        canvas.drawRect(cx - dp(20), cy - gapPx / 2f,
                cx + dp(20), cy + gapPx / 2f, fill);
        canvas.drawText("focused center / gapped ferrite", cx - small.measureText("focused center / gapped ferrite") / 2f,
                cy - radius - dp(16), small);
    }

    private void drawTimingPanel(Canvas canvas, float top, float height) {
        panel(canvas, top, height);
        canvas.drawText("MICROSECOND TIMING MAP", dp(14), top + dp(23), title);
        float y = top + dp(52);
        drawMetric(canvas, "Carrier", config.carrierKhz + " kHz", y, MINT);
        drawMetric(canvas, "Period", String.format(java.util.Locale.US, "%.3f µs", config.carrierPeriodUs()), y + dp(30), PURPLE);
        drawMetric(canvas, "Burst", config.burstWidthUs + " µs", y + dp(60), GOLD);
        drawMetric(canvas, "Cycles / burst", String.format(java.util.Locale.US, "%.2f", config.cyclesPerBurst()), y + dp(90), MINT);
        drawMetric(canvas, "TTL", String.format(java.util.Locale.US, "%.1f / %.1f V", config.ttlLowVolts, config.ttlHighVolts), y + dp(120), PURPLE);
    }

    private void drawMetric(Canvas canvas, String label, String value, float y, int color) {
        canvas.drawText(label, dp(16), y, small);
        Paint valuePaint = new Paint(title);
        valuePaint.setColor(color);
        canvas.drawText(value, getWidth() - dp(16) - valuePaint.measureText(value), y, valuePaint);
    }

    private void panel(Canvas canvas, float top, float height) {
        fill.setColor(CARD);
        rect.set(0, top, getWidth(), top + height);
        canvas.drawRoundRect(rect, dp(18), dp(18), fill);
        line.setColor(Color.rgb(28, 58, 61));
        line.setStrokeWidth(dp(1));
        canvas.drawRoundRect(rect, dp(18), dp(18), line);
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }

    private float sp(float value) {
        return value * getResources().getDisplayMetrics().scaledDensity;
    }
}
