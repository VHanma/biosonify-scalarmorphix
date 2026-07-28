package com.vhanma.scalararchitectureforge;

import java.util.Locale;

public final class ArchitectureConfig {
    public static final String[] MODE_NAMES = {
            "Spectral", "Wave Genetics", "Biofield",
            "Cymatics", "Binary", "Virtual Spinor"
    };

    // Voyagers-inspired dimensional pair labels from the supplied architecture document.
    public static final int[][] MODE_DIMENSIONS = {
            {1, 2}, {3, 4}, {5, 7}, {8, 9}, {10, 12}, {13, 15}
    };

    public static final int[] BASE_TONE_DIMENSIONS = {1, 3, 5, 8, 11, 13};
    public static final int[] OVERTONE_DIMENSIONS = {2, 4, 7, 9, 12, 14};

    public int topRatio = 34;
    public int bottomRatio = 21;
    public int spinAngle = 45;
    public int baseFrequency = 55;
    public int presence = 82;
    public int stepScalePercent = 100;
    public int durationSeconds = 24;
    public boolean resonanceLock = true;
    public boolean simultaneousMode = true;
    public final boolean[] modes = {true, true, true, true, true, true};
    public String emotion = "Neutral";
    public String intention = "";

    public ArchitectureConfig copy() {
        ArchitectureConfig copy = new ArchitectureConfig();
        copy.topRatio = topRatio;
        copy.bottomRatio = bottomRatio;
        copy.spinAngle = spinAngle;
        copy.baseFrequency = baseFrequency;
        copy.presence = presence;
        copy.stepScalePercent = stepScalePercent;
        copy.durationSeconds = durationSeconds;
        copy.resonanceLock = resonanceLock;
        copy.simultaneousMode = simultaneousMode;
        System.arraycopy(modes, 0, copy.modes, 0, modes.length);
        copy.emotion = emotion;
        copy.intention = intention;
        return copy;
    }

    public boolean[] activeDimensions() {
        boolean[] active = new boolean[16];
        if (simultaneousMode) {
            for (int d = 1; d <= 15; d++) active[d] = true;
            return active;
        }
        for (int m = 0; m < modes.length; m++) {
            if (!modes[m]) continue;
            for (int d : MODE_DIMENSIONS[m]) active[d] = true;
        }
        boolean any = false;
        for (int d = 1; d <= 15; d++) any |= active[d];
        if (!any) {
            active[1] = true;
            active[2] = true;
        }
        return active;
    }

    public double dimensionFrequency(int dimension) {
        // Audible representation: each 3-dimension Harmonic Universe spans one octave.
        double stepped = baseFrequency * Math.pow(2.0, (dimension - 1) / 3.0);
        return stepped * Math.max(0.25, stepScalePercent / 100.0);
    }

    public boolean isBaseTone(int dimension) {
        return contains(BASE_TONE_DIMENSIONS, dimension);
    }

    public boolean isOvertone(int dimension) {
        return contains(OVERTONE_DIMENSIONS, dimension);
    }

    public int rotationDirection(int dimension) {
        if (isBaseTone(dimension)) return -1;   // magnetic / counter-clockwise
        if (isOvertone(dimension)) return 1;   // electrical / clockwise
        return ((dimension - 1) / 3) % 2 == 0 ? -1 : 1; // bridge tone
    }

    public double ratioWeight(int dimension) {
        double total = Math.max(1.0, topRatio + bottomRatio);
        if (isBaseTone(dimension)) return topRatio / total;
        if (isOvertone(dimension)) return bottomRatio / total;
        return 0.5;
    }

    public String modesLabel() {
        if (simultaneousMode) return "Simultaneous / all 15 dimensions";
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < modes.length; i++) {
            if (!modes[i]) continue;
            if (builder.length() > 0) builder.append(", ");
            builder.append(MODE_NAMES[i]);
        }
        return builder.length() == 0 ? "Spectral fallback" : builder.toString();
    }

    public String ratioLabel() {
        if (topRatio == 34 && bottomRatio == 21) return "34:21 natural preset";
        if (topRatio == 21 && bottomRatio == 34) return "21:34 reverse preset";
        return topRatio + ":" + bottomRatio + " custom";
    }

    public String toReportJson(String sourceName,
                               String sourceType,
                               String sourceHash,
                               int sampleRate,
                               long frames,
                               float[] fireLetters,
                               float[] dimensionEnergy) {
        StringBuilder json = new StringBuilder(4096);
        json.append("{\n");
        add(json, "app", "Scalar Architecture Forge 1.0", true);
        add(json, "source_name", sourceName, true);
        add(json, "source_type", sourceType, true);
        add(json, "source_sha256", sourceHash, true);
        add(json, "ratio", topRatio + ":" + bottomRatio, true);
        json.append("  \"spin_angle_degrees\": ").append(spinAngle).append(",\n");
        json.append("  \"base_frequency_hz\": ").append(baseFrequency).append(",\n");
        json.append("  \"step_scale_percent\": ").append(stepScalePercent).append(",\n");
        json.append("  \"presence_percent\": ").append(presence).append(",\n");
        json.append("  \"resonance_lock\": ").append(resonanceLock).append(",\n");
        add(json, "modes", modesLabel(), true);
        add(json, "emotion_symbol", emotion, true);
        add(json, "intention_text", intention, true);
        json.append("  \"sample_rate\": ").append(sampleRate).append(",\n");
        json.append("  \"frames\": ").append(frames).append(",\n");
        json.append("  \"duration_seconds\": ")
                .append(String.format(Locale.US, "%.6f", frames / (double) sampleRate))
                .append(",\n");
        json.append("  \"fire_letters_12x12\": [");
        for (int i = 0; i < fireLetters.length; i++) {
            if (i > 0) json.append(',');
            if (i % 12 == 0) json.append("\n    ");
            json.append(String.format(Locale.US, "%.6f", fireLetters[i]));
        }
        json.append("\n  ],\n  \"dimension_energy_D1_D15\": [");
        for (int i = 0; i < dimensionEnergy.length; i++) {
            if (i > 0) json.append(',');
            json.append(String.format(Locale.US, "%.6f", dimensionEnergy[i]));
        }
        json.append("],\n");
        add(json, "method_note",
                "Deterministic symbolic audio mapping with stereo forward and time-reversed polarity-inverted phase-pair output. No physical-field claim.",
                false);
        json.append("}\n");
        return json.toString();
    }

    private static void add(StringBuilder json, String key, String value, boolean comma) {
        json.append("  \"").append(escape(key)).append("\": \"")
                .append(escape(value == null ? "" : value)).append("\"");
        if (comma) json.append(',');
        json.append('\n');
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }

    private static boolean contains(int[] values, int target) {
        for (int value : values) if (value == target) return true;
        return false;
    }
}
