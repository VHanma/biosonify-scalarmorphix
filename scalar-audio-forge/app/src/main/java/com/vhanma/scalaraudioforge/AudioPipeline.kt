package com.vhanma.scalaraudioforge

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

object AudioPipeline {
    data class Result(val file: File, val sampleRate: Int, val channels: Int, val frames: Long, val rf64: Boolean)

    fun process(
        context: Context,
        source: Uri,
        destination: File,
        transforms: List<TransformSpec>,
        rf64: Boolean,
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
        val writer = WavFileWriter(destination, sampleRate, channels, rf64)
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
                        outputEncoding = if (outFormat.containsKey(MediaFormat.KEY_PCM_ENCODING)) outFormat.getInteger(MediaFormat.KEY_PCM_ENCODING) else AudioFormat.ENCODING_PCM_16BIT
                    }
                    else -> if (outIndex >= 0) {
                        if (info.size > 0) {
                            val raw = decoder.getOutputBuffer(outIndex) ?: error("Decoder output buffer missing")
                            raw.position(info.offset)
                            raw.limit(info.offset + info.size)
                            val pcm = toFloatPcm(raw.slice().order(ByteOrder.LITTLE_ENDIAN), outputEncoding)
                            val processed = DspEngine.process(pcm, channels, sampleRate, frameStart, transforms)
                            writer.write(processed)
                            frameStart += processed.size / channels
                            val percent = if (durationUs > 0) ((info.presentationTimeUs * 100L / durationUs).toInt()).coerceIn(0, 100) else 0
                            if (percent != lastProgress && percent % 2 == 0) {
                                lastProgress = percent
                                callback(percent / 100f, processed.take(minOf(processed.size, 4096)).toFloatArray())
                            }
                        }
                        outputDone = (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0
                        decoder.releaseOutputBuffer(outIndex, false)
                    }
                }
            }
        } finally {
            writer.close()
            runCatching { decoder.stop() }
            decoder.release()
            extractor.release()
        }
        callback(1f, null)
        return Result(destination, sampleRate, channels, frameStart, rf64)
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
            else -> {
                val count = buffer.remaining() / 2
                FloatArray(count) { buffer.short / 32768f }
            }
        }
    }
}

private class WavFileWriter(
    file: File,
    private val sampleRate: Int,
    private val channels: Int,
    private val rf64: Boolean
) {
    private val raf = RandomAccessFile(file, "rw")
    private var dataBytes = 0L
    private var frames = 0L

    init {
        raf.setLength(0)
        if (rf64) writeRf64Header() else writeRiffHeader()
    }

    fun write(samples: FloatArray) {
        val bytes = ByteArray(samples.size * 2)
        var p = 0
        samples.forEach { v ->
            val s = (v.coerceIn(-1f, 1f) * 32767f).toInt().toShort().toInt()
            bytes[p++] = (s and 0xff).toByte()
            bytes[p++] = ((s ushr 8) and 0xff).toByte()
        }
        if (!rf64 && dataBytes + bytes.size > 0xffffffffL) {
            throw IllegalStateException("RIFF WAV exceeded 4 GB. Select RF64 for very large exports.")
        }
        raf.write(bytes)
        dataBytes += bytes.size
        frames += samples.size / channels
    }

    fun close() {
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
        raf.writeBytes("fmt ")
        writeIntLE(16)
        writeShortLE(1)
        writeShortLE(channels)
        writeIntLE(sampleRate)
        writeIntLE(sampleRate * channels * 2)
        writeShortLE(channels * 2)
        writeShortLE(16)
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
