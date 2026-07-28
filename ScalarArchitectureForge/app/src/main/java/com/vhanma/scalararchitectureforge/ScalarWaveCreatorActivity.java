package com.vhanma.scalararchitectureforge;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.Spinner;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class ScalarWaveCreatorActivity extends Activity {
    private static final int REQ_SAVE_WAV = 2101;
    private static final int REQ_SAVE_REPORT = 2102;

    private static final int BG = Color.rgb(5, 11, 13);
    private static final int CARD = Color.rgb(14, 31, 34);
    private static final int MINT = Color.rgb(131, 241, 215);
    private static final int PURPLE = Color.rgb(144, 114, 224);
    private static final int GOLD = Color.rgb(250, 203, 101);
    private static final int TEXT = Color.rgb(235, 244, 242);
    private static final int MUTED = Color.rgb(165, 193, 188);

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private Spinner waveformSpinner;
    private Spinner pairModeSpinner;
    private Spinner envelopeSpinner;
    private Spinner durationSpinner;
    private EditText carrierInput;
    private EditText messageInput;
    private EditText customEnvelopeInput;
    private EditText layersInput;
    private SeekBar depthBar;
    private SeekBar presenceBar;
    private SeekBar dutyBar;
    private SeekBar tiltBar;
    private TextView depthValue;
    private TextView presenceValue;
    private TextView dutyValue;
    private TextView tiltValue;
    private CheckBox goldenRatioBox;
    private CheckBox softClipBox;
    private Button createButton;
    private Button playButton;
    private Button saveWavButton;
    private Button saveReportButton;
    private Switch loopSwitch;
    private TextView statusText;
    private TextView detailText;
    private WaveView waveView;

    private ScalarWaveEngine.Result currentResult;
    private MediaPlayer mediaPlayer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        buildUi();
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

        TextView title = text("SCALAR WAVE CREATOR", 28, TEXT, true);
        title.setLetterSpacing(0.055f);
        root.addView(title);
        TextView subtitle = text(
                "Create a waveform from nothing: forward signal, opposing conjugate, vector cancellation, envelope, and lossless stereo WAV.",
                13.5f, MUTED, false);
        subtitle.setPadding(0, dp(5), 0, dp(13));
        root.addView(subtitle);

        LinearLayout presetCard = card();
        root.addView(presetCard, matchWrap(0));
        presetCard.addView(text("ONE-TAP PRESETS", 14, MINT, true));
        LinearLayout presetRow1 = row();
        presetCard.addView(presetRow1, matchWrap(dp(8)));
        Button beardenPreset = smallButton("BEARDEN PAIR", MINT, Color.rgb(34, 42, 76));
        Button schumannPreset = smallButton("7.83 / 432", PURPLE, Color.WHITE);
        Button dnaPreset = smallButton("DNA STACK", GOLD, Color.rgb(48, 38, 8));
        beardenPreset.setOnClickListener(v -> applyPreset(0));
        schumannPreset.setOnClickListener(v -> applyPreset(1));
        dnaPreset.setOnClickListener(v -> applyPreset(2));
        presetRow1.addView(beardenPreset, weighted(1f, dp(50)));
        LinearLayout.LayoutParams p2 = weighted(1f, dp(50));
        p2.setMarginStart(dp(7));
        presetRow1.addView(schumannPreset, p2);
        LinearLayout.LayoutParams p3 = weighted(1f, dp(50));
        p3.setMarginStart(dp(7));
        presetRow1.addView(dnaPreset, p3);

        LinearLayout generatorCard = card();
        root.addView(generatorCard, matchWrap(dp(12)));
        generatorCard.addView(text("WAVE GENERATOR", 15, MINT, true));

        waveformSpinner = spinner(new String[]{
                "Sine", "Harmonic stack", "Soliton packet", "Square",
                "Triangle", "Saw", "Pulse"
        });
        addLabeledSpinner(generatorCard, "Source waveform", waveformSpinner);

        pairModeSpinner = spinner(new String[]{
                "Phase-conjugate analogue",
                "180° anti-phase pair",
                "Counter-rotating pair",
                "Standing-wave hybrid"
        });
        addLabeledSpinner(generatorCard, "Paired-wave architecture", pairModeSpinner);

        carrierInput = numberInput("432", false);
        messageInput = numberInput("7.83", false);
        LinearLayout frequencyRow = row();
        generatorCard.addView(frequencyRow, matchWrap(dp(8)));
        frequencyRow.addView(labeledInput("Carrier Hz", carrierInput), weighted(1f, dp(78)));
        LinearLayout.LayoutParams msgParams = weighted(1f, dp(78));
        msgParams.setMarginStart(dp(8));
        frequencyRow.addView(labeledInput("Message Hz", messageInput), msgParams);

        envelopeSpinner = spinner(new String[]{
                "7.83 Hz Schumann", "None / constant", "0.1 Hz coherence",
                "3 Hz pulse", "6 Hz pulse", "9 Hz pulse", "40 Hz gamma",
                "Golden-ratio envelope", "Isochronic custom", "Custom sine"
        });
        addLabeledSpinner(generatorCard, "Longitudinal envelope", envelopeSpinner);

        customEnvelopeInput = numberInput("7.83", false);
        generatorCard.addView(labeledInput("Custom envelope frequency Hz", customEnvelopeInput),
                matchWrap(dp(7)));

        layersInput = new EditText(this);
        layersInput.setText("111, 144, 369, 528, 963");
        layersInput.setHint("Comma-separated frequencies");
        styleInput(layersInput);
        generatorCard.addView(labeledInput("Additional harmonic layers Hz", layersInput),
                matchWrap(dp(7)));

        durationSpinner = spinner(new String[]{
                "15 seconds", "30 seconds", "60 seconds", "180 seconds"
        });
        durationSpinner.setSelection(1);
        addLabeledSpinner(generatorCard, "Duration", durationSpinner);

        LinearLayout shapingCard = card();
        root.addView(shapingCard, matchWrap(dp(12)));
        shapingCard.addView(text("PHASE / ENVELOPE SHAPING", 15, MINT, true));

        depthBar = seek(0, 100, 72);
        depthValue = valueText("72%");
        addSlider(shapingCard, "Modulation depth", depthBar, depthValue);
        depthBar.setOnSeekBarChangeListener(simpleSeek(
                value -> depthValue.setText(value + "%")));

        presenceBar = seek(0, 100, 82);
        presenceValue = valueText("82%");
        addSlider(shapingCard, "Wave presence", presenceBar, presenceValue);
        presenceBar.setOnSeekBarChangeListener(simpleSeek(
                value -> presenceValue.setText(value + "%")));

        dutyBar = seek(2, 98, 50);
        dutyValue = valueText("50%");
        addSlider(shapingCard, "Pulse duty cycle", dutyBar, dutyValue);
        dutyBar.setOnSeekBarChangeListener(simpleSeek(
                value -> dutyValue.setText(value + "%")));

        tiltBar = seek(5, 100, 62);
        tiltValue = valueText("62%");
        addSlider(shapingCard, "Harmonic decay / tilt", tiltBar, tiltValue);
        tiltBar.setOnSeekBarChangeListener(simpleSeek(
                value -> tiltValue.setText(value + "%")));

        goldenRatioBox = checkBox("Golden-ratio phase staggering", true);
        softClipBox = checkBox("Smooth saturation instead of hard clipping", true);
        shapingCard.addView(goldenRatioBox, matchWrap(dp(5)));
        shapingCard.addView(softClipBox, matchWrap(0));

        createButton = button("CREATE SCALAR WAVE", MINT, Color.rgb(34, 42, 76));
        createButton.setOnClickListener(v -> createWave());
        LinearLayout.LayoutParams createParams = matchWrap(dp(12));
        createParams.height = dp(64);
        root.addView(createButton, createParams);

        LinearLayout statusCard = card();
        root.addView(statusCard, matchWrap(dp(12)));
        statusText = text("READY", 18, MINT, true);
        detailText = text(
                "The default creates a 432 Hz carrier with a 7.83 Hz envelope and time-reversed polarity-inverted stereo partner.",
                13, TEXT, false);
        detailText.setPadding(0, dp(8), 0, 0);
        statusCard.addView(statusText);
        statusCard.addView(detailText);

        LinearLayout playRow = row();
        root.addView(playRow, matchWrap(dp(12)));
        playButton = button("PLAY", PURPLE, Color.WHITE);
        playButton.setOnClickListener(v -> togglePlayback());
        playRow.addView(playButton, weighted(1f, dp(56)));
        loopSwitch = new Switch(this);
        loopSwitch.setText("Loop");
        loopSwitch.setTextColor(TEXT);
        loopSwitch.setTextSize(13);
        loopSwitch.setPadding(dp(12), 0, 0, 0);
        loopSwitch.setOnCheckedChangeListener((buttonView, checked) -> {
            if (mediaPlayer != null) mediaPlayer.setLooping(checked);
        });
        playRow.addView(loopSwitch, wrapWrap());

        waveView = new WaveView(this);
        LinearLayout.LayoutParams waveParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(690));
        waveParams.topMargin = dp(12);
        root.addView(waveView, waveParams);

        LinearLayout saveRow = row();
        root.addView(saveRow, matchWrap(dp(12)));
        saveWavButton = button("SAVE LOSSLESS WAV", MINT, Color.rgb(34, 42, 76));
        saveReportButton = button("SAVE SETTINGS", GOLD, Color.rgb(48, 38, 8));
        saveWavButton.setOnClickListener(v -> saveWav());
        saveReportButton.setOnClickListener(v -> saveReport());
        saveRow.addView(saveWavButton, weighted(1f, dp(58)));
        LinearLayout.LayoutParams reportParams = weighted(1f, dp(58));
        reportParams.setMarginStart(dp(9));
        saveRow.addView(saveReportButton, reportParams);

        setResultEnabled(false);

        LinearLayout explanationCard = card();
        root.addView(explanationCard, matchWrap(dp(12)));
        explanationCard.addView(text("WHAT IT CREATES", 14, GOLD, true));
        TextView explanation = text(
                "FORWARD → selected source waveform and information envelope\n\n"
                        + "CONJUGATE ← opposing or time-reversed partner selected above\n\n"
                        + "VECTOR SUM → ordinary paired-wave cancellation preview\n\n"
                        + "LONGITUDINAL ENVELOPE → compression and thinning pattern\n\n"
                        + "PRESSURE DENSITY → magnitude difference between the paired channels",
                13, TEXT, false);
        explanation.setPadding(0, dp(8), 0, 0);
        explanationCard.addView(explanation);

        TextView note = text(
                "This produces a Bearden-inspired audio-domain paired-wave simulation. The visualizer exposes both hidden channels instead of collapsing them into one ordinary waveform.",
                12, MUTED, false);
        note.setPadding(0, dp(13), 0, 0);
        root.addView(note);

        setContentView(scroll);
    }

    private void applyPreset(int preset) {
        if (preset == 0) {
            waveformSpinner.setSelection(0);
            pairModeSpinner.setSelection(0);
            envelopeSpinner.setSelection(0);
            carrierInput.setText("432");
            messageInput.setText("7.83");
            customEnvelopeInput.setText("7.83");
            layersInput.setText("");
            depthBar.setProgress(70);
            presenceBar.setProgress(82);
            goldenRatioBox.setChecked(false);
        } else if (preset == 1) {
            waveformSpinner.setSelection(1);
            pairModeSpinner.setSelection(0);
            envelopeSpinner.setSelection(0);
            carrierInput.setText("432");
            messageInput.setText("7.83");
            customEnvelopeInput.setText("7.83");
            layersInput.setText("111, 144, 369");
            depthBar.setProgress(78);
            presenceBar.setProgress(78);
            goldenRatioBox.setChecked(true);
        } else {
            waveformSpinner.setSelection(1);
            pairModeSpinner.setSelection(0);
            envelopeSpinner.setSelection(7);
            carrierInput.setText("528");
            messageInput.setText("7.83");
            customEnvelopeInput.setText("7.83");
            layersInput.setText("111, 144, 369, 432, 528, 936, 963, 1728");
            depthBar.setProgress(84);
            presenceBar.setProgress(72);
            goldenRatioBox.setChecked(true);
        }
        createWave();
    }

    private void createWave() {
        ScalarWaveEngine.Config config;
        try {
            config = readConfig();
        } catch (Exception e) {
            Toast.makeText(this, e.getMessage(), Toast.LENGTH_LONG).show();
            return;
        }
        stopPlayback();
        currentResult = null;
        waveView.clear();
        setBusy(true);
        statusText.setText("CREATING PAIRED WAVE…");
        detailText.setText(config.waveform + " • " + config.carrierHz + " Hz • "
                + config.pairMode + " • " + config.durationSeconds + " seconds");

        worker.execute(() -> {
            try {
                File output = new File(getCacheDir(), "scalar_wave_creator_v21.wav");
                ScalarWaveEngine.Result result = ScalarWaveEngine.create(output, config);
                mainHandler.post(() -> {
                    currentResult = result;
                    waveView.setData(result.preview);
                    statusText.setText("SCALAR WAVE READY");
                    detailText.setText(String.format(Locale.US,
                            "%s • %.3f Hz carrier • %.3f Hz envelope • %.2f MB • stereo 48 kHz",
                            config.pairMode, config.carrierHz, config.envelopeHz(),
                            result.wavFile.length() / 1048576.0));
                    setBusy(false);
                    setResultEnabled(true);
                });
            } catch (Exception e) {
                mainHandler.post(() -> {
                    setBusy(false);
                    setResultEnabled(false);
                    statusText.setText("CREATION FAILED");
                    detailText.setText(e.getMessage() == null ? e.toString() : e.getMessage());
                });
            }
        });
    }

    private ScalarWaveEngine.Config readConfig() {
        ScalarWaveEngine.Config config = new ScalarWaveEngine.Config();
        config.waveform = String.valueOf(waveformSpinner.getSelectedItem());
        config.pairMode = String.valueOf(pairModeSpinner.getSelectedItem());
        config.envelopeMode = String.valueOf(envelopeSpinner.getSelectedItem());
        config.carrierHz = parse(carrierInput, "Carrier frequency");
        config.messageHz = parse(messageInput, "Message frequency");
        config.customEnvelopeHz = parse(customEnvelopeInput, "Custom envelope frequency");
        if (config.carrierHz < 1 || config.carrierHz > 21984) {
            throw new IllegalArgumentException("Carrier must be between 1 Hz and 21,984 Hz for the phone WAV.");
        }
        if (config.messageHz < 0 || config.messageHz > 2000) {
            throw new IllegalArgumentException("Message frequency must be between 0 and 2,000 Hz.");
        }
        config.layerText = layersInput.getText().toString();
        config.modulationDepth = depthBar.getProgress() / 100.0;
        config.presence = presenceBar.getProgress() / 100.0;
        config.pulseDuty = dutyBar.getProgress() / 100.0;
        config.harmonicTilt = tiltBar.getProgress() / 100.0;
        config.goldenRatioPhase = goldenRatioBox.isChecked();
        config.softClip = softClipBox.isChecked();
        int[] durations = {15, 30, 60, 180};
        config.durationSeconds = durations[Math.max(0,
                Math.min(durations.length - 1, durationSpinner.getSelectedItemPosition()))];
        return config;
    }

    private double parse(EditText input, String label) {
        try {
            return Double.parseDouble(input.getText().toString().trim());
        } catch (Exception e) {
            throw new IllegalArgumentException(label + " is missing or invalid.");
        }
    }

    private void togglePlayback() {
        if (currentResult == null || !currentResult.wavFile.exists()) return;
        try {
            if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                mediaPlayer.pause();
                playButton.setText("PLAY");
                return;
            }
            if (mediaPlayer == null) {
                mediaPlayer = new MediaPlayer();
                mediaPlayer.setDataSource(currentResult.wavFile.getAbsolutePath());
                mediaPlayer.setLooping(loopSwitch.isChecked());
                mediaPlayer.setOnCompletionListener(mp -> playButton.setText("PLAY"));
                mediaPlayer.prepare();
            }
            mediaPlayer.start();
            playButton.setText("PAUSE");
        } catch (Exception e) {
            Toast.makeText(this, "Playback failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
            stopPlayback();
        }
    }

    private void stopPlayback() {
        if (mediaPlayer != null) {
            try {
                mediaPlayer.stop();
            } catch (Exception ignored) {
            }
            mediaPlayer.release();
            mediaPlayer = null;
        }
        if (playButton != null) playButton.setText("PLAY");
    }

    private void saveWav() {
        if (currentResult == null) return;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("audio/wav");
        intent.putExtra(Intent.EXTRA_TITLE, "Scalar-Wave-Creator-v2.1.wav");
        startActivityForResult(intent, REQ_SAVE_WAV);
    }

    private void saveReport() {
        if (currentResult == null) return;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, "Scalar-Wave-Creator-v2.1-settings.json");
        startActivityForResult(intent, REQ_SAVE_REPORT);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null || currentResult == null) return;
        Uri destination = data.getData();
        if (requestCode == REQ_SAVE_WAV) copyWav(destination);
        else if (requestCode == REQ_SAVE_REPORT) copyReport(destination);
    }

    private void copyWav(Uri destination) {
        setBusy(true);
        worker.execute(() -> {
            try (BufferedInputStream in = new BufferedInputStream(
                    new FileInputStream(currentResult.wavFile));
                 OutputStream out = new BufferedOutputStream(requireOutput(destination))) {
                byte[] buffer = new byte[128 * 1024];
                int read;
                while ((read = in.read(buffer)) >= 0) out.write(buffer, 0, read);
                out.flush();
                mainHandler.post(() -> saved("LOSSLESS WAV SAVED"));
            } catch (Exception e) {
                mainHandler.post(() -> saveFailed(e));
            }
        });
    }

    private void copyReport(Uri destination) {
        setBusy(true);
        worker.execute(() -> {
            try (OutputStream out = new BufferedOutputStream(requireOutput(destination))) {
                out.write(currentResult.report.getBytes(StandardCharsets.UTF_8));
                out.flush();
                mainHandler.post(() -> saved("SETTINGS REPORT SAVED"));
            } catch (Exception e) {
                mainHandler.post(() -> saveFailed(e));
            }
        });
    }

    private OutputStream requireOutput(Uri destination) throws IOException {
        OutputStream out = getContentResolver().openOutputStream(destination, "w");
        if (out == null) throw new IOException("Android could not create the destination file.");
        return out;
    }

    private void saved(String message) {
        setBusy(false);
        setResultEnabled(true);
        statusText.setText(message);
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    private void saveFailed(Exception e) {
        setBusy(false);
        setResultEnabled(true);
        statusText.setText("SAVE FAILED");
        Toast.makeText(this, e.getMessage(), Toast.LENGTH_LONG).show();
    }

    private void setBusy(boolean busy) {
        createButton.setEnabled(!busy);
        createButton.setAlpha(busy ? 0.45f : 1f);
        if (busy) setResultEnabled(false);
    }

    private void setResultEnabled(boolean enabled) {
        playButton.setEnabled(enabled);
        saveWavButton.setEnabled(enabled);
        saveReportButton.setEnabled(enabled);
        float alpha = enabled ? 1f : 0.45f;
        playButton.setAlpha(alpha);
        saveWavButton.setAlpha(alpha);
        saveReportButton.setAlpha(alpha);
    }

    private void addLabeledSpinner(LinearLayout parent, String label, Spinner spinner) {
        LinearLayout line = row();
        line.setGravity(Gravity.CENTER_VERTICAL);
        parent.addView(line, matchWrap(dp(8)));
        line.addView(text(label, 12.5f, MUTED, false), weighted(0.75f, dp(50)));
        line.addView(spinner, weighted(1f, dp(50)));
    }

    private LinearLayout labeledInput(String label, EditText input) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.addView(text(label, 12, MUTED, false));
        LinearLayout.LayoutParams inputParams = matchWrap(dp(4));
        inputParams.height = dp(48);
        box.addView(input, inputParams);
        return box;
    }

    private EditText numberInput(String value, boolean integer) {
        EditText input = new EditText(this);
        input.setText(value);
        input.setSingleLine(true);
        input.setInputType(integer
                ? android.text.InputType.TYPE_CLASS_NUMBER
                : android.text.InputType.TYPE_CLASS_NUMBER
                | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        styleInput(input);
        return input;
    }

    private void styleInput(EditText input) {
        input.setTextColor(TEXT);
        input.setHintTextColor(Color.rgb(99, 129, 126));
        input.setTextSize(14);
        input.setPadding(dp(11), dp(8), dp(11), dp(8));
        input.setBackground(rounded(Color.rgb(7, 20, 23), Color.rgb(42, 76, 77), 11));
    }

    private void addSlider(LinearLayout parent, String label, SeekBar bar, TextView value) {
        LinearLayout header = row();
        header.setGravity(Gravity.CENTER_VERTICAL);
        parent.addView(header, matchWrap(dp(6)));
        header.addView(text(label, 12.5f, MUTED, false), weighted(1f, dp(32)));
        header.addView(value, wrapWrap());
        parent.addView(bar, matchWrap(0));
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

    private SeekBar seek(int min, int max, int progress) {
        SeekBar bar = new SeekBar(this);
        bar.setMin(min);
        bar.setMax(max);
        bar.setProgress(progress);
        return bar;
    }

    private SeekBar.OnSeekBarChangeListener simpleSeek(IntAction action) {
        return new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                action.accept(progress);
            }

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
            }

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
            }
        };
    }

    private CheckBox checkBox(String label, boolean checked) {
        CheckBox box = new CheckBox(this);
        box.setText(label);
        box.setTextColor(TEXT);
        box.setTextSize(13);
        box.setChecked(checked);
        return box;
    }

    private LinearLayout card() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(17), dp(16), dp(17), dp(16));
        layout.setBackground(rounded(CARD, Color.rgb(28, 58, 61), 19));
        return layout;
    }

    private LinearLayout row() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        return row;
    }

    private Button button(String label, int background, int foreground) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(foreground);
        button.setTextSize(13);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        button.setBackground(rounded(background, background, 28));
        return button;
    }

    private Button smallButton(String label, int background, int foreground) {
        Button button = button(label, background, foreground);
        button.setTextSize(11.5f);
        button.setPadding(dp(4), 0, dp(4), 0);
        return button;
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

    private TextView valueText(String value) {
        return text(value, 12.5f, GOLD, true);
    }

    private GradientDrawable rounded(int fill, int stroke, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(radiusDp));
        drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private LinearLayout.LayoutParams weighted(float weight, int height) {
        return new LinearLayout.LayoutParams(0, height, weight);
    }

    private LinearLayout.LayoutParams matchWrap(int topMargin) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = topMargin;
        return params;
    }

    private LinearLayout.LayoutParams wrapWrap() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        stopPlayback();
        worker.shutdownNow();
        super.onDestroy();
    }

    private interface IntAction {
        void accept(int value);
    }

    private static final class WaveView extends View {
        private static final int BG = Color.rgb(5, 11, 13);
        private static final int CARD = Color.rgb(14, 31, 34);
        private static final int ALT = Color.rgb(8, 22, 25);
        private static final int MINT = Color.rgb(131, 241, 215);
        private static final int PURPLE = Color.rgb(144, 114, 224);
        private static final int GOLD = Color.rgb(250, 203, 101);
        private static final int TEXT = Color.rgb(235, 244, 242);
        private static final int MUTED = Color.rgb(165, 193, 188);

        private final Paint panel = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint grid = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint label = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint note = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF rect = new RectF();
        private final Path path = new Path();
        private final Handler handler = new Handler(Looper.getMainLooper());
        private ScalarWaveEngine.Preview data;
        private float phase;
        private boolean animating;

        private final Runnable ticker = new Runnable() {
            @Override
            public void run() {
                if (!animating) return;
                phase += 0.9f;
                invalidate();
                handler.postDelayed(this, 32);
            }
        };

        WaveView(Activity context) {
            super(context);
            setLayerType(View.LAYER_TYPE_SOFTWARE, null);
            panel.setStyle(Paint.Style.FILL);
            line.setStyle(Paint.Style.STROKE);
            line.setStrokeWidth(dp(1.2f));
            line.setStrokeCap(Paint.Cap.ROUND);
            line.setStrokeJoin(Paint.Join.ROUND);
            grid.setColor(Color.rgb(48, 79, 80));
            grid.setStrokeWidth(dp(1));
            label.setColor(TEXT);
            label.setTextSize(sp(13));
            label.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            note.setColor(MUTED);
            note.setTextSize(sp(10.5f));
            fill.setStyle(Paint.Style.FILL);
        }

        void setData(ScalarWaveEngine.Preview data) {
            this.data = data;
            animating = true;
            handler.removeCallbacks(ticker);
            handler.post(ticker);
            invalidate();
        }

        void clear() {
            data = null;
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
            float gap = dp(9);
            float height = (getHeight() - gap * 4f) / 5f;
            drawPanel(canvas, 0, 0, height, "FORWARD COMPONENT", "moves →",
                    data == null ? null : data.forward, MINT, 1, false);
            drawPanel(canvas, 1, height + gap, height, "CONJUGATE COMPONENT", "moves ←",
                    data == null ? null : data.conjugate, PURPLE, -1, false);
            drawPanel(canvas, 2, (height + gap) * 2f, height, "VECTOR SUM", "ordinary cancellation",
                    data == null ? null : data.vectorSum, GOLD, 0, false);
            drawPanel(canvas, 3, (height + gap) * 3f, height, "LONGITUDINAL ENVELOPE", "compression / thinning",
                    data == null ? null : data.envelope, MINT, 0, true);
            drawPanel(canvas, 4, (height + gap) * 4f, height, "PRESSURE-DENSITY PREVIEW", "paired magnitude",
                    data == null ? null : data.pressureDensity, PURPLE, 0, true);
        }

        private void drawPanel(Canvas canvas, int index, float top, float height,
                               String title, String rightText, float[] samples,
                               int color, int direction, boolean envelope) {
            panel.setColor(index == 2 ? ALT : CARD);
            rect.set(0, top, getWidth(), top + height);
            canvas.drawRoundRect(rect, dp(17), dp(17), panel);
            canvas.drawText(title, dp(14), top + dp(23), label);
            canvas.drawText(rightText, getWidth() - dp(14) - note.measureText(rightText),
                    top + dp(23), note);
            float left = dp(13);
            float right = getWidth() - dp(13);
            float graphTop = top + dp(33);
            float bottom = top + height - dp(10);
            float center = (graphTop + bottom) / 2f;
            canvas.drawLine(left, center, right, center, grid);
            if (samples == null || samples.length < 2) {
                canvas.drawText("Create a wave to reveal this layer", left,
                        center + dp(4), note);
                return;
            }
            if (envelope) drawEnvelope(canvas, samples, left, right, graphTop, bottom, color);
            else drawWave(canvas, samples, left, right, graphTop, bottom, color, direction);
        }

        private void drawWave(Canvas canvas, float[] samples, float left, float right,
                              float top, float bottom, int color, int direction) {
            path.reset();
            float width = right - left;
            float center = (top + bottom) / 2f;
            float amplitude = (bottom - top) * 0.43f;
            int points = Math.min(samples.length, Math.max(240, (int) width));
            int offset = direction == 0 ? 0 : (int) phase * direction;
            for (int i = 0; i < points; i++) {
                int raw = Math.round(i * (samples.length - 1f) / (points - 1f));
                int index = (raw + offset) % samples.length;
                if (index < 0) index += samples.length;
                float x = left + i * width / (points - 1f);
                float y = center - clamp(samples[index], -1, 1) * amplitude;
                if (i == 0) path.moveTo(x, y);
                else path.lineTo(x, y);
            }
            line.setColor(color);
            line.setShadowLayer(dp(4), 0, 0,
                    Color.argb(85, Color.red(color), Color.green(color), Color.blue(color)));
            canvas.drawPath(path, line);
            line.clearShadowLayer();
        }

        private void drawEnvelope(Canvas canvas, float[] samples, float left, float right,
                                  float top, float bottom, int color) {
            float width = right - left;
            float center = (top + bottom) / 2f;
            float amplitude = (bottom - top) * 0.43f;
            int points = Math.min(samples.length, Math.max(240, (int) width));
            path.reset();
            for (int i = 0; i < points; i++) {
                int index = Math.round(i * (samples.length - 1f) / (points - 1f));
                float x = left + i * width / (points - 1f);
                float y = center - clamp(samples[index], 0, 1) * amplitude;
                if (i == 0) path.moveTo(x, y);
                else path.lineTo(x, y);
            }
            for (int i = points - 1; i >= 0; i--) {
                int index = Math.round(i * (samples.length - 1f) / (points - 1f));
                float x = left + i * width / (points - 1f);
                float y = center + clamp(samples[index], 0, 1) * amplitude;
                path.lineTo(x, y);
            }
            path.close();
            fill.setColor(Color.argb(44, Color.red(color), Color.green(color), Color.blue(color)));
            canvas.drawPath(path, fill);
            line.setColor(color);
            canvas.drawPath(path, line);
        }

        private float dp(float value) {
            return value * getResources().getDisplayMetrics().density;
        }

        private float sp(float value) {
            return value * getResources().getDisplayMetrics().scaledDensity;
        }

        private static float clamp(float value, float min, float max) {
            return Math.max(min, Math.min(max, value));
        }
    }
}
