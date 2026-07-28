package com.vhanma.scalararchitectureforge;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.media.AudioFormat;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.net.Uri;
import android.provider.OpenableColumns;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

public final class AudioEngine {
    public static final int SYNTH_SAMPLE_RATE = 48000;
    private static final int FIRE_LETTER_COUNT = 144;

    private AudioEngine() {
    }

    public interface Progress {
        void update(String stage, String detail);
    }

    public static Result buildFromAudio(Context context,
                                        Uri uri,
                                        ArchitectureConfig config,
                                        Progress progress) throws Exception {
        File cache = context.getCacheDir();
        File decoded = new File(cache, "architecture_decoded_mono.pcm");
        File forged = new File(cache, "architecture_forged_mono.pcm");
        File wav = new File(cache, "scalar_architecture_phase_pair.wav");
        replace(decoded);
        replace(forged);
        replace(wav);

        String sourceName = queryDisplayName(context, uri);
        progress.update("DECODING AUDIO", sourceName);
        DecodeResult decode = decodeToMonoPcm(context, uri, decoded);
        if (decode.frames < 2) throw new IOException("The selected audio contained no usable samples.");

        byte[] sourceDigest = digestUri(context, uri, config);
        float[] fireLetters = fireLettersFromPcm(decoded, decode.frames, sourceDigest, config);
        float[] dimensionEnergy = computeDimensionEnergy(fireLetters, config);

        progress.update("BUILDING 15-BAND ARCHITECTURE",
                config.modesLabel() + " • " + config.ratioLabel());
        transformPcm(decoded, forged, decode.sampleRate, decode.frames,
                fireLetters, config);

        progress.update("WRITING PHASE-CONJUGATE PAIR",
                "Left forward • Right time-reversed + polarity-inverted");
        writePhasePairWav(forged, wav, decode.sampleRate, decode.frames);
        Preview preview = buildPreview(forged, decode.frames, 1200);
        String hash = hex(sourceDigest);
        String report = config.toReportJson(sourceName, "audio", hash,
                decode.sampleRate, decode.frames, fireLetters, dimensionEnergy);
        return new Result(wav, forged, decode.sampleRate, decode.frames,
                sourceName, "audio", hash, fireLetters, dimensionEnergy,
                preview, report);
    }

    public static Result buildFromImage(Context context,
                                        Uri uri,
                                        ArchitectureConfig config,
                                        Progress progress) throws Exception {
        File cache = context.getCacheDir();
        File forged = new File(cache, "architecture_image_mono.pcm");
        File wav = new File(cache, "scalar_architecture_phase_pair.wav");
        replace(forged);
        replace(wav);

        String sourceName = queryDisplayName(context, uri);
        progress.update("READING IMAGE HOLOGRAM", sourceName);
        byte[] sourceDigest = digestUri(context, uri, config);
        Bitmap bitmap;
        try (InputStream input = context.getContentResolver().openInputStream(uri)) {
            if (input == null) throw new IOException("Android could not open the image.");
            bitmap = BitmapFactory.decodeStream(input);
        }
        if (bitmap == null) throw new IOException("The selected image could not be decoded.");

        float[] fireLetters;
        try {
            fireLetters = fireLettersFromImage(bitmap, sourceDigest, config);
        } finally {
            bitmap.recycle();
        }
        float[] dimensionEnergy = computeDimensionEnergy(fireLetters, config);
        long frames = (long) SYNTH_SAMPLE_RATE * Math.max(6, config.durationSeconds);

        progress.update("GENERATING 144 FIRE-LETTER SEQUENCE",
                "12 × 12 deterministic image code");
        generatePcm(forged, SYNTH_SAMPLE_RATE, frames, fireLetters, config);
        progress.update("WRITING PHASE-CONJUGATE PAIR",
                config.modesLabel() + " • " + config.ratioLabel());
        writePhasePairWav(forged, wav, SYNTH_SAMPLE_RATE, frames);
        Preview preview = buildPreview(forged, frames, 1200);
        String hash = hex(sourceDigest);
        String report = config.toReportJson(sourceName, "image", hash,
                SYNTH_SAMPLE_RATE, frames, fireLetters, dimensionEnergy);
        return new Result(wav, forged, SYNTH_SAMPLE_RATE, frames,
                sourceName, "image", hash, fireLetters, dimensionEnergy,
                preview, report);
    }

