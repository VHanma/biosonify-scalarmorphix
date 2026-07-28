package com.vhanma.scalararchitectureforge;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
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
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int REQ_OPEN_IMAGE = 1101;
    private static final int REQ_OPEN_AUDIO = 1102;
    private static final int REQ_SAVE_WAV = 1103;
    private static final int REQ_SAVE_REPORT = 1104;

    private static final int BG = Color.rgb(5, 11, 13);
    private static final int CARD = Color.rgb(14, 31, 34);
    private static final int MINT = Color.rgb(131, 241, 215);
    private static final int PURPLE = Color.rgb(144, 114, 224);
    private static final int GOLD = Color.rgb(250, 203, 101);
    private static final int TEXT = Color.rgb(235, 244, 242);
    private static final int MUTED = Color.rgb(165, 193, 188);

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final ArchitectureConfig config = new ArchitectureConfig();
    private Uri selectedUri;
    private SourceType sourceType = SourceType.TEXT;
    private AudioEngine.Result currentResult;
    private MediaPlayer mediaPlayer;

    private Button imageButton;
    private Button audioButton;
    private Button textButton;
    private Button forgeButton;
    private Button playButton;
    private Button saveWavButton;
    private Button saveReportButton;
    private Switch loopSwitch;
    private Switch simultaneousSwitch;
    private Switch resonanceSwitch;
    private EditText intentionInput;
    private Spinner emotionSpinner;
    private Spinner durationSpinner;
    private final CheckBox[] modeBoxes = new CheckBox[6];
    private SeekBar topRatioBar;
    private SeekBar bottomRatioBar;
    private SeekBar spinBar;
    private SeekBar baseFrequencyBar;
    private SeekBar stepScaleBar;
    private SeekBar presenceBar;
    private TextView ratioValue;
    private TextView spinValue;
    private TextView baseFrequencyValue;
    private TextView stepScaleValue;
    private TextView presenceValue;
    private TextView sourceValue;
    private TextView statusValue;
    private TextView detailValue;
    private ArchitectureView architectureView;

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

        TextView title = text("SCALAR ARCHITECTURE FORGE", 27, TEXT, true);
        title.setLetterSpacing(0.045f);
        root.addView(title);
        TextView subtitle = text(
                "144 Fire-Letter map • 15 dimensional bands • 34:21 / custom spin • phase-pair WAV",
                13, MUTED, false);
        subtitle.setPadding(0, dp(4), 0, dp(12));
        root.addView(subtitle);

        LinearLayout sourceRow = new LinearLayout(this);
        sourceRow.setOrientation(LinearLayout.HORIZONTAL);
        root.addView(sourceRow, matchWrap(0));
        imageButton = button("IMAGE", MINT, Color.rgb(34, 42, 76));
        audioButton = button("AUDIO", PURPLE, Color.WHITE);
        textButton = button("TEXT", GOLD, Color.rgb(48, 38, 8));
        imageButton.setOnClickListener(v -> openSource("image/*", REQ_OPEN_IMAGE));
        audioButton.setOnClickListener(v -> openSource("audio/*", REQ_OPEN_AUDIO));
        textButton.setOnClickListener(v -> {
            sourceType = SourceType.TEXT;
            selectedUri = null;
            forgeCurrent();
        });
        sourceRow.addView(imageButton, weighted(1f, dp(54)));
        LinearLayout.LayoutParams audioParams = weighted(1f, dp(54));
        audioParams.setMarginStart(dp(8));
        sourceRow.addView(audioButton, audioParams);
        LinearLayout.LayoutParams textParams = weighted(1f, dp(54));
        textParams.setMarginStart(dp(8));
        sourceRow.addView(textButton, textParams);

        LinearLayout intentionCard = card();
        root.addView(intentionCard, matchWrap(dp(12)));
        intentionCard.addView(text("INTENTION / INFORMATION CODE", 14, MINT, true));
        intentionInput = new EditText(this);
        intentionInput.setHint("Type any text to fold into the deterministic 144-code sequence");
        intentionInput.setHintTextColor(Color.rgb(100, 133, 130));
        intentionInput.setTextColor(TEXT);
        intentionInput.setTextSize(14);
        intentionInput.setMinLines(2);
        intentionInput.setGravity(Gravity.TOP | Gravity.START);
        intentionInput.setPadding(dp(12), dp(10), dp(12), dp(10));
        intentionInput.setBackground(rounded(Color.rgb(7, 20, 23), Color.rgb(42, 76, 77), 12));
        LinearLayout.LayoutParams intentionParams = matchWrap(dp(9));
        intentionCard.addView(intentionInput, intentionParams);

        LinearLayout emotionRow = new LinearLayout(this);
        emotionRow.setOrientation(LinearLayout.HORIZONTAL);
        emotionRow.setGravity(Gravity.CENTER_VERTICAL);
        emotionRow.setPadding(0, dp(10), 0, 0);
        intentionCard.addView(emotionRow);
        emotionRow.addView(text("Symbolic state", 13, MUTED, false), weighted(0.55f, dp(48)));
        emotionSpinner = spinner(new String[]{
                "Neutral", "Power", "Calm", "Focus", "Transformation",
                "Protection", "Integration", "Custom intention"
        });
        emotionRow.addView(emotionSpinner, weighted(1f, dp(48)));

        LinearLayout modesCard = card();
        root.addView(modesCard, matchWrap(dp(12)));
        LinearLayout modeHeader = new LinearLayout(this);
        modeHeader.setOrientation(LinearLayout.HORIZONTAL);
        modeHeader.setGravity(Gravity.CENTER_VERTICAL);
        modesCard.addView(modeHeader);
        modeHeader.addView(text("HARMONIC UNIVERSE MODES", 14, MINT, true), weighted(1f, dp(42)));
        simultaneousSwitch = switchView("All 15D", true);
        modeHeader.addView(simultaneousSwitch, wrapWrap());

        for (int row = 0; row < 3; row++) {
            LinearLayout pair = new LinearLayout(this);
            pair.setOrientation(LinearLayout.HORIZONTAL);
            modesCard.addView(pair, matchWrap(dp(2)));
            for (int col = 0; col < 2; col++) {
                int index = row * 2 + col;
                CheckBox box = new CheckBox(this);
                box.setText(ArchitectureConfig.MODE_NAMES[index] + "  D"
                        + ArchitectureConfig.MODE_DIMENSIONS[index][0] + "/D"
                        + ArchitectureConfig.MODE_DIMENSIONS[index][1]);
                box.setTextColor(TEXT);
                box.setTextSize(12.5f);
                box.setChecked(true);
                box.setEnabled(false);
                modeBoxes[index] = box;
                pair.addView(box, weighted(1f, dp(44)));
            }
        }
        simultaneousSwitch.setOnCheckedChangeListener((buttonView, isChecked) -> {
            for (CheckBox box : modeBoxes) {
                box.setEnabled(!isChecked);
                if (isChecked) box.setChecked(true);
            }
        });

        LinearLayout ratioCard = card();
        root.addView(ratioCard, matchWrap(dp(12)));
        LinearLayout ratioHeader = new LinearLayout(this);
        ratioHeader.setOrientation(LinearLayout.HORIZONTAL);
        ratioHeader.setGravity(Gravity.CENTER_VERTICAL);
        ratioCard.addView(ratioHeader);
        ratioHeader.addView(text("MERKABA SPIN RATIO", 14, MINT, true), weighted(1f, dp(40)));
        ratioValue = text("34:21 natural preset", 13, GOLD, true);
        ratioHeader.addView(ratioValue, wrapWrap());

        topRatioBar = seek(1, 64, 34);
        bottomRatioBar = seek(1, 64, 21);
        addSlider(ratioCard, "Magnetic / counter-clockwise", topRatioBar, null);
        addSlider(ratioCard, "Electrical / clockwise", bottomRatioBar, null);
        SeekBar.OnSeekBarChangeListener ratioListener = simpleSeek(progress -> updateRatioLabel());
        topRatioBar.setOnSeekBarChangeListener(ratioListener);
        bottomRatioBar.setOnSeekBarChangeListener(ratioListener);

        LinearLayout presetRow = new LinearLayout(this);
        presetRow.setOrientation(LinearLayout.HORIZONTAL);
        ratioCard.addView(presetRow, matchWrap(dp(7)));
        Button naturalButton = button("34:21 NATURAL", MINT, Color.rgb(34, 42, 76));
        Button reverseButton = button("21:34 REVERSE", PURPLE, Color.WHITE);
        Button equalButton = button("1:1 BALANCED", Color.rgb(53, 81, 82), TEXT);
        naturalButton.setOnClickListener(v -> setRatio(34, 21));
        reverseButton.setOnClickListener(v -> setRatio(21, 34));
        equalButton.setOnClickListener(v -> setRatio(1, 1));
        presetRow.addView(naturalButton, weighted(1f, dp(50)));
        LinearLayout.LayoutParams reverseParams = weighted(1f, dp(50));
        reverseParams.setMarginStart(dp(7));
        presetRow.addView(reverseButton, reverseParams);
        LinearLayout.LayoutParams equalParams = weighted(1f, dp(50));
        equalParams.setMarginStart(dp(7));
        presetRow.addView(equalButton, equalParams);

        spinBar = seek(0, 90, 45);
        spinValue = valueText("45°");
        addSlider(ratioCard, "Harmonic-universe spin shift", spinBar, spinValue);
        spinBar.setOnSeekBarChangeListener(simpleSeek(progress -> spinValue.setText(progress + "°")));

        LinearLayout frequencyCard = card();
        root.addView(frequencyCard, matchWrap(dp(12)));
        frequencyCard.addView(text("ELECTRO-TONAL MAPPING", 14, MINT, true));
        baseFrequencyBar = seek(20, 220, 55);
        baseFrequencyValue = valueText("55 Hz");
        addSlider(frequencyCard, "D-1 audible base", baseFrequencyBar, baseFrequencyValue);
        baseFrequencyBar.setOnSeekBarChangeListener(simpleSeek(
                progress -> baseFrequencyValue.setText(progress + " Hz")));

        stepScaleBar = seek(25, 200, 100);
        stepScaleValue = valueText("100%");
        addSlider(frequencyCard, "Step down / step up scale", stepScaleBar, stepScaleValue);
        stepScaleBar.setOnSeekBarChangeListener(simpleSeek(
                progress -> stepScaleValue.setText(progress + "%")));

        presenceBar = seek(0, 100, 82);
        presenceValue = valueText("82%");
        addSlider(frequencyCard, "Architecture presence", presenceBar, presenceValue);
        presenceBar.setOnSeekBarChangeListener(simpleSeek(
                progress -> presenceValue.setText(progress + "%")));

        resonanceSwitch = switchView("Base-to-base / overtone-to-overtone resonance lock", true);
        frequencyCard.addView(resonanceSwitch, matchWrap(dp(7)));

        LinearLayout durationRow = new LinearLayout(this);
        durationRow.setOrientation(LinearLayout.HORIZONTAL);
        durationRow.setGravity(Gravity.CENTER_VERTICAL);
        frequencyCard.addView(durationRow, matchWrap(dp(6)));
        durationRow.addView(text("Generated image/text duration", 13, MUTED, false), weighted(1f, dp(48)));
        durationSpinner = spinner(new String[]{"12 seconds", "24 seconds", "48 seconds", "90 seconds"});
        durationSpinner.setSelection(1);
        durationRow.addView(durationSpinner, weighted(0.7f, dp(48)));

        forgeButton = button("FORGE / REFORGE CURRENT SOURCE", MINT, Color.rgb(34, 42, 76));
        forgeButton.setOnClickListener(v -> forgeCurrent());
        LinearLayout.LayoutParams forgeParams = matchWrap(dp(12));
        forgeParams.height = dp(62);
        root.addView(forgeButton, forgeParams);

        LinearLayout statusCard = card();
        root.addView(statusCard, matchWrap(dp(12)));
        statusValue = text("READY", 18, MINT, true);
        sourceValue = text("Source: text / intention", 14, TEXT, false);
        detailValue = text("Select an image or audio file, or type an intention and tap TEXT.", 13, MUTED, false);
        sourceValue.setPadding(0, dp(8), 0, 0);
        detailValue.setPadding(0, dp(7), 0, 0);
        statusCard.addView(statusValue);
        statusCard.addView(sourceValue);
        statusCard.addView(detailValue);

        LinearLayout playbackRow = new LinearLayout(this);
        playbackRow.setOrientation(LinearLayout.HORIZONTAL);
        root.addView(playbackRow, matchWrap(dp(12)));
        playButton = button("PLAY", PURPLE, Color.WHITE);
        playButton.setOnClickListener(v -> togglePlayback());
        playButton.setEnabled(false);
        playButton.setAlpha(0.45f);
        playbackRow.addView(playButton, weighted(1f, dp(55)));
        loopSwitch = switchView("Loop", false);
        loopSwitch.setPadding(dp(12), 0, 0, 0);
        loopSwitch.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if (mediaPlayer != null) mediaPlayer.setLooping(isChecked);
        });
        playbackRow.addView(loopSwitch, wrapWrap());

        architectureView = new ArchitectureView(this);
        LinearLayout.LayoutParams viewParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(1240));
        viewParams.topMargin = dp(12);
        root.addView(architectureView, viewParams);

        LinearLayout saveRow = new LinearLayout(this);
        saveRow.setOrientation(LinearLayout.HORIZONTAL);
        root.addView(saveRow, matchWrap(dp(12)));
        saveWavButton = button("SAVE WAV", MINT, Color.rgb(34, 42, 76));
        saveReportButton = button("SAVE CODE REPORT", GOLD, Color.rgb(48, 38, 8));
        saveWavButton.setOnClickListener(v -> saveWav());
        saveReportButton.setOnClickListener(v -> saveReport());
        saveWavButton.setEnabled(false);
        saveReportButton.setEnabled(false);
        saveWavButton.setAlpha(0.45f);
        saveReportButton.setAlpha(0.45f);
        saveRow.addView(saveWavButton, weighted(1f, dp(56)));
        LinearLayout.LayoutParams reportParams = weighted(1f, dp(56));
        reportParams.setMarginStart(dp(9));
        saveRow.addView(saveReportButton, reportParams);

        LinearLayout pipelineCard = card();
        root.addView(pipelineCard, matchWrap(dp(12)));
        pipelineCard.addView(text("COMPLETE INFORMATION PIPELINE", 14, GOLD, true));
        TextView pipeline = text(
                "Image / audio / text\n" +
                        "↓ Spinor-style spectrum extraction\n" +
                        "↓ 144 Fire-Letter sequence generation\n" +
                        "↓ 34:21, 21:34, or custom ratio encoding\n" +
                        "↓ 15-band electro-tonal synthesis across HU-1 to HU-5\n" +
                        "↓ Forward + reversed polarity-inverted stereo phase pair\n" +
                        "↓ Lossless WAV + complete deterministic code report",
                13, TEXT, false);
        pipeline.setPadding(0, dp(9), 0, 0);
        pipelineCard.addView(pipeline);

        TextView note = text(
                "Every source receives a SHA-256-linked 12 × 12 code map, so different image or file data produces a different deterministic sequence. Experimental symbolic audio architecture only; no claim that the phone detects or creates a physical scalar, DNA, healing, consciousness, or planetary field.",
                12, MUTED, false);
        note.setPadding(0, dp(12), 0, 0);
        root.addView(note);

        setContentView(scroll);
    }

    private void openSource(String mime, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        startActivityForResult(intent, requestCode);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
        if (requestCode == REQ_OPEN_IMAGE || requestCode == REQ_OPEN_AUDIO) {
            try {
                getContentResolver().takePersistableUriPermission(
                        uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (SecurityException ignored) {
            }
            selectedUri = uri;
            sourceType = requestCode == REQ_OPEN_IMAGE ? SourceType.IMAGE : SourceType.AUDIO;
            forgeCurrent();
        } else if (requestCode == REQ_SAVE_WAV) {
            copyWav(uri);
        } else if (requestCode == REQ_SAVE_REPORT) {
            copyReport(uri);
        }
    }

    private void forgeCurrent() {
        ArchitectureConfig snapshot = readConfig();
        if ((sourceType == SourceType.IMAGE || sourceType == SourceType.AUDIO) && selectedUri == null) {
            Toast.makeText(this, "Choose the source file first", Toast.LENGTH_LONG).show();
            return;
        }
        stopPlayback();
        setBusy(true);
        currentResult = null;
        architectureView.clear();
        statusValue.setText("STARTING FORGE…");
        sourceValue.setText("Source: " + sourceType.name().toLowerCase(Locale.US));
        detailValue.setText(snapshot.modesLabel() + " • " + snapshot.ratioLabel());

        worker.execute(() -> {
            try {
                AudioEngine.Progress progress = (stage, detail) -> mainHandler.post(() -> {
                    statusValue.setText(stage);
                    detailValue.setText(detail);
                });
                AudioEngine.Result result;
                if (sourceType == SourceType.IMAGE) {
                    result = AudioEngine.buildFromImage(this, selectedUri, snapshot, progress);
                } else if (sourceType == SourceType.AUDIO) {
                    result = AudioEngine.buildFromAudio(this, selectedUri, snapshot, progress);
                } else {
                    result = AudioEngine.buildFromText(this, snapshot, progress);
                }
                mainHandler.post(() -> showResult(result, snapshot));
            } catch (Exception e) {
                mainHandler.post(() -> {
                    setBusy(false);
                    setResultEnabled(false);
                    statusValue.setText("FORGE FAILED");
                    detailValue.setText(e.getMessage() == null ? e.toString() : e.getMessage());
                    Toast.makeText(this, "Could not forge this source", Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void showResult(AudioEngine.Result result, ArchitectureConfig snapshot) {
        currentResult = result;
        architectureView.setData(result.preview, result.fireLetters,
                result.dimensionEnergy, snapshot);
        statusValue.setText("ARCHITECTURE READY");
        sourceValue.setText(result.sourceName + " • " + result.sourceType
                + " • " + result.sourceHash.substring(0, 16));
        detailValue.setText(String.format(Locale.US,
                "%,d Hz • %.2f sec • %.1f MB • %s • %s",
                result.sampleRate,
                result.frames / (double) result.sampleRate,
                result.wavFile.length() / 1048576.0,
                snapshot.ratioLabel(), snapshot.modesLabel()));
        setBusy(false);
        setResultEnabled(true);
    }

    private ArchitectureConfig readConfig() {
        ArchitectureConfig snapshot = config.copy();
        snapshot.topRatio = topRatioBar.getProgress();
        snapshot.bottomRatio = bottomRatioBar.getProgress();
        snapshot.spinAngle = spinBar.getProgress();
        snapshot.baseFrequency = baseFrequencyBar.getProgress();
        snapshot.stepScalePercent = stepScaleBar.getProgress();
        snapshot.presence = presenceBar.getProgress();
        snapshot.resonanceLock = resonanceSwitch.isChecked();
        snapshot.simultaneousMode = simultaneousSwitch.isChecked();
        for (int i = 0; i < modeBoxes.length; i++) snapshot.modes[i] = modeBoxes[i].isChecked();
        snapshot.emotion = String.valueOf(emotionSpinner.getSelectedItem());
        snapshot.intention = intentionInput.getText().toString();
        int[] durations = {12, 24, 48, 90};
        snapshot.durationSeconds = durations[Math.max(0,
                Math.min(durations.length - 1, durationSpinner.getSelectedItemPosition()))];
        return snapshot;
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
        intent.putExtra(Intent.EXTRA_TITLE,
                AudioEngine.safeBaseName(currentResult.sourceName) + "_scalar_architecture.wav");
        startActivityForResult(intent, REQ_SAVE_WAV);
    }

    private void saveReport() {
        if (currentResult == null) return;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE,
                AudioEngine.safeBaseName(currentResult.sourceName) + "_architecture_report.json");
        startActivityForResult(intent, REQ_SAVE_REPORT);
    }

    private void copyWav(Uri destination) {
        if (currentResult == null) return;
        setBusy(true);
        worker.execute(() -> {
            try (InputStream in = new BufferedInputStream(
                    new FileInputStream(currentResult.wavFile));
                 OutputStream out = new BufferedOutputStream(
                         requireOutput(destination))) {
                byte[] buffer = new byte[128 * 1024];
                int read;
                while ((read = in.read(buffer)) >= 0) out.write(buffer, 0, read);
                out.flush();
                mainHandler.post(() -> {
                    setBusy(false);
                    setResultEnabled(true);
                    statusValue.setText("LOSSLESS WAV SAVED");
                    Toast.makeText(this, "Phase-pair WAV saved", Toast.LENGTH_LONG).show();
                });
            } catch (Exception e) {
                mainHandler.post(() -> saveError(e));
            }
        });
    }

    private void copyReport(Uri destination) {
        if (currentResult == null) return;
        setBusy(true);
        worker.execute(() -> {
            try (OutputStream out = new BufferedOutputStream(requireOutput(destination))) {
                out.write(currentResult.reportJson.getBytes(StandardCharsets.UTF_8));
                out.flush();
                mainHandler.post(() -> {
                    setBusy(false);
                    setResultEnabled(true);
                    statusValue.setText("CODE REPORT SAVED");
                    Toast.makeText(this, "Architecture report saved", Toast.LENGTH_LONG).show();
                });
            } catch (Exception e) {
                mainHandler.post(() -> saveError(e));
            }
        });
    }

    private OutputStream requireOutput(Uri destination) throws IOException {
        OutputStream out = getContentResolver().openOutputStream(destination, "w");
        if (out == null) throw new IOException("Android could not create the destination file.");
        return out;
    }

    private void saveError(Exception e) {
        setBusy(false);
        setResultEnabled(currentResult != null);
        statusValue.setText("SAVE FAILED");
        Toast.makeText(this, e.getMessage(), Toast.LENGTH_LONG).show();
    }

    private void setRatio(int top, int bottom) {
        topRatioBar.setProgress(top);
        bottomRatioBar.setProgress(bottom);
        updateRatioLabel();
    }

    private void updateRatioLabel() {
        int top = topRatioBar.getProgress();
        int bottom = bottomRatioBar.getProgress();
        String label;
        if (top == 34 && bottom == 21) label = "34:21 natural preset";
        else if (top == 21 && bottom == 34) label = "21:34 reverse preset";
        else label = top + ":" + bottom + " custom";
        ratioValue.setText(label);
    }

    private void setBusy(boolean busy) {
        imageButton.setEnabled(!busy);
        audioButton.setEnabled(!busy);
        textButton.setEnabled(!busy);
        forgeButton.setEnabled(!busy);
        float alpha = busy ? 0.45f : 1f;
        imageButton.setAlpha(alpha);
        audioButton.setAlpha(alpha);
        textButton.setAlpha(alpha);
        forgeButton.setAlpha(alpha);
        if (busy) setResultEnabled(false);
    }

    private void setResultEnabled(boolean enabled) {
        playButton.setEnabled(enabled);
        saveWavButton.setEnabled(enabled);
        saveReportButton.setEnabled(enabled);
        playButton.setAlpha(enabled ? 1f : 0.45f);
        saveWavButton.setAlpha(enabled ? 1f : 0.45f);
        saveReportButton.setAlpha(enabled ? 1f : 0.45f);
    }

    private void addSlider(LinearLayout parent,
                           String label,
                           SeekBar bar,
                           TextView value) {
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(0, dp(6), 0, 0);
        parent.addView(header, matchWrap(0));
        header.addView(text(label, 12.5f, MUTED, false), weighted(1f, dp(34)));
        if (value != null) header.addView(value, wrapWrap());
        parent.addView(bar, matchWrap(0));
    }

    private SeekBar seek(int min, int max, int progress) {
        SeekBar bar = new SeekBar(this);
        bar.setMin(min);
        bar.setMax(max);
        bar.setProgress(progress);
        return bar;
    }

    private SeekBar.OnSeekBarChangeListener simpleSeek(ProgressAction action) {
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

    private LinearLayout card() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(17), dp(16), dp(17), dp(16));
        layout.setBackground(rounded(CARD, Color.rgb(28, 58, 61), 19));
        return layout;
    }

    private Button button(String label, int background, int foreground) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(foreground);
        button.setTextSize(12.5f);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(8), 0, dp(8), 0);
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

    private TextView valueText(String value) {
        return text(value, 12.5f, GOLD, true);
    }

    private TextView text(String value, float sizeSp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextColor(color);
        view.setTextSize(sizeSp);
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

    private enum SourceType {
        IMAGE, AUDIO, TEXT
    }

    private interface ProgressAction {
        void accept(int progress);
    }
}
