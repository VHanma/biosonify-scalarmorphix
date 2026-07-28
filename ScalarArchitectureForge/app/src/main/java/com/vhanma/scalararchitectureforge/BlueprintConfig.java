package com.vhanma.scalararchitectureforge;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class BlueprintConfig {
    public enum GeneratorType {
        SIMPLE_BIFILAR,
        ADVANCED_CADUCEUS
    }

    public GeneratorType generatorType = GeneratorType.SIMPLE_BIFILAR;
    public int turnsPairs = 144;
    public int wireGauge = 27;
    public double innerDiameterMm = 22.0;
    public double outerDiameterMm = 145.0;
    public double driveVoltage = 3.0;
    public int carrierKhz = 144;
    public int burstWidthUs = 100;
    public int riseTimeNs = 200;
    public double coreGapMm = 0.15;
    public String coreMaterial = "MnZn high-Q ferrite";
    public String dielectric = "Nylon tape";
    public String conductor = "Bonded enameled copper / multifilar";
    public String crystalClarity = "Selenite near-field zone";
    public String crystalGrounding = "Smoky quartz at system foundation";
    public String crystalChannel = "Moldavite at operator interface";
    public boolean plasmonicInterface = false;
    public String plasmonicMaterial = "Gold tetrahedral nanopyramid array";
    public double ttlLowVolts = 0.0;
    public double ttlHighVolts = 3.3;
    public String matrixType = "Skill / cognitive pattern";
    public String matrixText = "";
    public String targetAddress = "";
    public String protocolMode = "Skill and information transfer";
    public int repetitionCount = 144;
    public int interBurstGapUs = 50;
    public int sessionMinutes = 12;
    public String operatorIntent = "Focused coherent transfer";
    public String notes = "";

    public double carrierPeriodUs() {
        return 1000.0 / Math.max(1, carrierKhz);
    }

    public double cyclesPerBurst() {
        return burstWidthUs / carrierPeriodUs();
    }

    public double dutyPercent() {
        return 100.0 * burstWidthUs / Math.max(1.0, burstWidthUs + interBurstGapUs);
    }

    public double averageDiameterMm() {
        return (innerDiameterMm + outerDiameterMm) * 0.5;
    }

    public double estimatedWireLengthMeters() {
        double circumferenceMm = Math.PI * averageDiameterMm();
        return circumferenceMm * Math.max(1, turnsPairs) * 2.0 / 1000.0;
    }

    public double copperResistanceOhms() {
        double diameterMm = awgDiameterMm(wireGauge);
        double areaM2 = Math.PI * Math.pow(diameterMm / 2000.0, 2);
        double lengthM = estimatedWireLengthMeters();
        double copperResistivity = 1.724e-8;
        return copperResistivity * lengthM / Math.max(1e-12, areaM2);
    }

    public double idealDcCurrentAmps() {
        return driveVoltage / Math.max(0.05, copperResistanceOhms());
    }

    public double conductorSkinDepthMm() {
        double frequencyHz = carrierKhz * 1000.0;
        double mu0 = 4.0e-7 * Math.PI;
        double conductivity = 5.8e7;
        double depthM = Math.sqrt(2.0 / (2.0 * Math.PI * frequencyHz * mu0 * conductivity));
        return depthM * 1000.0;
    }

    public String activeArchitectureSummary() {
        if (generatorType == GeneratorType.SIMPLE_BIFILAR) {
            return "Flat bifilar pancake • anti-parallel pair cancellation • dielectric-potential emphasis";
        }
        return "Multilayer caduceus / figure-eight • gapped ferrite • square-wave burst / soliton hypothesis";
    }

    public byte[] matrixDigest() {
        String material = generatorType.name() + "|" + matrixType + "|" + matrixText + "|"
                + targetAddress + "|" + protocolMode + "|" + operatorIntent + "|"
                + turnsPairs + "|" + wireGauge + "|" + carrierKhz + "|"
                + burstWidthUs + "|" + coreGapMm + "|" + dielectric + "|"
                + coreMaterial + "|" + plasmonicInterface + "|" + plasmonicMaterial;
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest(material.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public List<PulseEvent> buildPulseEvents() {
        byte[] digest = matrixDigest();
        ArrayList<PulseEvent> events = new ArrayList<>();
        long cursorUs = 0;
        int bits = Math.max(1, repetitionCount);
        for (int i = 0; i < bits; i++) {
            int byteIndex = (i / 8) % digest.length;
            int bitIndex = 7 - (i % 8);
            boolean bit = ((digest[byteIndex] >>> bitIndex) & 1) == 1;
            int width = bit ? burstWidthUs : Math.max(10, burstWidthUs / 2);
            int gap = interBurstGapUs + (bit ? 0 : Math.max(5, interBurstGapUs / 2));
            events.add(new PulseEvent(i, cursorUs, width, bit,
                    bit ? ttlHighVolts : ttlLowVolts,
                    carrierKhz, riseTimeNs,
                    targetAddress));
            cursorUs += width + gap;
        }
        return events;
    }

    public String toProfileJson() {
        StringBuilder json = new StringBuilder(8192);
        json.append("{\n");
        add(json, "app", "Bio-Informational Transfer Forge 2.0", true);
        add(json, "generator_type", generatorType.name(), true);
        add(json, "architecture_summary", activeArchitectureSummary(), true);
        json.append("  \"turn_pairs\": ").append(turnsPairs).append(",\n");
        json.append("  \"wire_gauge_awg\": ").append(wireGauge).append(",\n");
        json.append("  \"inner_diameter_mm\": ").append(fmt(innerDiameterMm)).append(",\n");
        json.append("  \"outer_diameter_mm\": ").append(fmt(outerDiameterMm)).append(",\n");
        json.append("  \"estimated_wire_length_m\": ").append(fmt(estimatedWireLengthMeters())).append(",\n");
        json.append("  \"estimated_copper_resistance_ohm\": ").append(fmt(copperResistanceOhms())).append(",\n");
        json.append("  \"idealized_dc_current_a\": ").append(fmt(idealDcCurrentAmps())).append(",\n");
        json.append("  \"copper_skin_depth_mm\": ").append(fmt(conductorSkinDepthMm())).append(",\n");
        json.append("  \"drive_voltage_v\": ").append(fmt(driveVoltage)).append(",\n");
        json.append("  \"carrier_frequency_khz\": ").append(carrierKhz).append(",\n");
        json.append("  \"carrier_period_us\": ").append(fmt(carrierPeriodUs())).append(",\n");
        json.append("  \"burst_width_us\": ").append(burstWidthUs).append(",\n");
        json.append("  \"cycles_per_burst\": ").append(fmt(cyclesPerBurst())).append(",\n");
        json.append("  \"inter_burst_gap_us\": ").append(interBurstGapUs).append(",\n");
        json.append("  \"burst_duty_percent\": ").append(fmt(dutyPercent())).append(",\n");
        json.append("  \"rise_time_ns\": ").append(riseTimeNs).append(",\n");
        json.append("  \"ttl_low_v\": ").append(fmt(ttlLowVolts)).append(",\n");
        json.append("  \"ttl_high_v\": ").append(fmt(ttlHighVolts)).append(",\n");
        json.append("  \"core_gap_mm\": ").append(fmt(coreGapMm)).append(",\n");
        add(json, "core_material", coreMaterial, true);
        add(json, "conductor", conductor, true);
        add(json, "dielectric", dielectric, true);
        json.append("  \"plasmonic_interface\": ").append(plasmonicInterface).append(",\n");
        add(json, "plasmonic_material", plasmonicMaterial, true);
        add(json, "clarity_architecture", crystalClarity, true);
        add(json, "grounding_architecture", crystalGrounding, true);
        add(json, "channel_architecture", crystalChannel, true);
        add(json, "matrix_type", matrixType, true);
        add(json, "matrix_text", matrixText, true);
        add(json, "target_address", targetAddress, true);
        add(json, "protocol_mode", protocolMode, true);
        json.append("  \"repetition_count\": ").append(repetitionCount).append(",\n");
        json.append("  \"session_minutes\": ").append(sessionMinutes).append(",\n");
        add(json, "operator_intent", operatorIntent, true);
        add(json, "notes", notes, true);
        add(json, "matrix_sha256", hex(matrixDigest()), true);
        add(json, "phone_output_note",
                "Phone playback is an audible monitor only. The 100-205 kHz carrier and microsecond event timing are represented in exported profile/TTL data for external hardware.",
                true);
        add(json, "claim_note",
                "Engineering and biological effects described by the source blueprint are experimental hypotheses, not results verified by this app.",
                false);
        json.append("}\n");
        return json.toString();
    }

    public String toPulseCsv() {
        StringBuilder csv = new StringBuilder(32768);
        csv.append("event_index,start_us,width_us,bit,ttl_voltage_v,carrier_khz,carrier_period_us,cycles_in_burst,rise_time_ns,address\n");
        for (PulseEvent event : buildPulseEvents()) {
            csv.append(event.index).append(',')
                    .append(event.startUs).append(',')
                    .append(event.widthUs).append(',')
                    .append(event.bit ? 1 : 0).append(',')
                    .append(fmt(event.ttlVoltage)).append(',')
                    .append(event.carrierKhz).append(',')
                    .append(fmt(1000.0 / Math.max(1, event.carrierKhz))).append(',')
                    .append(fmt(event.widthUs / (1000.0 / Math.max(1, event.carrierKhz)))).append(',')
                    .append(event.riseTimeNs).append(',')
                    .append(csvEscape(event.address)).append('\n');
        }
        return csv.toString();
    }

    public String protocolSummary() {
        StringBuilder text = new StringBuilder();
        text.append("1. Matrix acquisition: ").append(matrixType).append('\n');
        text.append("2. Address: ").append(targetAddress.isBlank() ? "unspecified" : targetAddress).append('\n');
        text.append("3. Transduction: deterministic SHA-256 pulse matrix\n");
        text.append("4. Synchronization: ").append(carrierKhz).append(" kHz carrier, ")
                .append(burstWidthUs).append(" µs burst, ")
                .append(fmt(cyclesPerBurst())).append(" cycles per burst\n");
        text.append("5. Generator: ").append(activeArchitectureSummary()).append('\n');
        text.append("6. Environment: ").append(dielectric).append("; ")
                .append(crystalClarity).append("; ").append(crystalGrounding).append('\n');
        text.append("7. Operator phase note: ").append(operatorIntent).append('\n');
        text.append("8. Session log target: ").append(sessionMinutes).append(" minutes\n");
        text.append("9. Verification record: molecular, electrical, cognitive, or performance measurements entered separately\n");
        text.append("10. Interpretation: compare recorded outcomes against baseline without treating the blueprint as pre-proven.");
        return text.toString();
    }

    public String validationSummary() {
        ArrayList<String> lines = new ArrayList<>();
        if (generatorType == GeneratorType.SIMPLE_BIFILAR) {
            lines.add(turnsPairs >= 100 && turnsPairs <= 200
                    ? "✓ Turn-pair range matches 100–200 target"
                    : "△ Turn pairs outside the blueprint's 100–200 target");
            lines.add(wireGauge >= 24 && wireGauge <= 30
                    ? "✓ Wire gauge inside AWG 24–30 range"
                    : "△ Wire gauge outside AWG 24–30 range");
            lines.add("• Near-zero inductance must be measured on the finished winding; geometry alone cannot certify cancellation");
        } else {
            lines.add(coreGapMm >= 0.10 && coreGapMm <= 0.20
                    ? "✓ Core gap inside 0.10–0.20 mm target"
                    : "△ Core gap outside 0.10–0.20 mm target");
            lines.add(burstWidthUs >= 50 && burstWidthUs <= 150
                    ? "✓ Burst width inside 50–150 µs target"
                    : "△ Burst width outside 50–150 µs target");
            lines.add("• Barkhausen/soliton behavior requires oscilloscope and core-specific measurement; it is not inferred from settings");
        }
        lines.add(carrierKhz >= 100 && carrierKhz <= 205
                ? "✓ Carrier inside 100–205 kHz blueprint range"
                : "△ Carrier outside 100–205 kHz blueprint range");
        lines.add(driveVoltage >= 2.0 && driveVoltage <= 4.0
                ? "✓ Drive voltage inside 2–4 V low-tension range"
                : "△ Drive voltage outside 2–4 V range");
        lines.add(ttlLowVolts >= 0.0 && ttlLowVolts <= 0.8
                ? "✓ TTL LOW inside 0–0.8 V"
                : "△ TTL LOW outside 0–0.8 V");
        lines.add(ttlHighVolts >= 2.0 && ttlHighVolts <= 5.0
                ? "✓ TTL HIGH inside 2–5 V"
                : "△ TTL HIGH outside 2–5 V");
        return String.join("\n", lines);
    }

    public static double awgDiameterMm(int awg) {
        return 0.127 * Math.pow(92.0, (36.0 - awg) / 39.0);
    }

    private static void add(StringBuilder json, String key, String value, boolean comma) {
        json.append("  \"").append(escape(key)).append("\": \"")
                .append(escape(value == null ? "" : value)).append("\"");
        if (comma) json.append(',');
        json.append('\n');
    }

    private static String fmt(double value) {
        return String.format(Locale.US, "%.6f", value);
    }

    private static String hex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) builder.append(String.format(Locale.US, "%02x", value & 0xFF));
        return builder.toString();
    }

    private static String csvEscape(String value) {
        String v = value == null ? "" : value;
        return "\"" + v.replace("\"", "\"\"") + "\"";
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }

    public static final class PulseEvent {
        public final int index;
        public final long startUs;
        public final int widthUs;
        public final boolean bit;
        public final double ttlVoltage;
        public final int carrierKhz;
        public final int riseTimeNs;
        public final String address;

        PulseEvent(int index, long startUs, int widthUs, boolean bit,
                   double ttlVoltage, int carrierKhz, int riseTimeNs,
                   String address) {
            this.index = index;
            this.startUs = startUs;
            this.widthUs = widthUs;
            this.bit = bit;
            this.ttlVoltage = ttlVoltage;
            this.carrierKhz = carrierKhz;
            this.riseTimeNs = riseTimeNs;
            this.address = address;
        }
    }
}
