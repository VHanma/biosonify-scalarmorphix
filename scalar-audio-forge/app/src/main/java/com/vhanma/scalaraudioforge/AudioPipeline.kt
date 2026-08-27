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
import android.os.ParcelFileDescriptor
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel
import kotlin.math.min

object AudioPipeline {
    data class SourceInfo(val mime:String,val sampleRate:Int,val channels:Int,val durationUs:Long){
        fun estimatedPcmBytes(outputChannels:Int,bytesPerSample:Int):Long{if(durationUs<=0L||sampleRate<=0||outputChannels<=0||bytesPerSample<=0)return -1L;val frames=durationUs.toDouble()/1_000_000.0*sampleRate;return(frames*outputChannels*bytesPerSample).toLong()}
    }
    data class Preview(val original:FloatArray,val processed:FloatArray)
    data class Result(val uri:Uri,val sampleRate:Int,val channels:Int,val frames:Long,val format:OutputFormat)

    fun inspect(context:Context,source:Uri):SourceInfo{
        val extractor=MediaExtractor();try{extractor.setDataSource(context,source,null);for(i in 0 until extractor.trackCount){val f=extractor.getTrackFormat(i);val mime=f.getString(MediaFormat.KEY_MIME).orEmpty();if(mime.startsWith("audio/")){val sr=f.getInteger(MediaFormat.KEY_SAMPLE_RATE);val ch=f.getInteger(MediaFormat.KEY_CHANNEL_COUNT);val duration=if(f.containsKey(MediaFormat.KEY_DURATION))f.getLong(MediaFormat.KEY_DURATION)else -1L;return SourceInfo(mime,sr,ch,duration)}};error("No decodable audio track found")}finally{extractor.release()}
    }

    fun chooseSafeOutput(requested:OutputFormat,info:SourceInfo,matrix:ForgeMatrix):OutputFormat{
        if(!requested.isPcm||requested.isRf64)return requested
        val outChannels=MatrixEngine.outputChannels(info.channels,matrix);val estimate=info.estimatedPcmBytes(outChannels,requested.pcmBytesPerSample)
        if(estimate<0L||estimate<0xF0000000L)return requested
        return when(requested){OutputFormat.WAV16->OutputFormat.RF64;OutputFormat.WAV24->OutputFormat.RF64_24;OutputFormat.WAV_FLOAT32->OutputFormat.RF64_FLOAT32;else->requested}
    }

