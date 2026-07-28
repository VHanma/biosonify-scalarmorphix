package com.vhanma.scalararchitectureforge;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class ScalarWaveEngine {
    public static final int SAMPLE_RATE = 48000;

    private ScalarWaveEngine() {
    }

    public static final class Config {
        public String waveform = "Sine";
        public String pairMode = "Phase-conjugate analogue";
        public String envelopeMode = "7.83 Hz Schumann";
        public double carrierHz = 432.0;
        public double messageHz = 7.83;
        public double customEnvelopeHz = 7.83;
        public double modulationDepth = 0.72;
        public double presence = 0.82;
        public double pulseDuty = 0.50;
        public double harmonicTilt = 0.62;
        public int durationSeconds = 30;
        public String layerText = "111,144,369,528,963";
        public boolean goldenRatioPhase = true;
        public boolean softClip = true;

        public double[] layers() {
            if (layerText == null || layerText.trim().isEmpty()) return new double[0];
            String[] parts = layerText.split("[,;\\s]+");
            List<Double> values = new ArrayList<>();
            for (String part : parts) {
                try {
                    double value = Double.parseDouble(part.trim());
                    if (value > 0 && value < SAMPLE_RATE * 0.46) values.add(value);
                } catch (Exception ignored) {
                }
            }
            double[] result = new double[values.size()];
            for (int i = 0; i < values.size(); i++) result[i] = values.get(i);
            return result;
        }

        public double envelopeHz() {
            if (envelopeMode == null) return messageHz;
            if (envelopeMode.startsWith("None")) return 0;
            if (envelopeMode.startsWith("0.1")) return 0.1;
            if (envelopeMode.startsWith("3 Hz")) return 3.0;
            if (envelopeMode.startsWith("6 Hz")) return 6.0;
            if (envelopeMode.startsWith("7.83")) return 7.83;
            if (envelopeMode.startsWith("9 Hz")) return 9.0;
            if (envelopeMode.startsWith("40 Hz")) return 40.0;
            if (envelopeMode.startsWith("Custom")) return Math.max(0, customEnvelopeHz);
            return Math.max(0, messageHz);
        }
    }

    public static final class Preview {
        public final float[] forward;
        public final float[] conjugate;
        public final float[] vectorSum;
        public final float[] envelope;
        public final float[] pressureDensity;

        Preview(float[] forward, float[] conjugate, float[] vectorSum,
                float[] envelope, float[] pressureDensity) {
            this.forward = forward;
            this.conjugate = conjugate;
            this.vectorSum = vectorSum;
            this.envelope = envelope;
            this.pressureDensity = pressureDensity;
        }
    }

    public static final class Result {
        public final File wavFile;
        public final Preview preview;
        public final Config config;
        public final long frames;
        public final String report;

        Result(File wavFile, Preview preview, Config config, long frames, String report) {
            this.wavFile = wavFile;
            this.preview = preview;
            this.config = config;
            this.frames = frames;
            this.report = report;
        }
    }

    public static Result create(File output, Config config) throws IOException {
        if (output.exists() && !output.delete()) {
            throw new IOException("Could not replace the previous scalar-wave WAV.");
        }
        long frames = (long) SAMPLE_RATE * Math.max(1, config.durationSeconds);
        long dataBytes = frames * 4L;
        double duration = frames / (double) SAMPLE_RATE;
        double[] layers = config.layers();

        try (BufferedOutputStream out = new BufferedOutputStream(
                new FileOutputStream(output), 256 * 1024)) {
            writeWavHeader(out, SAMPLE_RATE, 2, 16, dataBytes);
            byte[] block = new byte[4096 * 4];
            long frame = 0;
            while (frame < frames) {
                int count = (int) Math.min(4096, frames - frame);
                int p = 0;
                for (int i = 0; i < count; i++) {
                    long index = frame + i;
                    double t = index / (double) SAMPLE_RATE;
                    double left = signalAt(t, duration, 1, config, layers);
                    double right;
                    if (config.pairMode.startsWith("180")) {
                        right = -left;
                    } else if (config.pairMode.startsWith("Counter")) {
                        right = signalAt(t, duration, -1, config, layers);
                    } else if (config.pairMode.startsWith("Standing")) {
                        double backwards = signalAt(duration - t, duration, -1, config, layers);
                        right = 0.5 * (-left + backwards);
                    } else {
                        right = -signalAt(duration - t, duration, 1, config, layers);
                    }
                    short ls = toShort(left);
                    short rs = toShort(right);
                    block[p++] = (byte) (ls & 0xFF);
                    block[p++] = (byte) ((ls >>> 8) & 0xFF);
                    block[p++] = (byte) (rs & 0xFF);
                    block[p++] = (byte) ((rs >>> 8) & 0xFF);
                }
                out.write(block, 0, p);
                frame += count;
            }
        }

        Preview preview = buildPreview(config, layers, duration, 1400);
        return new Result(output, preview, config, frames, buildReport(config, layers, frames));
    }

    private static Preview buildPreview(Config config, double[] layers,
                                        double duration, int points) {
        float[] forward = new float[points];
        float[] conjugate = new float[points];
        float[] vectorSum = new float[points];
        float[] envelope = new float[points];
        float[] pressure = new float[points];
        for (int i = 0; i < points; i++) {
            double t = duration * i / Math.max(1.0, points - 1.0);
            double left = signalAt(t, duration, 1, config, layers);
            double right;
            if (config.pairMode.startsWith("180")) {
                right = -left;
            } else if (config.pairMode.startsWith("Counter")) {
                right = signalAt(t, duration, -1, config, layers);
            } else if (config.pairMode.startsWith("Standing")) {
                right = 0.5 * (-left + signalAt(duration - t, duration, -1, config, layers));
            } else {
                right = -signalAt(duration - t, duration, 1, config, layers);
            }
            forward[i] = (float) left;
            conjugate[i] = (float) right;
            if (config.pairMode.startsWith("Phase")) {
                double alignedRight = -signalAt(t, duration, 1, config, layers);
                vectorSum[i] = (float) clamp(left + alignedRight, -1, 1);
            } else {
                vectorSum[i] = (float) clamp(left + right, -1, 1);
            }
            double env = envelopeAt(t, config);
            envelope[i] = (float) env;
            pressure[i] = (float) clamp(Math.abs(left - right) * 0.5 * env, 0, 1);
        }
        return new Preview(forward, conjugate, vectorSum, envelope, pressure);
    }

    private static double signalAt(double t, double duration, int direction,
                                   Config config, double[] layers) {
        double carrier = Math.max(1.0, Math.min(SAMPLE_RATE * 0.45, config.carrierHz));
        double phase = direction * Math.PI * 2.0 * carrier * t;
        double base = waveform(config.waveform, phase, config.pulseDuty);
        double envelope = envelopeAt(t, config);
        double modulation = 1.0 - config.modulationDepth
                + config.modulationDepth * envelope;
        double sum = base * modulation;
        double weight = 1.0;
        double phi = 1.618033988749895;
        for (int i = 0; i < layers.length; i++) {
            double layerPhase = direction * Math.PI * 2.0 * layers[i] * t;
            if (config.goldenRatioPhase) layerPhase += (i + 1) * Math.PI * 2.0 / phi;
            double layerWeight = Math.pow(Math.max(0.05, config.harmonicTilt), i + 1) * 0.62;
            sum += Math.sin(layerPhase) * layerWeight * (0.45 + 0.55 * envelope);
            weight += Math.abs(layerWeight);
        }
        sum /= Math.sqrt(weight);
        double fadeSeconds = Math.min(0.8, duration * 0.08);
        double fadeIn = fadeSeconds <= 0 ? 1 : Math.min(1, t / fadeSeconds);
        double fadeOut = fadeSeconds <= 0 ? 1 : Math.min(1, (duration - t) / fadeSeconds);
        double fade = Math.sin(Math.PI * 0.5 * Math.max(0, Math.min(fadeIn, fadeOut)));
        double value = sum * Math.max(0, Math.min(1, config.presence)) * fade * 0.86;
        return config.softClip ? Math.tanh(value * 1.24) : clamp(value, -1, 1);
    }

    private static double envelopeAt(double t, Config config) {
        double hz = config.envelopeHz();
        if (hz <= 0) return 1.0;
        double cycle = hz * t;
        double sine = 0.5 + 0.5 * Math.sin(Math.PI * 2.0 * cycle - Math.PI / 2.0);
        if (config.envelopeMode != null && config.envelopeMode.contains("Isochronic")) {
            return (cycle - Math.floor(cycle)) < config.pulseDuty ? 1.0 : 0.08;
        }
        if (config.envelopeMode != null && config.envelopeMode.contains("Golden")) {
            double second = 0.5 + 0.5 * Math.sin(Math.PI * 2.0 * hz * 1.61803398875 * t);
            return clamp(0.62 * sine + 0.38 * second, 0, 1);
        }
        return sine;
    }

    private static double waveform(String name, double phase, double duty) {
        double normalized = phase / (Math.PI * 2.0);
        double cycle = normalized - Math.floor(normalized);
        if (name == null || name.startsWith("Sine")) return Math.sin(phase);
        if (name.startsWith("Square")) return Math.sin(phase) >= 0 ? 1 : -1;
        if (name.startsWith("Triangle")) return 1.0 - 4.0 * Math.abs(cycle - 0.5);
        if (name.startsWith("Saw")) return 2.0 * cycle - 1.0;
        if (name.startsWith("Pulse")) return cycle < Math.max(0.02, Math.min(0.98, duty)) ? 1 : -1;
        if (name.startsWith("Soliton")) {
            double x = (cycle - 0.5) * 14.0;
            double sech = 1.0 / Math.cosh(x);
            return 2.0 * sech * sech - 0.18;
        }
        if (name.startsWith("Harmonic")) {
            return 0.66 * Math.sin(phase) + 0.23 * Math.sin(phase * 2.0)
                    + 0.11 * Math.sin(phase * 3.0);
        }
        return Math.sin(phase);
    }

    private static String buildReport(Config c, double[] layers, long frames) {
        StringBuilder layerList = new StringBuilder();
        for (int i = 0; i < layers.length; i++) {
            if (i > 0) layerList.append(',');
            layerList.append(String.format(Locale.US, "%.6f", layers[i]));
        }
        return "{\n"
                + "  \"creator\": \"Scalar Wave Creator v2.1\",\n"
                + "  \"method\": \"Bearden-inspired audio-domain paired-wave simulation\",\n"
                + "  \"waveform\": \"" + escape(c.waveform) + "\",\n"
                + "  \"pair_mode\": \"" + escape(c.pairMode) + "\",\n"
                + "  \"carrier_hz\": " + format(c.carrierHz) + ",\n"
                + "  \"envelope_mode\": \"" + escape(c.envelopeMode) + "\",\n"
                + "  \"envelope_hz\": " + format(c.envelopeHz()) + ",\n"
                + "  \"modulation_depth\": " + format(c.modulationDepth) + ",\n"
                + "  \"presence\": " + format(c.presence) + ",\n"
                + "  \"pulse_duty\": " + format(c.pulseDuty) + ",\n"
                + "  \"harmonic_tilt\": " + format(c.harmonicTilt) + ",\n"
                + "  \"layers_hz\": [" + layerList + "],\n"
                + "  \"golden_ratio_phase\": " + c.goldenRatioPhase + ",\n"
                + "  \"soft_clip\": " + c.softClip + ",\n"
                + "  \"sample_rate\": " + SAMPLE_RATE + ",\n"
                + "  \"frames\": " + frames + ",\n"
                + "  \"duration_seconds\": " + c.durationSeconds + ",\n"
                + "  \"note\": \"Audio simulation and visualization, not physical-field detection.\"\n"
                + "}\n";
    }

    private static String format(double value) {
        return String.format(Locale.US, "%.8f", value);
    }

    private static String escape(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static short toShort(double value) {
        return (short) Math.round(clamp(value, -1, 1) * 32767.0);
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private static void writeIntLE(OutputStream out, long value) throws IOException {
        out.write((int) (value & 0xFF));
        out.write((int) ((value >>> 8) & 0xFF));
        out.write((int) ((value >>> 16) & 0xFF));
        out.write((int) ((value >>> 24) & 0xFF));
    }

    private static void writeWavHeader(OutputStream out, int sampleRate,
                                       int channels, int bitsPerSample,
                                       long dataBytes) throws IOException {
        int blockAlign = channels * bitsPerSample / 8;
        long byteRate = (long) sampleRate * blockAlign;
        out.write(new byte[]{'R', 'I', 'F', 'F'});
        writeIntLE(out, 36 + dataBytes);
        out.write(new byte[]{'W', 'A', 'V', 'E'});
        out.write(new byte[]{'f', 'm', 't', ' '});
        writeIntLE(out, 16);
        out.write(1);
        out.write(0);
        out.write(channels & 0xFF);
        out.write((channels >>> 8) & 0xFF);
        writeIntLE(out, sampleRate);
        writeIntLE(out, byteRate);
        out.write(blockAlign & 0xFF);
        out.write((blockAlign >>> 8) & 0xFF);
        out.write(bitsPerSample & 0xFF);
        out.write((bitsPerSample >>> 8) & 0xFF);
        out.write(new byte[]{'d', 'a', 't', 'a'});
        writeIntLE(out, dataBytes);
    }
}
