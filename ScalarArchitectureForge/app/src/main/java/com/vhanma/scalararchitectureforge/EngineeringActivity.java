package com.vhanma.scalararchitectureforge;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public final class EngineeringActivity extends Activity {
    private static final int REQ_SAVE_PROFILE = 2101;
    private static final int REQ_SAVE_PULSES = 2102;
    private static final int REQ_SAVE_PROTOCOL = 2103;

    private static final int BG = Color.rgb(5, 11, 13);
    private static final int CARD = Color.rgb(14, 31, 34);
    private static final int CARD_ALT = Color.rgb(8, 22, 25);
    private static final int MINT = Color.rgb(131, 241, 215);
    private static final int PURPLE = Color.rgb(144, 114, 224);
    private static final int GOLD = Color.rgb(250, 203, 101);
    private static final int TEXT = Color.rgb(235, 244, 242);
    private static final int MUTED = Color.rgb(165, 193, 188);

    private final BlueprintConfig config = new BlueprintConfig();

    private Spinner generatorSpinner;
    private Spinner coreSpinner;
    private Spinner dielectricSpinner;
    private Spinner conductorSpinner;
    private Spinner matrixTypeSpinner;
    private Spinner protocolSpinner;
    private Spinner claritySpinner;
    private Spinner groundingSpinner;
    private Spinner channelSpinner;
    private Spinner plasmonicMaterialSpinner;
    private Switch plasmonicSwitch;

    private EditText turnsInput;
    private EditText wireGaugeInput;
    private EditText innerDiameterInput;
    private EditText outerDiameterInput;
    private EditText voltageInput;
    private EditText carrierInput;
    private EditText burstInput;
    private EditText gapInput;
    private EditText riseInput;
    private EditText coreGapInput;
    private EditText ttlLowInput;
    private EditText ttlHighInput;
    private EditText repetitionsInput;
    private EditText sessionInput;
    private EditText matrixInput;
    private EditText addressInput;
    private EditText intentInput;
    private EditText notesInput;

    private LinearLayout advancedOnlyCard;
    private PulseProfileView pulseView;
    private TextView calculationText;
    private TextView validationText;
    private TextView protocolText;
    private TextView statusText;

    private String pendingProfile;
    private String pendingPulses;
    private String pendingProtocol;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        buildUi();
        refreshBlueprint();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(18), dp(18), dp(30));
        root.setBackgroundColor(BG);
        scroll.addView(root, new ScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView title = text("GENERATOR ENGINEERING BLUEPRINT", 26, TEXT, true);
        title.setLetterSpacing(0.035f);
        root.addView(title);
        TextView subtitle = text(
                "Bifilar cancellation lab • caduceus / ferrite pulse lab • TTL information matrix • protocol record",
                13, MUTED, false);
        subtitle.setPadding(0, dp(5), 0, dp(14));
        root.addView(subtitle);

        LinearLayout architectureCard = card(CARD);
        root.addView(architectureCard, marginTop(0));
        architectureCard.addView(sectionTitle("GENERATOR ARCHITECTURE", MINT));
        generatorSpinner = spinner(new String[]{
                "Simple: non-inductive bifilar pancake",
                "Advanced: caduceus soliton emitter"
        });
        architectureCard.addView(generatorSpinner, matchWrap(dp(8)));
        generatorSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                advancedOnlyCard.setVisibility(position == 1 ? View.VISIBLE : View.GONE);
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {
            }
        });

        turnsInput = numericField("Turn pairs", "144");
        wireGaugeInput = numericField("Wire gauge AWG", "27");
        innerDiameterInput = numericField("Inner diameter mm", "22");
        outerDiameterInput = numericField("Outer diameter mm", "145");
        conductorSpinner = spinner(new String[]{
                "Bonded enameled copper / multifilar",
                "AWG 24–30 Litz-style bundle",
                "High-quality single-strand enameled copper",
                "Trifilar bonded winding"
        });
        addField(architectureCard, "Winding count", turnsInput);
        addField(architectureCard, "Conductor gauge", wireGaugeInput);
        addField(architectureCard, "Inner coil diameter", innerDiameterInput);
        addField(architectureCard, "Outer coil diameter", outerDiameterInput);
        addSpinnerField(architectureCard, "Conductor construction", conductorSpinner);

        LinearLayout driveCard = card(CARD_ALT);
        root.addView(driveCard, marginTop(dp(12)));
        driveCard.addView(sectionTitle("DRIVER + TIMING", PURPLE));
        voltageInput = numericField("Drive voltage V", "3.0");
        carrierInput = numericField("Carrier kHz", "144");
        burstInput = numericField("Burst width µs", "100");
        gapInput = numericField("Inter-burst gap µs", "50");
        riseInput = numericField("Rise time ns", "200");
        ttlLowInput = numericField("TTL low V", "0.0");
        ttlHighInput = numericField("TTL high V", "3.3");
        addField(driveCard, "Low-tension driver", voltageInput);
        addField(driveCard, "External hardware carrier", carrierInput);
        addField(driveCard, "Square-wave burst window", burstInput);
        addField(driveCard, "Pulse spacing", gapInput);
        addField(driveCard, "Edge speed", riseInput);
        addField(driveCard, "Digital OFF level", ttlLowInput);
        addField(driveCard, "Digital ON level", ttlHighInput);

        advancedOnlyCard = card(CARD);
        root.addView(advancedOnlyCard, marginTop(dp(12)));
        advancedOnlyCard.addView(sectionTitle("ADVANCED CADUCEUS / SOLITON PROFILE", GOLD));
        coreGapInput = numericField("Core gap mm", "0.15");
        coreSpinner = spinner(new String[]{
                "MnZn high-Q ferrite",
                "NiZn high-Q ferrite",
                "Custom measured ferrite core"
        });
        addField(advancedOnlyCard, "Ground air gap", coreGapInput);
        addSpinnerField(advancedOnlyCard, "Core material", coreSpinner);
        TextView solitonNote = text(
                "The 50–150 µs value is represented as a gated burst containing several 100–205 kHz carrier cycles. The export records both the burst timing and carrier period.",
                12, MUTED, false);
        solitonNote.setPadding(0, dp(8), 0, 0);
        advancedOnlyCard.addView(solitonNote);
        advancedOnlyCard.setVisibility(View.GONE);

        LinearLayout materialsCard = card(CARD_ALT);
        root.addView(materialsCard, marginTop(dp(12)));
        materialsCard.addView(sectionTitle("DIELECTRIC + FIELD-FOCUS ARCHITECTURE", MINT));
        dielectricSpinner = spinner(new String[]{
                "Nylon tape",
                "Polystyrene padding",
                "FPC film",
                "Layered nylon + FPC film"
        });
        claritySpinner = spinner(new String[]{
                "Selenite near-field zone",
                "No clarity crystal layer",
                "Custom clarity material"
        });
        groundingSpinner = spinner(new String[]{
                "Smoky quartz at system foundation",
                "No crystal grounding layer",
                "Custom grounding material"
        });
        channelSpinner = spinner(new String[]{
                "Moldavite at operator interface",
                "No channel crystal layer",
                "Custom interface material"
        });
        plasmonicSwitch = switchView("Enable plasmonic interface profile", false);
        plasmonicMaterialSpinner = spinner(new String[]{
                "Gold tetrahedral nanopyramid array",
                "Silver tetrahedral nanopyramid array",
                "ITO / glass nanostructured substrate",
                "Custom measured interface"
        });
        addSpinnerField(materialsCard, "Dielectric padding", dielectricSpinner);
        addSpinnerField(materialsCard, "Clarity placement", claritySpinner);
        addSpinnerField(materialsCard, "Grounding placement", groundingSpinner);
        addSpinnerField(materialsCard, "Operator interface", channelSpinner);
        materialsCard.addView(plasmonicSwitch, matchWrap(dp(8)));
        addSpinnerField(materialsCard, "Plasmonic material", plasmonicMaterialSpinner);

        LinearLayout matrixCard = card(CARD);
        root.addView(matrixCard, marginTop(dp(12)));
        matrixCard.addView(sectionTitle("BIO-INFORMATIONAL MATRIX ENCODER", PURPLE));
        matrixTypeSpinner = spinner(new String[]{
                "Skill / cognitive pattern",
                "DNA sequence",
                "Image-derived signature",
                "Audio / frequency signature",
                "Custom information matrix"
        });
        protocolSpinner = spinner(new String[]{
                "Skill and information transfer",
                "DNA sequence imprinting",
                "General field-coupled experiment",
                "Baseline / sham comparison"
        });
        matrixInput = multilineField("Enter DNA bases, skill description, frequency data, or arbitrary information");
        addressInput = textField("Target address / organism or session identifier", "");
        repetitionsInput = numericField("Pulse event count", "144");
        sessionInput = numericField("Session minutes", "12");
        intentInput = textField("Operator phase / intent note", "Focused coherent transfer");
        notesInput = multilineField("Experimental notes, baseline, hardware measurements, or verification plan");
        addSpinnerField(matrixCard, "Matrix type", matrixTypeSpinner);
        addSpinnerField(matrixCard, "Protocol template", protocolSpinner);
        addField(matrixCard, "Information content", matrixInput);
        addField(matrixCard, "Address field", addressInput);
        addField(matrixCard, "Repetition count", repetitionsInput);
        addField(matrixCard, "Session record", sessionInput);
        addField(matrixCard, "Phase-matching note", intentInput);
        addField(matrixCard, "Research notes", notesInput);

        Button calculateButton = button("CALCULATE + ENCODE BLUEPRINT", MINT, Color.rgb(34, 42, 76));
        calculateButton.setOnClickListener(v -> refreshBlueprint());
        LinearLayout.LayoutParams calculateParams = matchWrap(dp(12));
        calculateParams.height = dp(62);
        root.addView(calculateButton, calculateParams);

        statusText = text("READY", 16, MINT, true);
        statusText.setPadding(dp(4), dp(10), dp(4), dp(8));
        root.addView(statusText);

        pulseView = new PulseProfileView(this);
        LinearLayout.LayoutParams pulseParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(625));
        root.addView(pulseView, pulseParams);

        LinearLayout calculationCard = card(CARD_ALT);
        root.addView(calculationCard, marginTop(dp(12)));
        calculationCard.addView(sectionTitle("ENGINEERING CALCULATIONS", GOLD));
        calculationText = text("", 13, TEXT, false);
        calculationText.setPadding(0, dp(8), 0, 0);
        calculationCard.addView(calculationText);

        LinearLayout validationCard = card(CARD);
        root.addView(validationCard, marginTop(dp(12)));
        validationCard.addView(sectionTitle("BLUEPRINT CONSTRAINT CHECK", MINT));
        validationText = text("", 13, TEXT, false);
        validationText.setPadding(0, dp(8), 0, 0);
        validationCard.addView(validationText);

        LinearLayout protocolCard = card(CARD_ALT);
        root.addView(protocolCard, marginTop(dp(12)));
        protocolCard.addView(sectionTitle("ENCODING + EXPOSURE PROTOCOL RECORD", PURPLE));
        protocolText = text("", 13, TEXT, false);
        protocolText.setPadding(0, dp(8), 0, 0);
        protocolCard.addView(protocolText);

        LinearLayout exportRow = new LinearLayout(this);
        exportRow.setOrientation(LinearLayout.HORIZONTAL);
        root.addView(exportRow, marginTop(dp(12)));
        Button profileButton = button("SAVE PROFILE JSON", MINT, Color.rgb(34, 42, 76));
        Button pulseButton = button("SAVE TTL CSV", PURPLE, Color.WHITE);
        exportRow.addView(profileButton, weighted(1f, dp(56)));
        LinearLayout.LayoutParams pulseButtonParams = weighted(1f, dp(56));
        pulseButtonParams.setMarginStart(dp(8));
        exportRow.addView(pulseButton, pulseButtonParams);
        profileButton.setOnClickListener(v -> saveProfile());
        pulseButton.setOnClickListener(v -> savePulses());

        Button protocolButton = button("SAVE COMPLETE PROTOCOL TEXT", GOLD, Color.rgb(48, 38, 8));
        protocolButton.setOnClickListener(v -> saveProtocol());
        LinearLayout.LayoutParams protocolButtonParams = matchWrap(dp(8));
        protocolButtonParams.height = dp(56);
        root.addView(protocolButton, protocolButtonParams);

        LinearLayout metricsCard = card(CARD);
        root.addView(metricsCard, marginTop(dp(12)));
        metricsCard.addView(sectionTitle("POST-EXPOSURE ANALYSIS LOG", GOLD));
        TextView metrics = text(
                "BIOLOGICAL RECORDS\n• Cell-potential or electrical measurements\n• PCR / gene-expression data when applicable\n• DNA-integrity markers\n• Immune and cellular-health measurements\n\nCOGNITIVE / SKILL RECORDS\n• Baseline versus post-session accuracy\n• Reaction time and retention\n• Skill acquisition speed\n• Focus and clarity scales\n• Sham or control comparison\n\nThe app stores design intent and pulse data. It does not infer a biological transfer from the settings alone.",
                13, TEXT, false);
        metrics.setPadding(0, dp(8), 0, 0);
        metricsCard.addView(metrics);

        TextView footer = text(
                "Phone audio hardware cannot directly reproduce a 100–205 kHz carrier. This laboratory exports the microsecond TTL/address sequence and generator profile for an external controller while keeping the original audible Scalar Architecture Forge as the monitor path.",
                12, MUTED, false);
        footer.setPadding(0, dp(14), 0, 0);
        root.addView(footer);

        setContentView(scroll);
    }

    private void refreshBlueprint() {
        try {
            readInputs();
            pulseView.setConfig(config);
            calculationText.setText(String.format(Locale.US,
                    "Architecture: %s\n\n" +
                            "Average winding diameter: %.3f mm\n" +
                            "Estimated paired-wire length: %.3f m\n" +
                            "AWG %d conductor diameter: %.4f mm\n" +
                            "Estimated copper resistance: %.4f Ω\n" +
                            "Idealized DC current before driver limits: %.3f A\n" +
                            "Copper skin depth at %d kHz: %.4f mm\n\n" +
                            "Carrier period: %.4f µs\n" +
                            "Burst window: %d µs\n" +
                            "Carrier cycles per burst: %.3f\n" +
                            "Pulse-envelope duty: %.2f%%\n" +
                            "Encoded event count: %d\n" +
                            "Matrix digest: %s",
                    config.activeArchitectureSummary(),
                    config.averageDiameterMm(),
                    config.estimatedWireLengthMeters(),
                    config.wireGauge,
                    BlueprintConfig.awgDiameterMm(config.wireGauge),
                    config.copperResistanceOhms(),
                    config.idealDcCurrentAmps(),
                    config.carrierKhz,
                    config.conductorSkinDepthMm(),
                    config.carrierPeriodUs(),
                    config.burstWidthUs,
                    config.cyclesPerBurst(),
                    config.dutyPercent(),
                    config.buildPulseEvents().size(),
                    hexPrefix(config.matrixDigest(), 24)));
            validationText.setText(config.validationSummary());
            protocolText.setText(config.protocolSummary());
            pendingProfile = config.toProfileJson();
            pendingPulses = config.toPulseCsv();
            pendingProtocol = buildProtocolDocument();
            statusText.setText("BLUEPRINT ENCODED • " + config.generatorType.name().replace('_', ' '));
        } catch (Exception e) {
            statusText.setText("CHECK INPUTS");
            Toast.makeText(this, e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void readInputs() {
        config.generatorType = generatorSpinner.getSelectedItemPosition() == 0
                ? BlueprintConfig.GeneratorType.SIMPLE_BIFILAR
                : BlueprintConfig.GeneratorType.ADVANCED_CADUCEUS;
        config.turnsPairs = parseInt(turnsInput, 144, 1, 2000);
        config.wireGauge = parseInt(wireGaugeInput, 27, 4, 44);
        config.innerDiameterMm = parseDouble(innerDiameterInput, 22, 0.1, 10000);
        config.outerDiameterMm = parseDouble(outerDiameterInput, 145, config.innerDiameterMm, 10000);
        config.driveVoltage = parseDouble(voltageInput, 3, 0.01, 1000);
        config.carrierKhz = parseInt(carrierInput, 144, 1, 10000);
        config.burstWidthUs = parseInt(burstInput, 100, 1, 1000000);
        config.interBurstGapUs = parseInt(gapInput, 50, 0, 1000000);
        config.riseTimeNs = parseInt(riseInput, 200, 1, 100000000);
        config.coreGapMm = parseDouble(coreGapInput, 0.15, 0.001, 100);
        config.ttlLowVolts = parseDouble(ttlLowInput, 0, -100, 100);
        config.ttlHighVolts = parseDouble(ttlHighInput, 3.3, -100, 100);
        config.repetitionCount = parseInt(repetitionsInput, 144, 1, 100000);
        config.sessionMinutes = parseInt(sessionInput, 12, 1, 1440);
        config.conductor = String.valueOf(conductorSpinner.getSelectedItem());
        config.coreMaterial = String.valueOf(coreSpinner.getSelectedItem());
        config.dielectric = String.valueOf(dielectricSpinner.getSelectedItem());
        config.crystalClarity = String.valueOf(claritySpinner.getSelectedItem());
        config.crystalGrounding = String.valueOf(groundingSpinner.getSelectedItem());
        config.crystalChannel = String.valueOf(channelSpinner.getSelectedItem());
        config.plasmonicInterface = plasmonicSwitch.isChecked();
        config.plasmonicMaterial = String.valueOf(plasmonicMaterialSpinner.getSelectedItem());
        config.matrixType = String.valueOf(matrixTypeSpinner.getSelectedItem());
        config.protocolMode = String.valueOf(protocolSpinner.getSelectedItem());
        config.matrixText = matrixInput.getText().toString();
        config.targetAddress = addressInput.getText().toString();
        config.operatorIntent = intentInput.getText().toString();
        config.notes = notesInput.getText().toString();
    }

    private String buildProtocolDocument() {
        return "BIO-INFORMATIONAL TRANSFER FORGE 2.0\n"
                + "=====================================\n\n"
                + config.protocolSummary() + "\n\n"
                + "BLUEPRINT CONSTRAINT CHECK\n"
                + "--------------------------\n"
                + config.validationSummary() + "\n\n"
                + "MATERIAL ARCHITECTURE\n"
                + "---------------------\n"
                + "Conductor: " + config.conductor + "\n"
                + "Dielectric: " + config.dielectric + "\n"
                + "Core: " + config.coreMaterial + "\n"
                + "Core gap: " + config.coreGapMm + " mm\n"
                + "Clarity: " + config.crystalClarity + "\n"
                + "Grounding: " + config.crystalGrounding + "\n"
                + "Channel: " + config.crystalChannel + "\n"
                + "Plasmonic interface: " + config.plasmonicInterface + " / " + config.plasmonicMaterial + "\n\n"
                + "VERIFICATION PLAN\n"
                + "-----------------\n"
                + "Record baseline, hardware waveform, measured coil/core response, post-session measurements, controls, and repeatability.\n\n"
                + "NOTES\n"
                + "-----\n"
                + config.notes + "\n\n"
                + "INTERPRETATION NOTE\n"
                + "-------------------\n"
                + "This record preserves the supplied experimental blueprint. It does not certify that a configured device produced a physical scalar field or biological information transfer.\n";
    }

    private void saveProfile() {
        refreshBlueprint();
        Intent intent = createDocument("application/json", "bio_transfer_generator_profile.json");
        startActivityForResult(intent, REQ_SAVE_PROFILE);
    }

    private void savePulses() {
        refreshBlueprint();
        Intent intent = createDocument("text/csv", "bio_transfer_ttl_events.csv");
        startActivityForResult(intent, REQ_SAVE_PULSES);
    }

    private void saveProtocol() {
        refreshBlueprint();
        Intent intent = createDocument("text/plain", "bio_transfer_protocol.txt");
        startActivityForResult(intent, REQ_SAVE_PROTOCOL);
    }

    private Intent createDocument(String mime, String name) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        return intent;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) return;
        String content;
        if (requestCode == REQ_SAVE_PROFILE) content = pendingProfile;
        else if (requestCode == REQ_SAVE_PULSES) content = pendingPulses;
        else if (requestCode == REQ_SAVE_PROTOCOL) content = pendingProtocol;
        else return;
        try {
            writeText(data.getData(), content == null ? "" : content);
            statusText.setText("FILE SAVED");
            Toast.makeText(this, "Blueprint file saved", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            statusText.setText("SAVE FAILED");
            Toast.makeText(this, e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void writeText(Uri destination, String content) throws IOException {
        OutputStream raw = getContentResolver().openOutputStream(destination, "w");
        if (raw == null) throw new IOException("Android could not create the destination file.");
        try (BufferedOutputStream out = new BufferedOutputStream(raw)) {
            out.write(content.getBytes(StandardCharsets.UTF_8));
            out.flush();
        }
    }

    private int parseInt(EditText field, int fallback, int min, int max) {
        try {
            int value = Integer.parseInt(field.getText().toString().trim());
            if (value < min || value > max) throw new IllegalArgumentException(
                    field.getHint() + " must be between " + min + " and " + max);
            return value;
        } catch (NumberFormatException e) {
            field.setText(String.valueOf(fallback));
            return fallback;
        }
    }

    private double parseDouble(EditText field, double fallback, double min, double max) {
        try {
            double value = Double.parseDouble(field.getText().toString().trim());
            if (value < min || value > max) throw new IllegalArgumentException(
                    field.getHint() + " must be between " + min + " and " + max);
            return value;
        } catch (NumberFormatException e) {
            field.setText(String.valueOf(fallback));
            return fallback;
        }
    }

    private EditText numericField(String hint, String value) {
        EditText field = textField(hint, value);
        field.setInputType(android.text.InputType.TYPE_CLASS_NUMBER
                | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
                | android.text.InputType.TYPE_NUMBER_FLAG_SIGNED);
        return field;
    }

    private EditText textField(String hint, String value) {
        EditText field = new EditText(this);
        field.setHint(hint);
        field.setHintTextColor(Color.rgb(100, 133, 130));
        field.setText(value);
        field.setTextColor(TEXT);
        field.setTextSize(13.5f);
        field.setSingleLine(true);
        field.setPadding(dp(12), dp(10), dp(12), dp(10));
        field.setBackground(rounded(Color.rgb(7, 20, 23), Color.rgb(42, 76, 77), 12));
        return field;
    }

    private EditText multilineField(String hint) {
        EditText field = textField(hint, "");
        field.setSingleLine(false);
        field.setMinLines(3);
        field.setGravity(Gravity.TOP | Gravity.START);
        return field;
    }

    private void addField(LinearLayout parent, String label, EditText field) {
        TextView labelView = text(label, 12.5f, MUTED, false);
        labelView.setPadding(0, dp(8), 0, dp(4));
        parent.addView(labelView);
        parent.addView(field, matchWrap(0));
    }

    private void addSpinnerField(LinearLayout parent, String label, Spinner spinner) {
        TextView labelView = text(label, 12.5f, MUTED, false);
        labelView.setPadding(0, dp(8), 0, dp(4));
        parent.addView(labelView);
        parent.addView(spinner, matchWrap(0));
    }

    private Spinner spinner(String[] values) {
        Spinner spinner = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<String>(this,
                android.R.layout.simple_spinner_item, values) {
            @Override
            public View getView(int position, View convertView, ViewGroup parent) {
                TextView view = (TextView) super.getView(position, convertView, parent);
                view.setTextColor(TEXT);
                view.setTextSize(13);
                return view;
            }

            @Override
            public View getDropDownView(int position, View convertView, ViewGroup parent) {
                TextView view = (TextView) super.getDropDownView(position, convertView, parent);
                view.setTextColor(Color.BLACK);
                view.setTextSize(14);
                view.setPadding(dp(12), dp(12), dp(12), dp(12));
                return view;
            }
        };
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinner.setAdapter(adapter);
        return spinner;
    }

    private LinearLayout card(int color) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(17), dp(16), dp(17), dp(16));
        layout.setBackground(rounded(color, Color.rgb(28, 58, 61), 19));
        return layout;
    }

    private TextView sectionTitle(String value, int color) {
        return text(value, 14, color, true);
    }

    private Button button(String label, int background, int foreground) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(foreground);
        button.setTextSize(12.5f);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        button.setBackground(rounded(background, background, 28));
        return button;
    }

    private Switch switchView(String label, boolean checked) {
        Switch view = new Switch(this);
        view.setText(label);
        view.setTextColor(TEXT);
        view.setTextSize(12.5f);
        view.setChecked(checked);
        return view;
    }

    private TextView text(String value, float size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextColor(color);
        view.setTextSize(size);
        view.setLineSpacing(0f, 1.18f);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private GradientDrawable rounded(int fill, int stroke, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(radiusDp));
        drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private LinearLayout.LayoutParams matchWrap(int top) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = top;
        return params;
    }

    private LinearLayout.LayoutParams marginTop(int top) {
        return matchWrap(top);
    }

    private LinearLayout.LayoutParams weighted(float weight, int height) {
        return new LinearLayout.LayoutParams(0, height, weight);
    }

    private String hexPrefix(byte[] bytes, int chars) {
        StringBuilder builder = new StringBuilder();
        for (byte value : bytes) builder.append(String.format(Locale.US, "%02x", value & 0xFF));
        return builder.substring(0, Math.min(chars, builder.length()));
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