    fun process(context:Context,source:Uri,destination:Uri,matrix:ForgeMatrix,outputFormat:OutputFormat,shouldCancel:()->Boolean={false},callback:(Float,Preview?)->Unit):Result{
        val extractor=MediaExtractor();extractor.setDataSource(context,source,null);var track=-1;var inputFormat:MediaFormat?=null
        for(i in 0 until extractor.trackCount){val f=extractor.getTrackFormat(i);val mime=f.getString(MediaFormat.KEY_MIME).orEmpty();if(mime.startsWith("audio/")){track=i;inputFormat=f;break}}
        require(track>=0&&inputFormat!=null){"No decodable audio track found"};extractor.selectTrack(track)
        val format=inputFormat!!;val mime=format.getString(MediaFormat.KEY_MIME)?:error("Audio MIME missing");val sampleRate=format.getInteger(MediaFormat.KEY_SAMPLE_RATE);val inputChannels=format.getInteger(MediaFormat.KEY_CHANNEL_COUNT);val outputChannels=MatrixEngine.outputChannels(inputChannels,matrix);val durationUs=if(format.containsKey(MediaFormat.KEY_DURATION))format.getLong(MediaFormat.KEY_DURATION)else 0L
        val decoder=MediaCodec.createDecoderByType(mime);decoder.configure(format,null,null,0);decoder.start()
        val pfd=context.contentResolver.openFileDescriptor(destination,"rwt")?:error("The selected destination could not be opened for direct streaming")
        val writer:SampleWriter=try{when{outputFormat.isPcm->WavFileWriter(pfd,sampleRate,outputChannels,outputFormat);outputFormat==OutputFormat.AAC_M4A||outputFormat==OutputFormat.OPUS_OGG->EncodedAudioWriter(pfd,sampleRate,outputChannels,outputFormat);else->error("Unsupported output format")}}catch(t:Throwable){runCatching{pfd.close()};runCatching{decoder.stop()};decoder.release();extractor.release();throw t}
        val info=MediaCodec.BufferInfo();var inputDone=false;var outputDone=false;var outputEncoding=AudioFormat.ENCODING_PCM_16BIT;var frameStart=0L;var lastProgress=-1
        try{
            while(!outputDone){
                if(shouldCancel())throw InterruptedException("Processing cancelled")
                if(!inputDone){val inIndex=decoder.dequeueInputBuffer(10_000);if(inIndex>=0){val buffer=decoder.getInputBuffer(inIndex)?:error("Decoder input buffer missing");buffer.clear();val size=extractor.readSampleData(buffer,0);if(size<0){decoder.queueInputBuffer(inIndex,0,0,0L,MediaCodec.BUFFER_FLAG_END_OF_STREAM);inputDone=true}else{decoder.queueInputBuffer(inIndex,0,size,extractor.sampleTime,0);extractor.advance()}}}
                when(val outIndex=decoder.dequeueOutputBuffer(info,10_000)){
                    MediaCodec.INFO_TRY_AGAIN_LATER->Unit
                    MediaCodec.INFO_OUTPUT_FORMAT_CHANGED->{val outFormat=decoder.outputFormat;outputEncoding=if(outFormat.containsKey(MediaFormat.KEY_PCM_ENCODING))outFormat.getInteger(MediaFormat.KEY_PCM_ENCODING)else AudioFormat.ENCODING_PCM_16BIT}
                    else->if(outIndex>=0){if(info.size>0){val raw=decoder.getOutputBuffer(outIndex)?:error("Decoder output buffer missing");raw.position(info.offset);raw.limit(info.offset+info.size);val pcm=toFloatPcm(raw.slice().order(ByteOrder.LITTLE_ENDIAN),outputEncoding);val processed=MatrixEngine.process(pcm,inputChannels,sampleRate,frameStart,matrix);writer.write(processed);frameStart+=pcm.size/inputChannels;val percent=if(durationUs>0L)((info.presentationTimeUs*100L/durationUs).toInt()).coerceIn(0,100)else 0;if(percent!=lastProgress&&(percent%2==0||percent==100)){lastProgress=percent;callback(percent/100f,Preview(pcm.copyOfRange(0,min(pcm.size,4096)),processed.copyOfRange(0,min(processed.size,4096))))}};outputDone=(info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM)!=0;decoder.releaseOutputBuffer(outIndex,false)}
                }
            }
        }finally{runCatching{writer.close()};runCatching{decoder.stop()};decoder.release();extractor.release()}
        callback(1f,null);return Result(destination,sampleRate,outputChannels,frameStart,outputFormat)
    }

    private fun toFloatPcm(buffer:ByteBuffer,encoding:Int):FloatArray=when(encoding){
        AudioFormat.ENCODING_PCM_FLOAT->FloatArray(buffer.remaining()/4){buffer.float.coerceIn(-1f,1f)}
        AudioFormat.ENCODING_PCM_8BIT->FloatArray(buffer.remaining()){((buffer.get().toInt()and 0xff)-128)/128f}
        AudioFormat.ENCODING_PCM_24BIT_PACKED->FloatArray(buffer.remaining()/3){val b0=buffer.get().toInt()and 0xff;val b1=buffer.get().toInt()and 0xff;val b2=buffer.get().toInt()and 0xff;var v=b0 or(b1 shl 8)or(b2 shl 16);if((v and 0x800000)!=0)v=v or -0x1000000;(v/8388608f).coerceIn(-1f,1f)}
        AudioFormat.ENCODING_PCM_32BIT->FloatArray(buffer.remaining()/4){(buffer.int/2147483648.0).toFloat().coerceIn(-1f,1f)}
        else->FloatArray(buffer.remaining()/2){buffer.short/32768f}
    }
}

private interface SampleWriter{fun write(samples:FloatArray);fun close()}

