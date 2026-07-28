package com.vhanma.scalararchitectureforge;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.os.Handler;
import android.os.Looper;
import android.view.View;

public final class ArchitectureView extends View {
    private static final int BG = Color.rgb(5, 11, 13);
    private static final int CARD = Color.rgb(14, 31, 34);
    private static final int CARD_ALT = Color.rgb(8, 22, 25);
    private static final int MINT = Color.rgb(131, 241, 215);
    private static final int PURPLE = Color.rgb(144, 114, 224);
    private static final int GOLD = Color.rgb(250, 203, 101);
    private static final int TEXT = Color.rgb(235, 244, 242);
    private static final int MUTED = Color.rgb(165, 193, 188);

    private final Paint panelPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint linePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint gridPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint titlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint smallPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint tinyPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF rect = new RectF();
    private final Path path = new Path();
    private final Handler handler = new Handler(Looper.getMainLooper());

    private AudioEngine.Preview preview;
    private float[] fireLetters;
    private float[] dimensionEnergy;
    private ArchitectureConfig config = new ArchitectureConfig();
    private float animationPhase = 0f;
    private boolean animating = false;

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            if (!animating) return;
            animationPhase += 0.85f;
            invalidate();
            handler.postDelayed(this, 32);
        }
    };

    public ArchitectureView(Context context) {
        super(context);
        setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        panelPaint.setStyle(Paint.Style.FILL);
        linePaint.setStyle(Paint.Style.STROKE);
        linePaint.setStrokeWidth(dp(1.2f));
        linePaint.setStrokeCap(Paint.Cap.ROUND);
        linePaint.setStrokeJoin(Paint.Join.ROUND);
        fillPaint.setStyle(Paint.Style.FILL);
        gridPaint.setColor(Color.rgb(48, 79, 80));
        gridPaint.setStrokeWidth(dp(1));
        titlePaint.setColor(TEXT);
        titlePaint.setTextSize(sp(13));
        titlePaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        smallPaint.setColor(MUTED);
        smallPaint.setTextSize(sp(10.5f));
        tinyPaint.setColor(MUTED);
        tinyPaint.setTextSize(sp(8.5f));
    }

    public void setData(AudioEngine.Preview preview,
                        float[] fireLetters,
                        float[] dimensionEnergy,
                        ArchitectureConfig config) {
        this.preview = preview;
        this.fireLetters = fireLetters;
        this.dimensionEnergy = dimensionEnergy;
        this.config = config.copy();
        animating = preview != null;
        handler.removeCallbacks(ticker);
        if (animating) handler.post(ticker);
        invalidate();
    }

    public void clear() {
        preview = null;
        fireLetters = null;
        dimensionEnergy = null;
        animating = false;
        handler.removeCallbacks(ticker);
        invalidate();
    }

    @Override
    protected void onDetachedFromWindow() {
        animating = false;
        handler.removeCallbacks(ticker);
        super.onDetachedFromWindow();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        canvas.drawColor(BG);
        float gap = dp(10);
        float top = 0;
        float waveHeight = dp(118);
        drawWavePanel(canvas, top, waveHeight, "FORWARD COMPONENT", "moves →",
                preview == null ? null : preview.forward, MINT, 1);
        top += waveHeight + gap;
        drawWavePanel(canvas, top, waveHeight, "PHASE-CONJUGATE ANALOGUE", "moves ←",
                preview == null ? null : preview.conjugate, PURPLE, -1);
        top += waveHeight + gap;
        drawWavePanel(canvas, top, waveHeight, "MATCHED-POINT SUM", "aligned cancellation",
                preview == null ? null : preview.matchedSum, GOLD, 0);
        top += waveHeight + gap;
        drawEnvelopePanel(canvas, top, waveHeight,
                preview == null ? null : preview.envelope);
        top += waveHeight + gap;
        drawFireLetterPanel(canvas, top, dp(290));
        top += dp(290) + gap;
        drawDimensionPanel(canvas, top, dp(220));
        top += dp(220) + gap;
        drawMerkabaPanel(canvas, top, dp(190));
    }

    private void drawWavePanel(Canvas canvas,
                               float top,
                               float height,
                               String title,
                               String direction,
                               float[] data,
                               int color,
                               int scrollDirection) {
        panel(canvas, top, height, scrollDirection == 0 ? CARD_ALT : CARD);
        canvas.drawText(title, dp(14), top + dp(23), titlePaint);
        float directionWidth = smallPaint.measureText(direction);
        canvas.drawText(direction, getWidth() - dp(14) - directionWidth,
                top + dp(23), smallPaint);

        float left = dp(13);
        float right = getWidth() - dp(13);
        float graphTop = top + dp(34);
        float bottom = top + height - dp(11);
        float center = (graphTop + bottom) / 2f;
        canvas.drawLine(left, center, right, center, gridPaint);
        if (data == null || data.length < 2) {
            canvas.drawText("Import image/audio or forge text", left,
                    center + dp(4), smallPaint);
            return;
        }
        drawWave(canvas, data, left, right, graphTop, bottom, color, scrollDirection);
    }

    private void drawEnvelopePanel(Canvas canvas,
                                   float top,
                                   float height,
                                   float[] data) {
        panel(canvas, top, height, CARD);
        canvas.drawText("MORPHOGENETIC ENVELOPE PREVIEW", dp(14),
                top + dp(23), titlePaint);
        String note = "compression / thinning";
        canvas.drawText(note, getWidth() - dp(14) - smallPaint.measureText(note),
                top + dp(23), smallPaint);
        float left = dp(13);
        float right = getWidth() - dp(13);
        float graphTop = top + dp(34);
        float bottom = top + height - dp(11);
        float center = (graphTop + bottom) / 2f;
        canvas.drawLine(left, center, right, center, gridPaint);
        if (data == null || data.length < 2) return;
        float width = right - left;
        float amp = (bottom - graphTop) * 0.43f;
        int points = Math.min(data.length, Math.max(240, (int) width));
        path.reset();
        for (int i = 0; i < points; i++) {
            int index = Math.round(i * (data.length - 1f) / (points - 1f));
            float x = left + i * width / (points - 1f);
            float y = center - clamp01(data[index]) * amp;
            if (i == 0) path.moveTo(x, y);
            else path.lineTo(x, y);
        }
        for (int i = points - 1; i >= 0; i--) {
            int index = Math.round(i * (data.length - 1f) / (points - 1f));
            float x = left + i * width / (points - 1f);
            float y = center + clamp01(data[index]) * amp;
            path.lineTo(x, y);
        }
        path.close();
        fillPaint.setColor(Color.argb(45, Color.red(MINT), Color.green(MINT), Color.blue(MINT)));
        canvas.drawPath(path, fillPaint);
        linePaint.setColor(MINT);
        linePaint.setShadowLayer(dp(4), 0, 0, Color.argb(90, 131, 241, 215));
        canvas.drawPath(path, linePaint);
        linePaint.clearShadowLayer();
    }

    private void drawFireLetterPanel(Canvas canvas, float top, float height) {
        panel(canvas, top, height, CARD);
        canvas.drawText("144 FIRE-LETTER SEQUENCE", dp(14), top + dp(23), titlePaint);
        String note = "12 dimensions × 12 fixed points";
        canvas.drawText(note, getWidth() - dp(14) - smallPaint.measureText(note),
                top + dp(23), smallPaint);

        float gridLeft = dp(24);
        float gridTop = top + dp(42);
        float gridSize = Math.min(getWidth() - dp(48), height - dp(60));
        float cell = gridSize / 12f;
        for (int row = 0; row < 12; row++) {
            for (int col = 0; col < 12; col++) {
                int index = row * 12 + col;
                float value = fireLetters == null ? 0.08f : clamp01(fireLetters[index]);
                int color = blend(PURPLE, MINT, value);
                int alpha = fireLetters == null ? 45 : 80 + Math.round(value * 175);
                fillPaint.setColor(Color.argb(alpha, Color.red(color),
                        Color.green(color), Color.blue(color)));
                float l = gridLeft + col * cell + dp(1);
                float t = gridTop + row * cell + dp(1);
                rect.set(l, t, l + cell - dp(2), t + cell - dp(2));
                canvas.drawRoundRect(rect, dp(2.5f), dp(2.5f), fillPaint);
            }
        }
        linePaint.setColor(Color.rgb(50, 91, 91));
        linePaint.setStrokeWidth(dp(1));
        rect.set(gridLeft, gridTop, gridLeft + gridSize, gridTop + gridSize);
        canvas.drawRoundRect(rect, dp(5), dp(5), linePaint);
        canvas.drawText("D1", dp(5), gridTop + cell * 0.7f, tinyPaint);
        canvas.drawText("D12", dp(2), gridTop + cell * 11.7f, tinyPaint);
    }

    private void drawDimensionPanel(Canvas canvas, float top, float height) {
        panel(canvas, top, height, CARD_ALT);
        canvas.drawText("15 DIMENSIONAL BANDS / 5 HARMONIC UNIVERSES",
                dp(14), top + dp(23), titlePaint);
        float left = dp(16);
        float right = getWidth() - dp(16);
        float chartTop = top + dp(48);
        float chartBottom = top + height - dp(29);
        float width = right - left;
        float barSlot = width / 15f;
        for (int hu = 0; hu < 5; hu++) {
            fillPaint.setColor(hu % 2 == 0
                    ? Color.argb(22, 131, 241, 215)
                    : Color.argb(22, 144, 114, 224));
            rect.set(left + hu * 3 * barSlot, chartTop,
                    left + (hu + 1) * 3 * barSlot, chartBottom);
            canvas.drawRect(rect, fillPaint);
            String huLabel = "HU-" + (hu + 1);
            float center = left + (hu * 3 + 1.5f) * barSlot;
            canvas.drawText(huLabel, center - tinyPaint.measureText(huLabel) / 2f,
                    top + height - dp(7), tinyPaint);
        }
        for (int d = 1; d <= 15; d++) {
            float value = dimensionEnergy == null ? 0.08f : clamp01(dimensionEnergy[d - 1]);
            float barWidth = barSlot * 0.58f;
            float x = left + (d - 0.5f) * barSlot;
            float h = (chartBottom - chartTop) * value;
            int color = config.isBaseTone(d) ? MINT
                    : config.isOvertone(d) ? PURPLE : GOLD;
            fillPaint.setColor(Color.argb(210, Color.red(color), Color.green(color), Color.blue(color)));
            rect.set(x - barWidth / 2f, chartBottom - h,
                    x + barWidth / 2f, chartBottom);
            canvas.drawRoundRect(rect, dp(3), dp(3), fillPaint);
            String label = "D" + d;
            canvas.drawText(label, x - tinyPaint.measureText(label) / 2f,
                    chartBottom + dp(12), tinyPaint);
        }
        canvas.drawText("magnetic / CCW", left, top + dp(39), tinyPaint);
        String overtone = "electrical / CW";
        canvas.drawText(overtone, right - tinyPaint.measureText(overtone),
                top + dp(39), tinyPaint);
    }

    private void drawMerkabaPanel(Canvas canvas, float top, float height) {
        panel(canvas, top, height, CARD);
        canvas.drawText("MERKABA RATIO / SPIN GEOMETRY", dp(14),
                top + dp(23), titlePaint);
        float cx1 = getWidth() * 0.27f;
        float cx2 = getWidth() * 0.72f;
        float cy = top + height * 0.56f;
        float radius = Math.min(dp(52), height * 0.29f);

        linePaint.setStrokeWidth(dp(2));
        linePaint.setColor(MINT);
        rect.set(cx1 - radius, cy - radius, cx1 + radius, cy + radius);
        canvas.drawArc(rect, -25, -300, false, linePaint);
        drawArrowHead(canvas, cx1 - radius * 0.78f, cy - radius * 0.62f, MINT, -1);
        drawTriangle(canvas, cx1, cy, radius * 0.72f, MINT, -animationPhase * 0.012f);

        linePaint.setColor(PURPLE);
        rect.set(cx2 - radius, cy - radius, cx2 + radius, cy + radius);
        canvas.drawArc(rect, 25, 300, false, linePaint);
        drawArrowHead(canvas, cx2 + radius * 0.78f, cy - radius * 0.62f, PURPLE, 1);
        drawTriangle(canvas, cx2, cy, radius * 0.72f, PURPLE,
                animationPhase * 0.012f + (float) Math.toRadians(config.spinAngle));

        String left = config.topRatio + " magnetic";
        String right = config.bottomRatio + " electrical";
        canvas.drawText(left, cx1 - smallPaint.measureText(left) / 2f,
                top + height - dp(15), smallPaint);
        canvas.drawText(right, cx2 - smallPaint.measureText(right) / 2f,
                top + height - dp(15), smallPaint);
        String center = config.topRatio + ":" + config.bottomRatio
                + "   •   " + config.spinAngle + "° shift";
        canvas.drawText(center, getWidth() / 2f - titlePaint.measureText(center) / 2f,
                top + dp(42), titlePaint);
    }

    private void drawWave(Canvas canvas,
                          float[] data,
                          float left,
                          float right,
                          float top,
                          float bottom,
                          int color,
                          int direction) {
        path.reset();
        linePaint.setColor(color);
        linePaint.setStrokeWidth(dp(1.2f));
        linePaint.setShadowLayer(dp(4), 0, 0,
                Color.argb(78, Color.red(color), Color.green(color), Color.blue(color)));
        float width = right - left;
        float center = (top + bottom) / 2f;
        float amplitude = (bottom - top) * 0.43f;
        int offset = direction == 0 ? 0 : (int) animationPhase * direction;
        int points = Math.min(data.length, Math.max(240, (int) width));
        for (int i = 0; i < points; i++) {
            int raw = Math.round(i * (data.length - 1f) / (points - 1f));
            int index = (raw + offset) % data.length;
            if (index < 0) index += data.length;
            float x = left + i * width / (points - 1f);
            float y = center - clamp(data[index], -1f, 1f) * amplitude;
            if (i == 0) path.moveTo(x, y);
            else path.lineTo(x, y);
        }
        canvas.drawPath(path, linePaint);
        linePaint.clearShadowLayer();
    }

    private void drawTriangle(Canvas canvas, float cx, float cy,
                              float radius, int color, float rotation) {
        path.reset();
        for (int i = 0; i < 3; i++) {
            double angle = rotation - Math.PI / 2.0 + i * Math.PI * 2.0 / 3.0;
            float x = cx + (float) Math.cos(angle) * radius;
            float y = cy + (float) Math.sin(angle) * radius;
            if (i == 0) path.moveTo(x, y);
            else path.lineTo(x, y);
        }
        path.close();
        linePaint.setColor(color);
        linePaint.setStrokeWidth(dp(1.6f));
        canvas.drawPath(path, linePaint);
    }

    private void drawArrowHead(Canvas canvas, float x, float y, int color, int direction) {
        fillPaint.setColor(color);
        path.reset();
        path.moveTo(x, y);
        path.lineTo(x - direction * dp(10), y - dp(5));
        path.lineTo(x - direction * dp(7), y + dp(8));
        path.close();
        canvas.drawPath(path, fillPaint);
    }

    private void panel(Canvas canvas, float top, float height, int color) {
        panelPaint.setColor(color);
        rect.set(0, top, getWidth(), top + height);
        canvas.drawRoundRect(rect, dp(18), dp(18), panelPaint);
        linePaint.setColor(Color.rgb(28, 58, 61));
        linePaint.setStrokeWidth(dp(1));
        canvas.drawRoundRect(rect, dp(18), dp(18), linePaint);
    }

    private int blend(int a, int b, float t) {
        t = clamp01(t);
        int r = Math.round(Color.red(a) + (Color.red(b) - Color.red(a)) * t);
        int g = Math.round(Color.green(a) + (Color.green(b) - Color.green(a)) * t);
        int bl = Math.round(Color.blue(a) + (Color.blue(b) - Color.blue(a)) * t);
        return Color.rgb(r, g, bl);
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }

    private float sp(float value) {
        return value * getResources().getDisplayMetrics().scaledDensity;
    }

    private static float clamp01(float value) {
        return clamp(value, 0f, 1f);
    }

    private static float clamp(float value, float min, float max) {
        return Math.max(min, Math.min(max, value));
    }
}