    public static Result buildFromText(Context context,
                                       ArchitectureConfig config,
                                       Progress progress) throws Exception {
        String sourceText = config.intention == null ? "" : config.intention.trim();
        if (sourceText.isEmpty()) sourceText = "Untitled intention";
        String sourceName = "Text intention";
        File cache = context.getCacheDir();
        File forged = new File(cache, "architecture_text_mono.pcm");
        File wav = new File(cache, "scalar_architecture_phase_pair.wav");
        replace(forged);
        replace(wav);

        progress.update("ENCODING TEXT / INTENTION", sourceText);
        byte[] sourceDigest = digestBytes(
                (sourceText + "|" + config.emotion + "|" + config.ratioLabel())
                        .getBytes(StandardCharsets.UTF_8));
        float[] fireLetters = fireLettersFromDigest(sourceDigest, config);
        float[] dimensionEnergy = computeDimensionEnergy(fireLetters, config);
        long frames = (long) SYNTH_SAMPLE_RATE * Math.max(6, config.durationSeconds);

        progress.update("GENERATING ELECTRO-TONAL PATTERN",
                config.modesLabel());
        generatePcm(forged, SYNTH_SAMPLE_RATE, frames, fireLetters, config);
        writePhasePairWav(forged, wav, SYNTH_SAMPLE_RATE, frames);
        Preview preview = buildPreview(forged, frames, 1200);
        String hash = hex(sourceDigest);
        String report = config.toReportJson(sourceName, "text", hash,
                SYNTH_SAMPLE_RATE, frames, fireLetters, dimensionEnergy);
        return new Result(wav, forged, SYNTH_SAMPLE_RATE, frames,
                sourceName, "text", hash, fireLetters, dimensionEnergy,
                preview, report);
    }

    private static float[] fireLettersFromImage(Bitmap bitmap,
                                                byte[] digest,
                                                ArchitectureConfig config) {
        Bitmap scaled = Bitmap.createScaledBitmap(bitmap, 12, 12, true);
        float[] letters = new float[FIRE_LETTER_COUNT];
        byte[] contextDigest = contextDigest(config);
        try {
            for (int y = 0; y < 12; y++) {
                for (int x = 0; x < 12; x++) {
                    int index = y * 12 + x;
                    int pixel = scaled.getPixel(x, y);
                    float r = Color.red(pixel) / 255f;
                    float g = Color.green(pixel) / 255f;
                    float b = Color.blue(pixel) / 255f;
                    float luminance = 0.2126f * r + 0.7152f * g + 0.0722f * b;
                    float max = Math.max(r, Math.max(g, b));
                    float min = Math.min(r, Math.min(g, b));
                    float saturation = max <= 0f ? 0f : (max - min) / max;
                    float hashPart = (digest[index % digest.length] & 0xFF) / 255f;
                    float contextPart = (contextDigest[(index * 5) % contextDigest.length] & 0xFF) / 255f;
                    letters[index] = clamp01(0.50f * luminance + 0.18f * saturation
                            + 0.20f * hashPart + 0.12f * contextPart);
                }
            }
        } finally {
            if (scaled != bitmap) scaled.recycle();
        }
        normalizeLetters(letters);
        return letters;
    }

    private static float[] fireLettersFromPcm(File pcm,
                                              long frames,
                                              byte[] digest,
                                              ArchitectureConfig config) throws IOException {
        float[] letters = new float[FIRE_LETTER_COUNT];
        byte[] two = new byte[2];
        byte[] contextDigest = contextDigest(config);
        try (RandomAccessFile source = new RandomAccessFile(pcm, "r")) {
            for (int i = 0; i < FIRE_LETTER_COUNT; i++) {
                long center = Math.round(i * (frames - 1.0) / (FIRE_LETTER_COUNT - 1.0));
                double energy = 0.0;
                int count = 0;
                for (int k = -12; k <= 12; k += 3) {
                    long frame = Math.max(0, Math.min(frames - 1, center + k));
                    source.seek(frame * 2L);
                    source.readFully(two);
                    energy += Math.abs(readShortLE(two, 0) / 32768.0);
                    count++;
                }
                float sampleEnergy = (float) (energy / Math.max(1, count));
                float hashPart = (digest[(i * 7) % digest.length] & 0xFF) / 255f;
                float contextPart = (contextDigest[(i * 11) % contextDigest.length] & 0xFF) / 255f;
                letters[i] = clamp01(0.62f * sampleEnergy + 0.24f * hashPart + 0.14f * contextPart);
            }
        }
        normalizeLetters(letters);
        return letters;
    }

