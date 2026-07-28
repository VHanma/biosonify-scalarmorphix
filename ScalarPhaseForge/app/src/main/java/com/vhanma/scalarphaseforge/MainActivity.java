package com.vhanma.scalarphaseforge;

import android.app.Activity;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioFormat;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.CompoundButton;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int REQ_OPEN_AUDIO = 1001;
    private static final int REQ_SAVE_WAV = 1002;

    private static final int BG = Color.rgb(5, 11, 13);
    private static final int CARD = Color.rgb(14, 31, 34);
    private static final int CARD_2 = Color.rgb(8, 22, 25);
    private static final int MINT = Color.rgb(131, 241, 215);
    private static final int PURPLE = Color.rgb(144, 114, 224);
    private static final int TEXT = Color.rgb(235, 244, 242);
    private static final int MUTED = Color.rgb(165, 193, 188);
    private static final int WARNING = Color.rgb(250, 203, 101);

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private TextView statusText;
    private TextView fileText;
    private TextView detailText;
    private Button importButton;
    private Button playButton;
    private Button saveButton;
    private Switch loopSwitch;
    private PhaseVisualizer visualizer;

    private File monoPcmFile;
    private File phasePairWavFile;
    private int decodedSampleRate = 48000;
    private long decodedFrames = 0;
    private String sourceName = "audio";
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
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setBackgroundColor(BG);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(18), dp(18), dp(30));
        root.setBackgroundColor(BG);
        scrollView.addView(root, new ScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView title = text("SCALAR PHASE FORGE", 28, TEXT, true);
        title.setLetterSpacing(0.06f);
        root.addView(title);

        TextView subtitle = text(
                "Forward signal + time-reversed, polarity-inverted conjugate analogue",
                14, MUTED, false);
        subtitle.setPadding(0, dp(4), 0, dp(14));
        root.addView(subtitle);

        LinearLayout buttonRow = new LinearLayout(this);
        buttonRow.setOrientation(LinearLayout.HORIZONTAL);
        buttonRow.setGravity(Gravity.CENTER_VERTICAL);
        root.addView(buttonRow, matchWrap(dp(10)));

        importButton = button("IMPORT AUDIO", MINT, Color.rgb(34, 42, 76));
        importButton.setOnClickListener(v -> openAudioPicker());
        buttonRow.addView(importButton, weighted(1f, dp(56)));

        playButton = button("PLAY", PURPLE, Color.WHITE);
        playButton.setEnabled(false);
        playButton.setAlpha(0.45f);
        playButton.setOnClickListener(v -> togglePlayback());
        LinearLayout.LayoutParams playParams = weighted(0.52f, dp(56));
        playParams.setMarginStart(dp(10));
        buttonRow.addView(playButton, playParams);

        loopSwitch = new Switch(this);
        loopSwitch.setText("Loop");
        loopSwitch.setTextColor(TEXT);
        loopSwitch.setTextSize(13);
        loopSwitch.setPadding(dp(10), 0, 0, 0);
        loopSwitch.setOnCheckedChangeListener((CompoundButton buttonView, boolean isChecked) -> {
            if (mediaPlayer != null) mediaPlayer.setLooping(isChecked);
        });
        buttonRow.addView(loopSwitch, wrapWrap());

        LinearLayout statusCard = card();
        root.addView(statusCard, matchWrap(dp(12)));

        statusText = text("READY", 18, MINT, true);
        statusCard.addView(statusText);

        fileText = text("Choose MP3, WAV, M4A, AAC, FLAC, or another Android-supported audio file.",
                14, TEXT, false);
        fileText.setPadding(0, dp(8), 0, 0);
        statusCard.addView(fileText);

        detailText = text(
                "The app decodes the source, writes a lossless stereo WAV, and keeps your original file untouched.",
                13, MUTED, false);
        detailText.setPadding(0, dp(7), 0, 0);
        statusCard.addView(detailText);

        visualizer = new PhaseVisualizer(this);
        LinearLayout.LayoutParams visualParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(540));
        visualParams.topMargin = dp(12);
        root.addView(visualizer, visualParams);

        saveButton = button("SAVE LOSSLESS PHASE-PAIR WAV", MINT, Color.rgb(34, 42, 76));
        saveButton.setEnabled(false);
        saveButton.setAlpha(0.45f);
        saveButton.setOnClickListener(v -> saveWav());
        LinearLayout.LayoutParams saveParams = matchWrap(dp(12));
        saveParams.height = dp(58);
        root.addView(saveButton, saveParams);

        LinearLayout noteCard = card();
        root.addView(noteCard, matchWrap(dp(12)));

        TextView noteTitle = text("WHAT THE FOUR PANELS MEAN", 15, WARNING, true);
        noteCard.addView(noteTitle);
        TextView note = text(
                "1. Forward component moves →\n" +
                        "2. Conjugate analogue moves ←\n" +
                        "3. Matched-point sum aligns the conjugate backward and should approach zero\n" +
                        "4. Envelope shows the source's changing intensity",
                13, TEXT, false);
        note.setPadding(0, dp(8), 0, 0);
        noteCard.addView(note);

        TextView disclaimer = text(
                "Experimental audio-domain phase-conjugate visualization. It does not claim detection or production of a physical scalar field.",
                12, MUTED, false);
        disclaimer.setPadding(0, dp(12), 0, 0);
        root.addView(disclaimer);

        setContentView(scrollView);
    }

    private void openAudioPicker() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("audio/*");
        startActivityForResult(intent, REQ_OPEN_AUDIO);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) return;

        if (requestCode == REQ_OPEN_AUDIO) {
            Uri uri = data.getData();
            try {
                getContentResolver().takePersistableUriPermission(
                        uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (SecurityException ignored) {
            }
            processAudio(uri);
        } else if (requestCode == REQ_SAVE_WAV) {
            copyWavTo(data.getData());
        }
    }

    private void processAudio(Uri uri) {
        stopPlayback();
        setBusy(true);
        sourceName = queryDisplayName(uri);
        statusText.setText("DECODING…");
        fileText.setText(sourceName);
        detailText.setText("Reading source samples and preparing the forward channel.");
        visualizer.clear();

        worker.execute(() -> {
            try {
                monoPcmFile = new File(getCacheDir(), "scalar_phase_source_mono.pcm");
                phasePairWavFile = new File(getCacheDir(), "scalar_phase_pair.wav");
                if (monoPcmFile.exists() && !monoPcmFile.delete()) {
                    throw new IOException("Could not replace temporary PCM file.");
                }
                if (phasePairWavFile.exists() && !phasePairWavFile.delete()) {
                    throw new IOException("Could not replace temporary WAV file.");
                }

                DecodeResult result = decodeToMonoPcm(uri, monoPcmFile);
                decodedSampleRate = result.sampleRate;
                decodedFrames = result.frames;
                if (decodedFrames < 2) {
                    throw new IOException("The selected file contained no usable audio samples.");
                }

                postStatus("FORGING PHASE PAIR…",
                        String.format(Locale.US,
                                "%s • %,d Hz • %.2f seconds",
                                sourceName,
                                decodedSampleRate,
                                decodedFrames / (double) decodedSampleRate),
                        "Left = forward. Right = time-reversed and polarity-inverted.");

                writePhasePairWav(monoPcmFile, phasePairWavFile,
                        decodedSampleRate, decodedFrames);
                PreviewData preview = buildPreview(monoPcmFile, decodedFrames, 1200);

                mainHandler.post(() -> {
                    visualizer.setData(preview.forward, preview.conjugate,
                            preview.matchedSum, preview.envelope);
                    statusText.setText("PHASE PAIR READY");
                    detailText.setText(String.format(Locale.US,
                            "Stereo PCM WAV • %,d Hz • Left forward • Right reversed + inverted • %.1f MB",
                            decodedSampleRate,
                            phasePairWavFile.length() / 1048576.0));
                    setBusy(false);
                    setResultButtonsEnabled(true);
                });
            } catch (Exception e) {
                mainHandler.post(() -> {
                    setBusy(false);
                    setResultButtonsEnabled(false);
                    statusText.setText("COULD NOT PROCESS FILE");
                    detailText.setText(e.getMessage() == null ? e.toString() : e.getMessage());
                    Toast.makeText(this, "Audio processing failed", Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private DecodeResult decodeToMonoPcm(Uri uri, File target) throws Exception {
        MediaExtractor extractor = new MediaExtractor();
        AssetFileDescriptor afd = null;
        try {
            afd = getContentResolver().openAssetFileDescriptor(uri, "r");
            if (afd == null) throw new IOException("Android could not open the selected file.");
            if (afd.getDeclaredLength() >= 0) {
                extractor.setDataSource(afd.getFileDescriptor(),
                        afd.getStartOffset(), afd.getDeclaredLength());
            } else {
                extractor.setDataSource(afd.getFileDescriptor());
            }

            int track = findAudioTrack(extractor);
            if (track < 0) throw new IOException("No audio track was found.");
            extractor.selectTrack(track);
            MediaFormat format = extractor.getTrackFormat(track);
            String mime = format.getString(MediaFormat.KEY_MIME);
            if (mime == null) throw new IOException("Unknown audio encoding.");

            int rate = format.containsKey(MediaFormat.KEY_SAMPLE_RATE)
                    ? format.getInteger(MediaFormat.KEY_SAMPLE_RATE) : 48000;

            if (MediaFormat.MIMETYPE_AUDIO_RAW.equals(mime)) {
                return decodeRawTrack(extractor, format, target, rate);
            }
            return decodeCompressedTrack(extractor, format, mime, target, rate);
        } finally {
            extractor.release();
            if (afd != null) afd.close();
        }
    }

    private DecodeResult decodeRawTrack(MediaExtractor extractor, MediaFormat format,
                                        File target, int sampleRate) throws Exception {
        int channels = format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)
                ? Math.max(1, format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)) : 1;
        int encoding = format.containsKey(MediaFormat.KEY_PCM_ENCODING)
                ? format.getInteger(MediaFormat.KEY_PCM_ENCODING)
                : AudioFormat.ENCODING_PCM_16BIT;

        long frames = 0;
        ByteBuffer buffer = ByteBuffer.allocateDirect(256 * 1024)
                .order(ByteOrder.LITTLE_ENDIAN);
        try (BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(target))) {
            while (true) {
                buffer.clear();
                int size = extractor.readSampleData(buffer, 0);
                if (size < 0) break;
                buffer.position(0);
                buffer.limit(size);
                frames += writeMonoFrames(buffer, size, channels, encoding, out);
                extractor.advance();
            }
        }
        return new DecodeResult(sampleRate, frames);
    }

    private DecodeResult decodeCompressedTrack(MediaExtractor extractor,
                                                 MediaFormat inputFormat,
                                                 String mime,
                                                 File target,
                                                 int fallbackRate) throws Exception {
        MediaCodec codec = MediaCodec.createDecoderByType(mime);
        boolean inputDone = false;
        boolean outputDone = false;
        int sampleRate = fallbackRate;
        int channels = inputFormat.containsKey(MediaFormat.KEY_CHANNEL_COUNT)
                ? Math.max(1, inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)) : 1;
        int pcmEncoding = AudioFormat.ENCODING_PCM_16BIT;
        long frames = 0;
        MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();

        try (BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(target))) {
            codec.configure(inputFormat, null, null, 0);
            codec.start();

            while (!outputDone) {
                if (!inputDone) {
                    int inputIndex = codec.dequeueInputBuffer(10_000);
                    if (inputIndex >= 0) {
                        ByteBuffer input = codec.getInputBuffer(inputIndex);
                        if (input == null) {
                            throw new IOException("Decoder input buffer unavailable.");
                        }
                        input.clear();
                        int sampleSize = extractor.readSampleData(input, 0);
                        if (sampleSize < 0) {
                            codec.queueInputBuffer(inputIndex, 0, 0, 0,
                                    MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                            inputDone = true;
                        } else {
                            long timeUs = extractor.getSampleTime();
                            codec.queueInputBuffer(inputIndex, 0, sampleSize, timeUs, 0);
                            extractor.advance();
                        }
                    }
                }

                int outputIndex = codec.dequeueOutputBuffer(info, 10_000);
                if (outputIndex >= 0) {
                    ByteBuffer output = codec.getOutputBuffer(outputIndex);
                    if (output != null && info.size > 0) {
                        output.position(info.offset);
                        output.limit(info.offset + info.size);
                        frames += writeMonoFrames(output, info.size,
                                channels, pcmEncoding, out);
                    }
                    outputDone = (info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0;
                    codec.releaseOutputBuffer(outputIndex, false);
                } else if (outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    MediaFormat outputFormat = codec.getOutputFormat();
                    if (outputFormat.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
                        sampleRate = outputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE);
                    }
                    if (outputFormat.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) {
                        channels = Math.max(1,
                                outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT));
                    }
                    if (outputFormat.containsKey(MediaFormat.KEY_PCM_ENCODING)) {
                        pcmEncoding = outputFormat.getInteger(MediaFormat.KEY_PCM_ENCODING);
                    }
                }
            }
        } finally {
            try {
                codec.stop();
            } catch (Exception ignored) {
            }
            codec.release();
        }

        return new DecodeResult(sampleRate, frames);
    }

    private long writeMonoFrames(ByteBuffer input,
                                 int byteCount,
                                 int channels,
                                 int pcmEncoding,
                                 OutputStream out) throws IOException {
        input.order(ByteOrder.LITTLE_ENDIAN);
        long frames = 0;
        if (pcmEncoding == AudioFormat.ENCODING_PCM_FLOAT) {
            int bytesPerFrame = channels * 4;
            int availableFrames = byteCount / bytesPerFrame;
            for (int i = 0; i < availableFrames; i++) {
                float sum = 0f;
                for (int ch = 0; ch < channels; ch++) sum += input.getFloat();
                float mono = clamp(sum / channels, -1f, 1f);
                short s = (short) Math.round(mono * 32767f);
                writeShortLE(out, s);
                frames++;
            }
        } else {
            int bytesPerFrame = channels * 2;
            int availableFrames = byteCount / bytesPerFrame;
            for (int i = 0; i < availableFrames; i++) {
                int sum = 0;
                for (int ch = 0; ch < channels; ch++) sum += input.getShort();
                short mono = (short) (sum / channels);
                writeShortLE(out, mono);
                frames++;
            }
        }
        return frames;
    }

    private void writePhasePairWav(File monoFile,
                                   File wavFile,
                                   int sampleRate,
                                   long frameCount) throws IOException {
        long dataBytes = frameCount * 4L;
        try (RandomAccessFile source = new RandomAccessFile(monoFile, "r");
             BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(wavFile))) {
            writeWavHeader(out, sampleRate, 2, 16, dataBytes);

            final int chunkFrames = 8192;
            byte[] forwardBytes = new byte[chunkFrames * 2];
            byte[] reverseBytes = new byte[chunkFrames * 2];
            byte[] stereoBytes = new byte[chunkFrames * 4];

            long frame = 0;
            while (frame < frameCount) {
                int count = (int) Math.min(chunkFrames, frameCount - frame);

                source.seek(frame * 2L);
                source.readFully(forwardBytes, 0, count * 2);

                long reverseStartFrame = frameCount - frame - count;
                source.seek(reverseStartFrame * 2L);
                source.readFully(reverseBytes, 0, count * 2);

                int outPos = 0;
                for (int j = 0; j < count; j++) {
                    short left = readShortLE(forwardBytes, j * 2);
                    int reversedIndex = count - 1 - j;
                    short sourceForRight = readShortLE(reverseBytes, reversedIndex * 2);
                    short right = invertShort(sourceForRight);

                    stereoBytes[outPos++] = (byte) (left & 0xFF);
                    stereoBytes[outPos++] = (byte) ((left >>> 8) & 0xFF);
                    stereoBytes[outPos++] = (byte) (right & 0xFF);
                    stereoBytes[outPos++] = (byte) ((right >>> 8) & 0xFF);
                }
                out.write(stereoBytes, 0, count * 4);
                frame += count;
            }
        }
    }

    private PreviewData buildPreview(File monoFile,
                                     long frameCount,
                                     int maxPoints) throws IOException {
        int points = (int) Math.min(maxPoints, Math.max(256, frameCount));
        float[] forward = new float[points];
        float[] conjugate = new float[points];
        float[] matched = new float[points];
        float[] envelope = new float[points];

        try (RandomAccessFile source = new RandomAccessFile(monoFile, "r")) {
            byte[] two = new byte[2];
            for (int i = 0; i < points; i++) {
                long index = points == 1 ? 0
                        : Math.round(i * (frameCount - 1.0) / (points - 1.0));
                source.seek(index * 2L);
                source.readFully(two);
                forward[i] = readShortLE(two, 0) / 32768f;
            }
        }

        for (int i = 0; i < points; i++) {
            conjugate[i] = -forward[points - 1 - i];
            matched[i] = clamp(forward[i] + conjugate[points - 1 - i], -1f, 1f);
        }

        float attack = 0.16f;
        float release = 0.045f;
        float env = 0f;
        for (int i = 0; i < points; i++) {
            float target = Math.abs(forward[i]);
            float alpha = target > env ? attack : release;
            env += (target - env) * alpha;
            envelope[i] = env;
        }
        env = envelope[points - 1];
        for (int i = points - 1; i >= 0; i--) {
            float target = envelope[i];
            env += (target - env) * 0.12f;
            envelope[i] = Math.max(target, env * 0.85f);
        }

        return new PreviewData(forward, conjugate, matched, envelope);
    }

    private void togglePlayback() {
        if (phasePairWavFile == null || !phasePairWavFile.exists()) return;
        try {
            if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                mediaPlayer.pause();
                playButton.setText("PLAY");
                return;
            }
            if (mediaPlayer == null) {
                mediaPlayer = new MediaPlayer();
                mediaPlayer.setDataSource(phasePairWavFile.getAbsolutePath());
                mediaPlayer.setLooping(loopSwitch.isChecked());
                mediaPlayer.setOnCompletionListener(mp -> playButton.setText("PLAY"));
                mediaPlayer.prepare();
            }
            mediaPlayer.start();
            playButton.setText("PAUSE");
        } catch (Exception e) {
            Toast.makeText(this,
                    "Could not play the WAV: " + e.getMessage(),
                    Toast.LENGTH_LONG).show();
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
        if (phasePairWavFile == null || !phasePairWavFile.exists()) return;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("audio/wav");
        intent.putExtra(Intent.EXTRA_TITLE,
                safeBaseName(sourceName) + "_phase_pair.wav");
        startActivityForResult(intent, REQ_SAVE_WAV);
    }

    private void copyWavTo(Uri destination) {
        setBusy(true);
        statusText.setText("SAVING WAV…");
        worker.execute(() -> {
            try (InputStream in = new BufferedInputStream(new FileInputStream(phasePairWavFile));
                 OutputStream out = new BufferedOutputStream(
                         getContentResolver().openOutputStream(destination, "w"))) {
                if (out == null) {
                    throw new IOException("Android could not create the destination file.");
                }
                byte[] buffer = new byte[128 * 1024];
                int read;
                while ((read = in.read(buffer)) >= 0) out.write(buffer, 0, read);
                out.flush();
                mainHandler.post(() -> {
                    setBusy(false);
                    setResultButtonsEnabled(true);
                    statusText.setText("WAV SAVED");
                    Toast.makeText(this,
                            "Lossless phase-pair WAV saved",
                            Toast.LENGTH_LONG).show();
                });
            } catch (Exception e) {
                mainHandler.post(() -> {
                    setBusy(false);
                    setResultButtonsEnabled(true);
                    statusText.setText("SAVE FAILED");
                    Toast.makeText(this, e.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private int findAudioTrack(MediaExtractor extractor) {
        for (int i = 0; i < extractor.getTrackCount(); i++) {
            MediaFormat format = extractor.getTrackFormat(i);
            String mime = format.getString(MediaFormat.KEY_MIME);
            if (mime != null && mime.startsWith("audio/")) return i;
        }
        return -1;
    }

    private String queryDisplayName(Uri uri) {
        String name = null;
        Cursor cursor = null;
        try {
            cursor = getContentResolver().query(uri,
                    new String[]{OpenableColumns.DISPLAY_NAME},
                    null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (column >= 0) name = cursor.getString(column);
            }
        } catch (Exception ignored) {
        } finally {
            if (cursor != null) cursor.close();
        }
        return name == null || name.trim().isEmpty()
                ? "selected_audio" : name;
    }

    private String safeBaseName(String name) {
        String base = name == null ? "audio" : name;
        int dot = base.lastIndexOf('.');
        if (dot > 0) base = base.substring(0, dot);
        base = base.replaceAll("[^A-Za-z0-9._-]+", "_");
        return base.isEmpty() ? "audio" : base;
    }

    private void postStatus(String status, String file, String detail) {
        mainHandler.post(() -> {
            statusText.setText(status);
            fileText.setText(file);
            detailText.setText(detail);
        });
    }

    private void setBusy(boolean busy) {
        importButton.setEnabled(!busy);
        importButton.setAlpha(busy ? 0.45f : 1f);
        if (busy) {
            playButton.setEnabled(false);
            playButton.setAlpha(0.45f);
            saveButton.setEnabled(false);
            saveButton.setAlpha(0.45f);
        }
    }

    private void setResultButtonsEnabled(boolean enabled) {
        playButton.setEnabled(enabled);
        playButton.setAlpha(enabled ? 1f : 0.45f);
        saveButton.setEnabled(enabled);
        saveButton.setAlpha(enabled ? 1f : 0.45f);
    }

    private LinearLayout card() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(18), dp(17), dp(18), dp(17));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(CARD);
        bg.setCornerRadius(dp(20));
        bg.setStroke(dp(1), Color.rgb(28, 58, 61));
        layout.setBackground(bg);
        return layout;
    }

    private Button button(String label, int background, int foreground) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(foreground);
        button.setTextSize(13);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(10), 0, dp(10), 0);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(background);
        bg.setCornerRadius(dp(28));
        button.setBackground(bg);
        return button;
    }

    private TextView text(String value,
                          int sizeSp,
                          int color,
                          boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextColor(color);
        view.setTextSize(sizeSp);
        view.setLineSpacing(0f, 1.18f);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
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

    private static float clamp(float value, float min, float max) {
        return Math.max(min, Math.min(max, value));
    }

    private static short invertShort(short value) {
        if (value == Short.MIN_VALUE) return Short.MAX_VALUE;
        return (short) -value;
    }

    private static short readShortLE(byte[] bytes, int offset) {
        return (short) ((bytes[offset] & 0xFF) | (bytes[offset + 1] << 8));
    }

    private static void writeShortLE(OutputStream out, short value) throws IOException {
        out.write(value & 0xFF);
        out.write((value >>> 8) & 0xFF);
    }

    private static void writeIntLE(OutputStream out, long value) throws IOException {
        out.write((int) (value & 0xFF));
        out.write((int) ((value >>> 8) & 0xFF));
        out.write((int) ((value >>> 16) & 0xFF));
        out.write((int) ((value >>> 24) & 0xFF));
    }

    private static void writeWavHeader(OutputStream out,
                                       int sampleRate,
                                       int channels,
                                       int bitsPerSample,
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

    @Override
    protected void onDestroy() {
        stopPlayback();
        worker.shutdownNow();
        super.onDestroy();
    }

    private static final class DecodeResult {
        final int sampleRate;
        final long frames;

        DecodeResult(int sampleRate, long frames) {
            this.sampleRate = sampleRate;
            this.frames = frames;
        }
    }

    private static final class PreviewData {
        final float[] forward;
        final float[] conjugate;
        final float[] matchedSum;
        final float[] envelope;

        PreviewData(float[] forward,
                    float[] conjugate,
                    float[] matchedSum,
                    float[] envelope) {
            this.forward = forward;
            this.conjugate = conjugate;
            this.matchedSum = matchedSum;
            this.envelope = envelope;
        }
    }

    private static final class PhaseVisualizer extends View {
        private final Paint panelPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint gridPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint wavePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint labelPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint valuePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF rect = new RectF();
        private final Path path = new Path();
        private final Handler handler = new Handler(Looper.getMainLooper());

        private float[] forward;
        private float[] conjugate;
        private float[] matched;
        private float[] envelope;
        private float phase = 0f;
        private boolean animating = false;

        private final Runnable ticker = new Runnable() {
            @Override
            public void run() {
                if (!animating) return;
                phase += 0.85f;
                invalidate();
                handler.postDelayed(this, 32);
            }
        };

        PhaseVisualizer(Activity context) {
            super(context);
            setLayerType(View.LAYER_TYPE_SOFTWARE, null);
            panelPaint.setColor(CARD);
            gridPaint.setColor(Color.rgb(48, 79, 80));
            gridPaint.setStrokeWidth(context.getResources()
                    .getDisplayMetrics().density);
            wavePaint.setStyle(Paint.Style.STROKE);
            wavePaint.setStrokeWidth(1.25f * context.getResources()
                    .getDisplayMetrics().density);
            wavePaint.setStrokeCap(Paint.Cap.ROUND);
            wavePaint.setStrokeJoin(Paint.Join.ROUND);
            labelPaint.setColor(TEXT);
            labelPaint.setTextSize(13f * context.getResources()
                    .getDisplayMetrics().scaledDensity);
            labelPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            valuePaint.setColor(MUTED);
            valuePaint.setTextSize(11f * context.getResources()
                    .getDisplayMetrics().scaledDensity);
            fillPaint.setStyle(Paint.Style.FILL);
        }

        void setData(float[] forward,
                     float[] conjugate,
                     float[] matched,
                     float[] envelope) {
            this.forward = forward;
            this.conjugate = conjugate;
            this.matched = matched;
            this.envelope = envelope;
            animating = true;
            handler.removeCallbacks(ticker);
            handler.post(ticker);
            invalidate();
        }

        void clear() {
            forward = null;
            conjugate = null;
            matched = null;
            envelope = null;
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
            float panelHeight = (getHeight() - gap * 3f) / 4f;
            for (int i = 0; i < 4; i++) {
                float top = i * (panelHeight + gap);
                drawPanel(canvas, i, top, panelHeight);
            }
        }

        private void drawPanel(Canvas canvas,
                               int index,
                               float top,
                               float height) {
            float left = 0;
            float right = getWidth();
            rect.set(left, top, right, top + height);
            panelPaint.setColor(index == 2 ? CARD_2 : CARD);
            canvas.drawRoundRect(rect, dp(18), dp(18), panelPaint);

            String title;
            String direction;
            float[] data;
            int color;
            switch (index) {
                case 0:
                    title = "FORWARD COMPONENT";
                    direction = "moves →";
                    data = forward;
                    color = MINT;
                    break;
                case 1:
                    title = "PHASE-CONJUGATE ANALOGUE";
                    direction = "moves ←";
                    data = conjugate;
                    color = PURPLE;
                    break;
                case 2:
                    title = "MATCHED-POINT SUM";
                    direction = "L(t) + reverse[R(t)]";
                    data = matched;
                    color = WARNING;
                    break;
                default:
                    title = "LONGITUDINAL ENVELOPE PREVIEW";
                    direction = "compression / thinning";
                    data = envelope;
                    color = MINT;
                    break;
            }

            canvas.drawText(title, dp(15), top + dp(24), labelPaint);
            float directionWidth = valuePaint.measureText(direction);
            canvas.drawText(direction,
                    right - dp(15) - directionWidth,
                    top + dp(24), valuePaint);

            float graphLeft = dp(14);
            float graphRight = right - dp(14);
            float graphTop = top + dp(35);
            float graphBottom = top + height - dp(13);
            float center = (graphTop + graphBottom) * 0.5f;
            canvas.drawLine(graphLeft, center, graphRight, center, gridPaint);

            if (data == null || data.length < 2) {
                valuePaint.setColor(MUTED);
                canvas.drawText("Import audio to reveal this layer",
                        graphLeft, center + dp(5), valuePaint);
                return;
            }

            if (index == 3) {
                drawEnvelope(canvas, data,
                        graphLeft, graphRight, graphTop, graphBottom, color);
            } else {
                drawWave(canvas, data,
                        graphLeft, graphRight, graphTop, graphBottom,
                        color, index == 0 ? 1 : index == 1 ? -1 : 0);
            }
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
            wavePaint.setColor(color);
            wavePaint.setShadowLayer(dp(5), 0, 0,
                    Color.argb(75,
                            Color.red(color),
                            Color.green(color),
                            Color.blue(color)));

            float width = right - left;
            float center = (top + bottom) * 0.5f;
            float amp = (bottom - top) * 0.43f;
            int offset = direction == 0 ? 0 : ((int) phase * direction);
            int length = data.length;
            int drawPoints = Math.min(length, Math.max(220, (int) width));

            for (int i = 0; i < drawPoints; i++) {
                int raw = Math.round(i * (length - 1f) / (drawPoints - 1f));
                int pointIndex = raw + offset;
                pointIndex %= length;
                if (pointIndex < 0) pointIndex += length;
                float x = left + i * width / (drawPoints - 1f);
                float y = center - clamp(data[pointIndex], -1f, 1f) * amp;
                if (i == 0) path.moveTo(x, y);
                else path.lineTo(x, y);
            }
            canvas.drawPath(path, wavePaint);
            wavePaint.clearShadowLayer();
        }

        private void drawEnvelope(Canvas canvas,
                                  float[] data,
                                  float left,
                                  float right,
                                  float top,
                                  float bottom,
                                  int color) {
            float width = right - left;
            float center = (top + bottom) * 0.5f;
            float amp = (bottom - top) * 0.43f;
            int drawPoints = Math.min(data.length, Math.max(220, (int) width));
            path.reset();
            for (int i = 0; i < drawPoints; i++) {
                int pointIndex = Math.round(
                        i * (data.length - 1f) / (drawPoints - 1f));
                float x = left + i * width / (drawPoints - 1f);
                float y = center - clamp(data[pointIndex], 0f, 1f) * amp;
                if (i == 0) path.moveTo(x, y);
                else path.lineTo(x, y);
            }
            for (int i = drawPoints - 1; i >= 0; i--) {
                int pointIndex = Math.round(
                        i * (data.length - 1f) / (drawPoints - 1f));
                float x = left + i * width / (drawPoints - 1f);
                float y = center + clamp(data[pointIndex], 0f, 1f) * amp;
                path.lineTo(x, y);
            }
            path.close();
            fillPaint.setColor(Color.argb(44,
                    Color.red(color),
                    Color.green(color),
                    Color.blue(color)));
            canvas.drawPath(path, fillPaint);

            wavePaint.setColor(color);
            wavePaint.setStrokeWidth(dp(1));
            canvas.drawPath(path, wavePaint);
        }

        private float dp(float value) {
            return value * getResources().getDisplayMetrics().density;
        }
    }
}
