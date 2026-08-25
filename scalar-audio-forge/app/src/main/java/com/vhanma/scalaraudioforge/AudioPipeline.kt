package com.vhanma.scalaraudioforge

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import android.os.Build
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.min

object AudioPipeline {
    data class Result(
        val file: File,
        val sampleRate: Int,
        val channels: Int,
        val frames: Long,
        val format: OutputFormat
    )

    fun process(
        context: Context,
        source: Uri,
        destination: File,
        matrix: ForgeMatrix,
        outputFormat: OutputFormat,
        callback: (progress: Float, preview: FloatArray?) -> Unit
    ): Result {
        val extractor = MediaExtractor()
        extractor.setDataSource(context, source, null)
        var track = -1
        var inputFormat: MediaFormat? = null
        for (i in 0 until extractor.trackCount) {
            val f = extractor.getTrackFormat(i)
            val mime = f.getString(MediaFormat.KEY_MIME) ?: ""
            if (mime.startsWith("audio/")) {
                track = i
                inputFormat = f
                break
            }
        }
        require(track >= 0 && inputFormat != null) { "No decodable audio track found" }
        extractor.selectTrack(track)
        val format = inputFormat!!
        val mime = format.getString(MediaFormat.KEY_MIME) ?: error("Audio MIME missing")
        val sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        val channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        val durationUs = if (format.containsKey(MediaFormat.KEY_DURATION)) format.getLong(MediaFormat.KEY_DURATION) else 0L

        val decoder = MediaCodec.createDecoderByType(mime)
        decoder.configure(format, null, null, 0)
        decoder.start()
        val writer: SampleWriter = when (outputFormat) {
            OutputFormat.WAV16,
            OutputFormat.WAV24,
            OutputFormat.WAV_FLOAT32,
            OutputFormat.RF64 -> WavFileWriter(destination, sampleRate, channels, outputFormat)
            OutputFormat.AAC_M4A,
            OutputFormat.OPUS_OGG -> EncodedAudioWriter(destination, sampleRate, channels, outputFormat)
        }

        val info = MediaCodec.BufferInfo()
        var inputDone = false
        var outputDone = false
        var outputEncoding = AudioFormat.ENCODING_PCM_16BIT
        var frameStart = 0L
        var lastProgress = -1

        try {
            while (!outputDone) {
                if (!inputDone) {
                    val inIndex = decoder.dequeueInputBuffer(10_000)
                    if (inIndex >= 0) {
                        val buffer = decoder.getInputBuffer(inIndex) ?: error("Decoder input buffer missing")
                        buffer.clear()
                        val size = extractor.readSampleData(buffer, 0)
                        if (size < 0) {
                            decoder.queueInputBuffer(inIndex, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputDone = true
                        } else {
                            decoder.queueInputBuffer(inIndex, 0, size, extractor.sampleTime, 0)
                            extractor.advance()
                        }
                    }
                }

                when (val outIndex = decoder.dequeueOutputBuffer(info, 10_000)) {
                    MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
                    MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        val outFormat = decoder.outputFormat
                        outputEncoding = if (outFormat.containsKey(MediaFormat.KEY_PCM_ENCODING)) {
                            outFormat.getInteger(MediaFormat.KEY_PCM_ENCODING)
                        } else AudioFormat.ENCODING_PCM_16BIT
                    }
                    else -> if (outIndex >= 0) {
                        if (info.size > 0) {
                            val raw = decoder.getOutputBuffer(outIndex) ?: error("Decoder output buffer missing")
                            raw.position(info.offset)
                            raw.limit(info.offset + info.size)
                            val pcm = toFloatPcm(raw.slice().order(ByteOrder.LITTLE_ENDIAN), outputEncoding)
                            val processed = MatrixEngine.process(pcm, channels, sampleRate, frameStart, matrix)
                            writer.write(processed)
                            frameStart += processed.size / channels
                            val percent = if (durationUs > 0) {
                                ((info.presentationTimeUs * 100L / durationUs).toInt()).coerceIn(0, 100)
                            } else 0
                            if (percent != lastProgress && percent % 2 == 0) {
                                lastProgress = percent
                                callback(percent / 100f, processed.take(min(processed.size, 8192)).toFloatArray())
                            }
                        }
                        outputDone = (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0
                        decoder.releaseOutputBuffer(outIndex, false)
                    }
                }
            }
        } finally {
            runCatching { writer.close() }
            runCatching { decoder.stop() }
            decoder.release()
            extractor.release()
        }
        callback(1f, null)
        return Result(destination, sampleRate, channels, frameStart, outputFormat)
    }

    private fun toFloatPcm(buffer: ByteBuffer, encoding: Int): FloatArray {
        return when (encoding) {
            AudioFormat.ENCODING_PCM_FLOAT -> {
                val count = buffer.remaining() / 4
                FloatArray(count) { buffer.float.coerceIn(-1f, 1f) }
            }
            AudioFormat.ENCODING_PCM_8BIT -> {
                val count = buffer.remaining()
                FloatArray(count) { ((buffer.get().toInt() and 0xff) - 128) / 128f }
            }
            AudioFormat.ENCODING_PCM_24BIT_PACKED -> {
                val count = buffer.remaining() / 3
                FloatArray(count) {
                    val b0 = buffer.get().toInt() and 0xff
                    val b1 = buffer.get().toInt() and 0xff
                    val b2 = buffer.get().toInt() and 0xff
                    var v = b0 or (b1 shl 8) or (b2 shl 16)
                    if ((v and 0x800000) != 0) v = v or -0x1000000
                    (v / 8388608f).coerceIn(-1f, 1f)
                }
            }
            AudioFormat.ENCODING_PCM_32BIT -> {
                val count = buffer.remaining() / 4
                FloatArray(count) { (buffer.int / 2147483648.0).toFloat().coerceIn(-1f, 1f) }
            }
            else -> {
                val count = buffer.remaining() / 2
                FloatArray(count) { buffer.short / 32768f }
            }
        }
    }
}

private interface SampleWriter {
    fun write(samples: FloatArray)
    fun close()
}

private class WavFileWriter(
    file: File,
    private val sampleRate: Int,
    private val channels: Int,
    private val format: OutputFormat
) : SampleWriter {
    private val raf = RandomAccessFile(file, "rw")
    private var dataBytes = 0L
    private var frames = 0L
    private val rf64 = format == OutputFormat.RF64
    private val bytesPerSample = when (format) {
        OutputFormat.WAV24 -> 3
        OutputFormat.WAV_FLOAT32 -> 4
        else -> 2
    }
    private val audioFormatCode = if (format == OutputFormat.WAV_FLOAT32) 3 else 1
    private val bitsPerSample = bytesPerSample * 8

    init {
        raf.setLength(0)
        if (rf64) writeRf64Header() else writeRiffHeader()
    }

    override fun write(samples: FloatArray) {
        val bytes = ByteArray(samples.size * bytesPerSample)
        var p = 0
        when (format) {
            OutputFormat.WAV24 -> samples.forEach { value ->
                val v = (value.coerceIn(-1f, 1f) * 8388607f).toInt()
                bytes[p++] = (v and 0xff).toByte()
                bytes[p++] = ((v ushr 8) and 0xff).toByte()
                bytes[p++] = ((v ushr 16) and 0xff).toByte()
            }
            OutputFormat.WAV_FLOAT32 -> samples.forEach { value ->
                val v = java.lang.Float.floatToIntBits(value.coerceIn(-1f, 1f))
                bytes[p++] = (v and 0xff).toByte()
                bytes[p++] = ((v ushr 8) and 0xff).toByte()
                bytes[p++] = ((v ushr 16) and 0xff).toByte()
                bytes[p++] = ((v ushr 24) and 0xff).toByte()
            }
            else -> samples.forEach { value ->
                val v = (value.coerceIn(-1f, 1f) * 32767f).toInt().toShort().toInt()
                bytes[p++] = (v and 0xff).toByte()
                bytes[p++] = ((v ushr 8) and 0xff).toByte()
            }
        }
        if (!rf64 && dataBytes + bytes.size > 0xffffffffL) {
            throw IllegalStateException("RIFF WAV exceeded 4 GB. Select RF64 for very large exports.")
        }
        raf.write(bytes)
        dataBytes += bytes.size
        frames += samples.size / channels
    }

    override fun close() {
        if (rf64) {
            raf.seek(20)
            writeLongLE(raf.length() - 8)
            writeLongLE(dataBytes)
            writeLongLE(frames)
        } else {
            raf.seek(4)
            writeIntLE((raf.length() - 8).toInt())
            raf.seek(40)
            writeIntLE(dataBytes.toInt())
        }
        raf.close()
    }

    private fun writeRiffHeader() {
        raf.writeBytes("RIFF")
        writeIntLE(0)
        raf.writeBytes("WAVE")
        writeFmt()
        raf.writeBytes("data")
        writeIntLE(0)
    }

    private fun writeRf64Header() {
        raf.writeBytes("RF64")
        writeIntLE(-1)
        raf.writeBytes("WAVE")
        raf.writeBytes("ds64")
        writeIntLE(28)
        writeLongLE(0L)
        writeLongLE(0L)
        writeLongLE(0L)
        writeIntLE(0)
        writeFmt()
        raf.writeBytes("data")
        writeIntLE(-1)
    }

    private fun writeFmt() {
        val blockAlign = channels * bytesPerSample
        raf.writeBytes("fmt ")
        writeIntLE(16)
        writeShortLE(audioFormatCode)
        writeShortLE(channels)
        writeIntLE(sampleRate)
        writeIntLE(sampleRate * blockAlign)
        writeShortLE(blockAlign)
        writeShortLE(bitsPerSample)
    }

    private fun writeShortLE(v: Int) {
        raf.write(v and 0xff)
        raf.write((v ushr 8) and 0xff)
    }

    private fun writeIntLE(v: Int) {
        raf.write(v and 0xff)
        raf.write((v ushr 8) and 0xff)
        raf.write((v ushr 16) and 0xff)
        raf.write((v ushr 24) and 0xff)
    }

    private fun writeLongLE(v: Long) {
        for (i in 0 until 8) raf.write(((v ushr (8 * i)) and 0xff).toInt())
    }
}

private class EncodedAudioWriter(
    file: File,
    private val sampleRate: Int,
    private val channels: Int,
    private val outputFormat: OutputFormat
) : SampleWriter {
    private val mime: String
    private val codec: MediaCodec
    private val muxer: MediaMuxer
    private val info = MediaCodec.BufferInfo()
    private var trackIndex = -1
    private var muxerStarted = false
    private var framesQueued = 0L
    private val bytesPerFrame = channels * 2

    init {
        require(channels in 1..2) { "AAC/Opus export currently supports mono or stereo audio" }
        mime = when (outputFormat) {
            OutputFormat.AAC_M4A -> MediaFormat.MIMETYPE_AUDIO_AAC
            OutputFormat.OPUS_OGG -> {
                require(Build.VERSION.SDK_INT >= 29) { "Opus/OGG export requires Android 10 or newer" }
                MediaFormat.MIMETYPE_AUDIO_OPUS
            }
            else -> error("Compressed writer received a PCM format")
        }
        val format = MediaFormat.createAudioFormat(mime, sampleRate, channels).apply {
            setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 32768)
            when (outputFormat) {
                OutputFormat.AAC_M4A -> {
                    setInteger(MediaFormat.KEY_BIT_RATE, 192_000)
                    setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
                }
                OutputFormat.OPUS_OGG -> setInteger(MediaFormat.KEY_BIT_RATE, 160_000)
                else -> Unit
            }
        }
        codec = MediaCodec.createEncoderByType(mime)
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        codec.start()
        muxer = MediaMuxer(
            file.absolutePath,
            if (outputFormat == OutputFormat.AAC_M4A) MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4
            else MediaMuxer.OutputFormat.MUXER_OUTPUT_OGG
        )
    }