private class WavFileWriter(private val pfd:ParcelFileDescriptor,private val sampleRate:Int,private val channels:Int,private val format:OutputFormat):SampleWriter{
    private val channel:FileChannel=FileOutputStream(pfd.fileDescriptor).channel;private var dataBytes=0L;private var frames=0L;private val rf64=format.isRf64;private val bytesPerSample=format.pcmBytesPerSample.coerceAtLeast(2);private val audioFormatCode=if(format.isFloatPcm)3 else 1;private val bitsPerSample=bytesPerSample*8
    init{channel.truncate(0);channel.position(0);writeBuffer(if(rf64)rf64Header()else riffHeader())}
    override fun write(samples:FloatArray){val bytes=ByteArray(samples.size*bytesPerSample);var p=0;when(bytesPerSample){3->samples.forEach{value->val v=(value.coerceIn(-1f,1f)*8388607f).toInt();bytes[p++]=(v and 0xff).toByte();bytes[p++]=((v ushr 8)and 0xff).toByte();bytes[p++]=((v ushr 16)and 0xff).toByte()};4->samples.forEach{value->val v=java.lang.Float.floatToIntBits(value.coerceIn(-1f,1f));bytes[p++]=(v and 0xff).toByte();bytes[p++]=((v ushr 8)and 0xff).toByte();bytes[p++]=((v ushr 16)and 0xff).toByte();bytes[p++]=((v ushr 24)and 0xff).toByte()};else->samples.forEach{value->val v=(value.coerceIn(-1f,1f)*32767f).toInt().toShort().toInt();bytes[p++]=(v and 0xff).toByte();bytes[p++]=((v ushr 8)and 0xff).toByte()}};if(!rf64&&dataBytes+bytes.size>0xffffffffL)throw IllegalStateException("RIFF WAV exceeded 4 GB. Re-run using the matching RF64 format.");writeBuffer(ByteBuffer.wrap(bytes));dataBytes+=bytes.size;frames+=samples.size/channels}
    override fun close(){runCatching{if(rf64){writeLongAt(20L,channel.size()-8L);writeLongAt(28L,dataBytes);writeLongAt(36L,frames)}else{writeIntAt(4L,(channel.size()-8L).toInt());writeIntAt(40L,dataBytes.toInt())};channel.force(true)};runCatching{channel.close()};runCatching{pfd.close()}}
    private fun riffHeader():ByteBuffer{val blockAlign=channels*bytesPerSample;return ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN).apply{put("RIFF".toByteArray(Charsets.US_ASCII));putInt(0);put("WAVE".toByteArray(Charsets.US_ASCII));put("fmt ".toByteArray(Charsets.US_ASCII));putInt(16);putShort(audioFormatCode.toShort());putShort(channels.toShort());putInt(sampleRate);putInt(sampleRate*blockAlign);putShort(blockAlign.toShort());putShort(bitsPerSample.toShort());put("data".toByteArray(Charsets.US_ASCII));putInt(0);flip()}}
    private fun rf64Header():ByteBuffer{val blockAlign=channels*bytesPerSample;return ByteBuffer.allocate(80).order(ByteOrder.LITTLE_ENDIAN).apply{put("RF64".toByteArray(Charsets.US_ASCII));putInt(-1);put("WAVE".toByteArray(Charsets.US_ASCII));put("ds64".toByteArray(Charsets.US_ASCII));putInt(28);putLong(0L);putLong(0L);putLong(0L);putInt(0);put("fmt ".toByteArray(Charsets.US_ASCII));putInt(16);putShort(audioFormatCode.toShort());putShort(channels.toShort());putInt(sampleRate);putInt(sampleRate*blockAlign);putShort(blockAlign.toShort());putShort(bitsPerSample.toShort());put("data".toByteArray(Charsets.US_ASCII));putInt(-1);flip()}}
    private fun writeBuffer(buffer:ByteBuffer){while(buffer.hasRemaining())channel.write(buffer)};private fun writeIntAt(position:Long,value:Int){val old=channel.position();channel.position(position);writeBuffer(ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(value).apply{flip()});channel.position(old)};private fun writeLongAt(position:Long,value:Long){val old=channel.position();channel.position(position);writeBuffer(ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putLong(value).apply{flip()});channel.position(old)}
}