    private static float[] fireLettersFromDigest(byte[] digest,
                                                 ArchitectureConfig config) {
        float[] letters = new float[FIRE_LETTER_COUNT];
        byte[] contextDigest = contextDigest(config);
        long state = 0x9E3779B97F4A7C15L;
        for (byte value : digest) state = mix64(state ^ (value & 0xFF));
        for (int i = 0; i < letters.length; i++) {
            state = mix64(state + i * 0x632BE59BD9B4E019L);
            float pseudo = ((state >>> 11) & 0xFFFFFF) / (float) 0xFFFFFF;
            float digestPart = (digest[i % digest.length] & 0xFF) / 255f;
            float contextPart = (contextDigest[(i * 3) % contextDigest.length] & 0xFF) / 255f;
            letters[i] = clamp01(0.52f * pseudo + 0.30f * digestPart + 0.18f * contextPart);
        }
        normalizeLetters(letters);
        return letters;
    }

    private static byte[] contextDigest(ArchitectureConfig config) {
        String context = config.emotion + "|" + config.intention + "|"
                + config.topRatio + ":" + config.bottomRatio + "|"
                + config.spinAngle + "|" + config.baseFrequency + "|"
                + config.stepScalePercent + "|" + config.modesLabel();
        return digestBytes(context.getBytes(StandardCharsets.UTF_8));
    }

    private static void normalizeLetters(float[] letters) {
        float min = Float.MAX_VALUE;
        float max = -Float.MAX_VALUE;
        for (float value : letters) {
            min = Math.min(min, value);
            max = Math.max(max, value);
        }
        float range = Math.max(0.0001f, max - min);
        for (int i = 0; i < letters.length; i++) {
            letters[i] = 0.06f + 0.94f * ((letters[i] - min) / range);
        }
    }

    private static float[] computeDimensionEnergy(float[] fireLetters,
                                                  ArchitectureConfig config) {
        float[] energy = new float[15];
        for (int d = 1; d <= 15; d++) {
            double total = 0;
            for (int i = d - 1; i < fireLetters.length; i += 15) {
                total += fireLetters[i];
            }
            double average = total / Math.ceil((fireLetters.length - (d - 1)) / 15.0);
            energy[d - 1] = clamp01((float) (average * (0.65 + config.ratioWeight(d))));
        }
        return energy;
    }