    override fun write(samples: FloatArray) {
        val bytes = pcm16(samples)
        var offset = 0
        while (offset < bytes.size) {
            val inputIndex = codec.dequeueInputBuffer(10_000)
            if (inputIndex >= 0) {
                val buffer = codec.getInputBuffer(inputIndex) ?: error("Encoder input buffer missing")
                buffer.clear()
                var count = min(buffer.remaining(), bytes.size - offset)
                count -= count % bytesPerFrame
                if (count <= 0) error("Encoder input buffer is smaller than one audio frame")
                buffer.put(bytes, offset, count)
                val pts = framesQueued * 1_000_000L / sampleRate
                codec.queueInputBuffer(inputIndex, 0, count, pts, 0)
                framesQueued += count / bytesPerFrame
                offset += count
            }
            drain(false)
        }
    }

    override fun close() {
        var eosQueued = false
        while (!eosQueued) {
            val inputIndex = codec.dequeueInputBuffer(10_000)
            if (inputIndex >= 0) {
                val pts = framesQueued * 1_000_000L / sampleRate
                codec.queueInputBuffer(inputIndex, 0, 0, pts, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                eosQueued = true
            } else drain(false)
        }
        drain(true)
        runCatching { codec.stop() }
        codec.release()
        if (muxerStarted) runCatching { muxer.stop() }
        muxer.release()
    }

    private fun drain(endOfStream: Boolean) {
        var idle = 0
        while (true) {
            when (val outIndex = codec.dequeueOutputBuffer(info, if (endOfStream) 10_000 else 0)) {
                MediaCodec.INFO_TRY_AGAIN_LATER -> {
                    if (!endOfStream || ++idle > 100) return
                }
                MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                    check(!muxerStarted) { "Encoder format changed twice" }
                    trackIndex = muxer.addTrack(codec.outputFormat)
                    muxer.start()
                    muxerStarted = true
                }
                else -> if (outIndex >= 0) {
                    val buffer = codec.getOutputBuffer(outIndex) ?: error("Encoder output buffer missing")
                    if ((info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) info.size = 0
                    if (info.size > 0) {
                        check(muxerStarted) { "Encoder produced audio before muxer format" }
                        buffer.position(info.offset)
                        buffer.limit(info.offset + info.size)
                        muxer.writeSampleData(trackIndex, buffer, info)
                    }
                    val eos = (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0
                    codec.releaseOutputBuffer(outIndex, false)
                    if (eos) return
                }
            }
        }
    }

    private fun pcm16(samples: FloatArray): ByteArray {
        val bytes = ByteArray(samples.size * 2)
        var p = 0
        samples.forEach { value ->
            val v = (value.coerceIn(-1f, 1f) * 32767f).toInt().toShort().toInt()
            bytes[p++] = (v and 0xff).toByte()
            bytes[p++] = ((v ushr 8) and 0xff).toByte()
        }
        return bytes
    }
}