private class EncodedAudioWriter(private val pfd:ParcelFileDescriptor,private val sampleRate:Int,private val channels:Int,private val outputFormat:OutputFormat):SampleWriter{
    private val mime:String;private val codec:MediaCodec;private val muxer:MediaMuxer;private val info=MediaCodec.BufferInfo();private var trackIndex=-1;private var muxerStarted=false;private var framesQueued=0L;private val bytesPerFrame=channels*2
    init{require(channels in 1..2){"AAC/Opus export supports mono or stereo output"};mime=when(outputFormat){OutputFormat.AAC_M4A->MediaFormat.MIMETYPE_AUDIO_AAC;OutputFormat.OPUS_OGG->{require(Build.VERSION.SDK_INT>=29){"Opus/OGG export requires Android 10 or newer"};MediaFormat.MIMETYPE_AUDIO_OPUS};else->error("Compressed writer received a PCM format")};val mediaFormat=MediaFormat.createAudioFormat(mime,sampleRate,channels).apply{setInteger(MediaFormat.KEY_MAX_INPUT_SIZE,32768);when(outputFormat){OutputFormat.AAC_M4A->{setInteger(MediaFormat.KEY_BIT_RATE,192_000);setInteger(MediaFormat.KEY_AAC_PROFILE,MediaCodecInfo.CodecProfileLevel.AACObjectLC)};OutputFormat.OPUS_OGG->setInteger(MediaFormat.KEY_BIT_RATE,160_000);else->Unit}};codec=MediaCodec.createEncoderByType(mime);codec.configure(mediaFormat,null,null,MediaCodec.CONFIGURE_FLAG_ENCODE);codec.start();muxer=MediaMuxer(pfd.fileDescriptor,if(outputFormat==OutputFormat.AAC_M4A)MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4 else MediaMuxer.OutputFormat.MUXER_OUTPUT_OGG)}
    override fun write(samples:FloatArray){val bytes=pcm16(samples);var offset=0;while(offset<bytes.size){val inputIndex=codec.dequeueInputBuffer(10_000);if(inputIndex>=0){val buffer=codec.getInputBuffer(inputIndex)?:error("Encoder input buffer missing");buffer.clear();var count=min(buffer.remaining(),bytes.size-offset);count-=count%bytesPerFrame;if(count<=0)error("Encoder input buffer is smaller than one audio frame");buffer.put(bytes,offset,count);val pts=framesQueued*1_000_000L/sampleRate;codec.queueInputBuffer(inputIndex,0,count,pts,0);framesQueued+=count/bytesPerFrame;offset+=count};drain(false)}}
    override fun close(){var eosQueued=false;while(!eosQueued){val i=codec.dequeueInputBuffer(10_000);if(i>=0){val pts=framesQueued*1_000_000L/sampleRate;codec.queueInputBuffer(i,0,0,pts,MediaCodec.BUFFER_FLAG_END_OF_STREAM);eosQueued=true}else drain(false)};drain(true);runCatching{codec.stop()};codec.release();if(muxerStarted)runCatching{muxer.stop()};muxer.release();runCatching{pfd.close()}}
    private fun drain(endOfStream:Boolean){var idle=0;while(true){when(val outIndex=codec.dequeueOutputBuffer(info,if(endOfStream)10_000 else 0)){MediaCodec.INFO_TRY_AGAIN_LATER->if(!endOfStream||++idle>100)return;MediaCodec.INFO_OUTPUT_FORMAT_CHANGED->{check(!muxerStarted){"Encoder format changed twice"};trackIndex=muxer.addTrack(codec.outputFormat);muxer.start();muxerStarted=true};else->if(outIndex>=0){val buffer=codec.getOutputBuffer(outIndex)?:error("Encoder output buffer missing");if((info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG)!=0)info.size=0;if(info.size>0){check(muxerStarted){"Encoder produced audio before muxer format"};buffer.position(info.offset);buffer.limit(info.offset+info.size);muxer.writeSampleData(trackIndex,buffer,info)};val eos=(info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM)!=0;codec.releaseOutputBuffer(outIndex,false);if(eos)return}}}}
    private fun pcm16(samples:FloatArray):ByteArray{val out=ByteArray(samples.size*2);var p=0;samples.forEach{s->val v=(s.coerceIn(-1f,1f)*32767f).toInt().toShort().toInt();out[p++]=(v and 0xff).toByte();out[p++]=((v ushr 8)and 0xff).toByte()};return out}
}