    private static void generatePcm(File target,
                                    int sampleRate,
                                    long frames,
                                    float[] fireLetters,
                                    ArchitectureConfig config) throws IOException {
        boolean[] active = config.activeDimensions();
        OscillatorBank bank = new OscillatorBank(sampleRate, active, config);
        long segmentFrames = Math.max(1L, frames / FIRE_LETTER_COUNT);
        double presence = config.presence / 100.0;
        try (BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(target), 128 * 1024)) {
            for (long frame = 0; frame < frames; frame++) {
                int letterIndex = (int) Math.min(FIRE_LETTER_COUNT - 1, frame / segmentFrames);
                double synth = bank.next(fireLetters, letterIndex, frame, segmentFrames);
                double fade = fade(frame, frames, sampleRate);
                double letterGain = 0.38 + 0.62 * fireLetters[letterIndex];
                double output = softClip(synth * letterGain * presence * fade * 1.35) * 0.86;
                writeShortLE(out, toShort(output));
            }
        }
    }

    private static void transformPcm(File source,
                                     File target,
                                     int sampleRate,
                                     long frames,
                                     float[] fireLetters,
                                     ArchitectureConfig config) throws IOException {
        boolean[] active = config.activeDimensions();
        OscillatorBank bank = new OscillatorBank(sampleRate, active, config);
        long segmentFrames = Math.max(1L, frames / FIRE_LETTER_COUNT);
        double presence = config.presence / 100.0;
        byte[] two = new byte[2];
        try (BufferedInputStream in = new BufferedInputStream(new FileInputStream(source), 128 * 1024);
             BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(target), 128 * 1024)) {
            for (long frame = 0; frame < frames; frame++) {
                int lo = in.read();
                int hi = in.read();
                if (lo < 0 || hi < 0) break;
                two[0] = (byte) lo;
                two[1] = (byte) hi;
                double original = readShortLE(two, 0) / 32768.0;
                int letterIndex = (int) Math.min(FIRE_LETTER_COUNT - 1, frame / segmentFrames);
                double synth = bank.next(fireLetters, letterIndex, frame, segmentFrames);
                double fade = fade(frame, frames, sampleRate);
                double architecture = synth * (0.20 + 0.34 * presence) * fade;
                double output = softClip(original * 0.82 + architecture) * 0.94;
                writeShortLE(out, toShort(output));
            }
        }
    }

    private static double fade(long frame, long frames, int sampleRate) {
        long fadeFrames = Math.min(frames / 6, Math.max(1, sampleRate));
        double in = Math.min(1.0, frame / (double) fadeFrames);
        double out = Math.min(1.0, (frames - 1 - frame) / (double) fadeFrames);
        return Math.sin(Math.min(in, out) * Math.PI * 0.5);
    }

    private static final class OscillatorBank {
        final int sampleRate;
        final boolean[] active;
        final ArchitectureConfig config;
        final double[] phase = new double[16];
        final double spinRadians;

        OscillatorBank(int sampleRate, boolean[] active, ArchitectureConfig config) {
            this.sampleRate = sampleRate;
            this.active = active;
            this.config = config;
            this.spinRadians = Math.toRadians(config.spinAngle);
            for (int d = 1; d <= 15; d++) {
                phase[d] = (d * 0.61803398875) % 1.0 * Math.PI * 2.0;
            }
        }

        double next(float[] fireLetters,
                    int letterIndex,
                    long frame,
                    long segmentFrames) {
            double sum = 0.0;
            double weightTotal = 0.0;
            for (int d = 1; d <= 15; d++) {
                if (!active[d]) continue;
                float letter = fireLetters[(letterIndex + d * 7) % fireLetters.length];
                double detune = (letter - 0.5) * 0.038;
                if (config.resonanceLock) detune = Math.rint(detune * 100.0) / 100.0;
                double frequency = config.dimensionFrequency(d) * (1.0 + detune);
                frequency = Math.min(frequency, sampleRate * 0.44);
                int direction = config.rotationDirection(d);
                phase[d] += direction * Math.PI * 2.0 * frequency / sampleRate;
                if (phase[d] > Math.PI * 2.0) phase[d] -= Math.PI * 2.0;
                if (phase[d] < -Math.PI * 2.0) phase[d] += Math.PI * 2.0;
                double offset = config.isOvertone(d) ? spinRadians : 0.0;
                double weight = config.ratioWeight(d) * (0.22 + 0.78 * letter);
                sum += Math.sin(phase[d] + offset) * weight;
                weightTotal += weight;
            }
            if (weightTotal > 0.0) sum /= Math.sqrt(weightTotal * 2.0);

            long within = frame % segmentFrames;
            double pulseEnv = Math.exp(-within / Math.max(1.0, segmentFrames * 0.16));
            float currentLetter = fireLetters[letterIndex];
            double pulseFrequency = config.baseFrequency * (4.0 + currentLetter * 8.0);
            double pulse = Math.sin(Math.PI * 2.0 * pulseFrequency * frame / sampleRate)
                    * pulseEnv * (currentLetter - 0.25) * 0.12;
            return sum * 0.74 + pulse;
        }
    }

    private static DecodeResult decodeToMonoPcm(Context context,
                                                Uri uri,
                                                File target) throws Exception {
        MediaExtractor extractor = new MediaExtractor();
        AssetFileDescriptor afd = null;
        try {
            afd = context.getContentResolver().openAssetFileDescriptor(uri, "r");
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
                    ? format.getInteger(MediaFormat.KEY_SAMPLE_RATE) : SYNTH_SAMPLE_RATE;
            if (MediaFormat.MIMETYPE_AUDIO_RAW.equals(mime)) {
                return decodeRawTrack(extractor, format, target, rate);
            }
            return decodeCompressedTrack(extractor, format, mime, target, rate);
        } finally {
            extractor.release();
            if (afd != null) afd.close();
        }
    }

    private static DecodeResult decodeRawTrack(MediaExtractor extractor,
                                               MediaFormat format,
                                               File target,
                                               int sampleRate) throws Exception {
        int channels = format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)
                ? Math.max(1, format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)) : 1;
        int encoding = format.containsKey(MediaFormat.KEY_PCM_ENCODING)
                ? format.getInteger(MediaFormat.KEY_PCM_ENCODING)
                : AudioFormat.ENCODING_PCM_16BIT;
        long frames = 0;
        ByteBuffer buffer = ByteBuffer.allocateDirect(256 * 1024).order(ByteOrder.LITTLE_ENDIAN);
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

    private static DecodeResult decodeCompressedTrack(MediaExtractor extractor,
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
                        if (input == null) throw new IOException("Decoder input buffer unavailable.");
                        input.clear();
                        int sampleSize = extractor.readSampleData(input, 0);
                        if (sampleSize < 0) {
                            codec.queueInputBuffer(inputIndex, 0, 0, 0,
                                    MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                            inputDone = true;
                        } else {
                            codec.queueInputBuffer(inputIndex, 0, sampleSize,
                                    extractor.getSampleTime(), 0);
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
                        channels = Math.max(1, outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT));
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

    private static long writeMonoFrames(ByteBuffer input,
                                        int byteCount,
                                        int channels,
                                        int pcmEncoding,
                                        OutputStream out) throws IOException {
        input.order(ByteOrder.LITTLE_ENDIAN);
        int bytesPerSample;
        if (pcmEncoding == AudioFormat.ENCODING_PCM_FLOAT || pcmEncoding == AudioFormat.ENCODING_PCM_32BIT) {
            bytesPerSample = 4;
        } else if (pcmEncoding == AudioFormat.ENCODING_PCM_24BIT_PACKED) {
            bytesPerSample = 3;
        } else if (pcmEncoding == AudioFormat.ENCODING_PCM_8BIT) {
            bytesPerSample = 1;
        } else {
            bytesPerSample = 2;
        }
        int availableFrames = byteCount / Math.max(1, channels * bytesPerSample);
        for (int i = 0; i < availableFrames; i++) {
            double sum = 0.0;
            for (int ch = 0; ch < channels; ch++) {
                if (pcmEncoding == AudioFormat.ENCODING_PCM_FLOAT) {
                    sum += clamp(input.getFloat(), -1f, 1f);
                } else if (pcmEncoding == AudioFormat.ENCODING_PCM_32BIT) {
                    sum += input.getInt() / 2147483648.0;
                } else if (pcmEncoding == AudioFormat.ENCODING_PCM_24BIT_PACKED) {
                    int b0 = input.get() & 0xFF;
                    int b1 = input.get() & 0xFF;
                    int b2 = input.get();
                    int value = b0 | (b1 << 8) | (b2 << 16);
                    sum += value / 8388608.0;
                } else if (pcmEncoding == AudioFormat.ENCODING_PCM_8BIT) {
                    sum += ((input.get() & 0xFF) - 128) / 128.0;
                } else {
                    sum += input.getShort() / 32768.0;
                }
            }
            writeShortLE(out, toShort(sum / channels));
        }
        return availableFrames;
    }

    private static int findAudioTrack(MediaExtractor extractor) {
        for (int i = 0; i < extractor.getTrackCount(); i++) {
            MediaFormat format = extractor.getTrackFormat(i);
            String mime = format.getString(MediaFormat.KEY_MIME);
            if (mime != null && mime.startsWith("audio/")) return i;
        }
        return -1;
    }

    private static void writePhasePairWav(File monoFile,
                                          File wavFile,
                                          int sampleRate,
                                          long frameCount) throws IOException {
        long dataBytes = frameCount * 4L;
        try (RandomAccessFile source = new RandomAccessFile(monoFile, "r");
             BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(wavFile), 128 * 1024)) {
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
                    short right = invertShort(readShortLE(reverseBytes, (count - 1 - j) * 2));
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

    private static Preview buildPreview(File monoFile,
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
        float env = 0f;
        for (int i = 0; i < points; i++) {
            float target = Math.abs(forward[i]);
            float alpha = target > env ? 0.16f : 0.045f;
            env += (target - env) * alpha;
            envelope[i] = env;
        }
        env = envelope[points - 1];
        for (int i = points - 1; i >= 0; i--) {
            env += (envelope[i] - env) * 0.12f;
            envelope[i] = Math.max(envelope[i], env * 0.85f);
        }
        return new Preview(forward, conjugate, matched, envelope);
    }

    private static byte[] digestUri(Context context,
                                    Uri uri,
                                    ArchitectureConfig config) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new BufferedInputStream(
                context.getContentResolver().openInputStream(uri))) {
            if (input == null) throw new IOException("Android could not read the selected file.");
            byte[] buffer = new byte[128 * 1024];
            int read;
            while ((read = input.read(buffer)) >= 0) digest.update(buffer, 0, read);
        }
        digest.update(contextDigest(config));
        return digest.digest();
    }

    private static byte[] digestBytes(byte[] bytes) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(bytes);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String queryDisplayName(Context context, Uri uri) {
        Cursor cursor = null;
        try {
            cursor = context.getContentResolver().query(uri,
                    new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (column >= 0) {
                    String value = cursor.getString(column);
                    if (value != null && !value.trim().isEmpty()) return value;
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (cursor != null) cursor.close();
        }
        return "selected_source";
    }

    public static String safeBaseName(String name) {
        String base = name == null ? "architecture" : name;
        int dot = base.lastIndexOf('.');
        if (dot > 0) base = base.substring(0, dot);
        base = base.replaceAll("[^A-Za-z0-9._-]+", "_");
        return base.isEmpty() ? "architecture" : base;
    }

    private static void replace(File file) throws IOException {
        if (file.exists() && !file.delete()) throw new IOException("Could not replace " + file.getName());
    }

    private static double softClip(double value) {
        return Math.tanh(value);
    }

    private static short toShort(double value) {
        double clipped = Math.max(-1.0, Math.min(1.0, value));
        return (short) Math.round(clipped * 32767.0);
    }

    private static float clamp01(float value) {
        return clamp(value, 0f, 1f);
    }

    private static float clamp(float value, float min, float max) {
        return Math.max(min, Math.min(max, value));
    }

    private static short invertShort(short value) {
        return value == Short.MIN_VALUE ? Short.MAX_VALUE : (short) -value;
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

    private static String hex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) builder.append(String.format(Locale.US, "%02x", value & 0xFF));
        return builder.toString();
    }

    private static long mix64(long z) {
        z = (z ^ (z >>> 30)) * 0xbf58476d1ce4e5b9L;
        z = (z ^ (z >>> 27)) * 0x94d049bb133111ebL;
        return z ^ (z >>> 31);
    }

    private static final class DecodeResult {
        final int sampleRate;
        final long frames;

        DecodeResult(int sampleRate, long frames) {
            this.sampleRate = sampleRate;
            this.frames = frames;
        }
    }

    public static final class Preview {
        public final float[] forward;
        public final float[] conjugate;
        public final float[] matchedSum;
        public final float[] envelope;

        Preview(float[] forward, float[] conjugate,
                float[] matchedSum, float[] envelope) {
            this.forward = forward;
            this.conjugate = conjugate;
            this.matchedSum = matchedSum;
            this.envelope = envelope;
        }
    }

    public static final class Result {
        public final File wavFile;
        public final File monoFile;
        public final int sampleRate;
        public final long frames;
        public final String sourceName;
        public final String sourceType;
        public final String sourceHash;
        public final float[] fireLetters;
        public final float[] dimensionEnergy;
        public final Preview preview;
        public final String reportJson;

        Result(File wavFile, File monoFile,
               int sampleRate, long frames,
               String sourceName, String sourceType, String sourceHash,
               float[] fireLetters, float[] dimensionEnergy,
               Preview preview, String reportJson) {
            this.wavFile = wavFile;
            this.monoFile = monoFile;
            this.sampleRate = sampleRate;
            this.frames = frames;
            this.sourceName = sourceName;
            this.sourceType = sourceType;
            this.sourceHash = sourceHash;
            this.fireLetters = fireLetters;
            this.dimensionEnergy = dimensionEnergy;
            this.preview = preview;
            this.reportJson = reportJson;
        }
    }
}
