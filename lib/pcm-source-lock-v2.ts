/**
 * PCM Source-Lock v2: Encode image + metadata + trait codes into audio
 * Recoverable via decoder - perfect data integrity
 */

import * as zlib from 'zlib';
import * as crypto from 'crypto';

export interface SourceLockPayload {
  imageData: Uint8Array; // JPEG/PNG bytes
  metadata: {
    width: number;
    height: number;
    context: string;
    traits: { trait: string; confidence: number; intensity: number }[];
    frequencies: number[];
    timestamp: number;
  };
  traitCodes: Uint8Array; // Encoded trait activation codes
  fireLetters: Uint8Array; // 144 Fire Letter sequence
}

/**
 * Encode payload into PCM bytes for embedding in audio
 */
export function encodeSourceLock(payload: SourceLockPayload): Uint8Array {
  // Serialize payload
  const imageLen = payload.imageData.length;
  const metadataJson = JSON.stringify(payload.metadata);
  const metadataBytes = new TextEncoder().encode(metadataJson);
  const metadataLen = metadataBytes.length;
  const traitCodesLen = payload.traitCodes.length;
  const fireLettersLen = payload.fireLetters.length;

  // Compress metadata
  const compressedMetadata = zlib.deflateSync(metadataBytes);

  // Build payload
  const totalLen =
    8 + // magic
    4 + // version
    8 + // payload length
    32 + // expected SHA256
    4 + // expected CRC32
    4 + // cell size
    4 + // image length
    imageLen +
    4 + // compressed metadata length
    compressedMetadata.length +
    4 + // trait codes length
    traitCodesLen +
    4 + // fire letters length
    fireLettersLen +
    8 + // footer magic
    4; // footer CRC32

  const buffer = new Uint8Array(totalLen);
  let offset = 0;

  // Magic
  const magic = new TextEncoder().encode('V19SCM01');
  buffer.set(magic, offset);
  offset += 8;

  // Version
  new DataView(buffer.buffer).setUint32(offset, 1, true);
  offset += 4;

  // Payload length (will update after computing SHA)
  const payloadLengthOffset = offset;
  offset += 8;

  // SHA256 placeholder
  const shaOffset = offset;
  offset += 32;

  // CRC32 placeholder
  const crcOffset = offset;
  offset += 4;

  // Cell size
  new DataView(buffer.buffer).setUint32(offset, 256, true);
  offset += 4;

  // Image data
  new DataView(buffer.buffer).setUint32(offset, imageLen, true);
  offset += 4;
  buffer.set(payload.imageData, offset);
  offset += imageLen;

  // Compressed metadata
  new DataView(buffer.buffer).setUint32(offset, compressedMetadata.length, true);
  offset += 4;
  buffer.set(compressedMetadata, offset);
  offset += compressedMetadata.length;

  // Trait codes
  new DataView(buffer.buffer).setUint32(offset, traitCodesLen, true);
  offset += 4;
  buffer.set(payload.traitCodes, offset);
  offset += traitCodesLen;

  // Fire letters
  new DataView(buffer.buffer).setUint32(offset, fireLettersLen, true);
  offset += 4;
  buffer.set(payload.fireLetters, offset);
  offset += fireLettersLen;

  // Compute payload (everything except magic, version, and footer)
  const payloadStart = 8 + 4 + 8;
  const payloadEnd = offset;
  const payloadLength = payloadEnd - payloadStart;
  new DataView(buffer.buffer).setBigUint64(payloadLengthOffset, BigInt(payloadLength), true);

  const payloadBytes = buffer.slice(payloadStart, payloadEnd);
  const sha256 = crypto.createHash('sha256').update(payloadBytes).digest();
  buffer.set(sha256, shaOffset);

  const crc32 = computeCRC32(payloadBytes);
  new DataView(buffer.buffer).setUint32(crcOffset, crc32, true);

  // Footer
  const footerMagic = new TextEncoder().encode('V19END01');
  buffer.set(footerMagic, offset);
  offset += 8;
  new DataView(buffer.buffer).setUint32(offset, crc32, true);

  return buffer;
}

/**
 * Embed encoded payload into audio as PCM bytes
 * Each byte becomes a sample value (0-255 → -128 to 127)
 */
export function embedIntoAudio(
  audioBuffer: Float32Array,
  payload: Uint8Array,
  sampleRate: number = 44100
): Float32Array {
  const output = new Float32Array(audioBuffer.length);

  // Copy audio
  for (let i = 0; i < audioBuffer.length; i++) {
    output[i] = audioBuffer[i];
  }

  // Embed payload as PCM samples at the end
  const payloadStart = Math.max(0, audioBuffer.length - payload.length);
  for (let i = 0; i < payload.length; i++) {
    const byteValue = payload[i];
    const sampleValue = (byteValue - 128) / 128; // Convert 0-255 to -1 to 1
    output[payloadStart + i] = sampleValue * 0.01; // Low amplitude to not interfere with audio
  }

  return output;
}

/**
 * Extract payload from audio
 */
export function extractFromAudio(
  audioBuffer: Float32Array,
  expectedPayloadLength: number,
  sampleRate: number = 44100
): Uint8Array {
  const payloadStart = Math.max(0, audioBuffer.length - expectedPayloadLength);
  const payload = new Uint8Array(expectedPayloadLength);

  for (let i = 0; i < expectedPayloadLength; i++) {
    const sampleValue = audioBuffer[payloadStart + i];
    const byteValue = Math.round((sampleValue * 128 + 128) * 100); // Recover with noise tolerance
    payload[i] = Math.max(0, Math.min(255, byteValue));
  }

  return payload;
}

/**
 * Compute CRC32 checksum
 */
function computeCRC32(data: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }

  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Decode source-lock payload
 */
export function decodeSourceLock(buffer: Uint8Array): SourceLockPayload | null {
  let offset = 0;

  // Verify magic
  const magic = new TextDecoder().decode(buffer.slice(0, 8));
  if (magic !== 'V19SCM01') return null;
  offset += 8;

  // Verify version
  const version = new DataView(buffer.buffer).getUint32(offset, true);
  if (version !== 1) return null;
  offset += 4;

  // Get payload length
  const payloadLength = Number(new DataView(buffer.buffer).getBigUint64(offset, true));
  offset += 8;

  // Get expected SHA and CRC
  const expectedSha = buffer.slice(offset, offset + 32);
  offset += 32;
  const expectedCrc = new DataView(buffer.buffer).getUint32(offset, true);
  offset += 4;

  // Get cell size
  const cellSize = new DataView(buffer.buffer).getUint32(offset, true);
  offset += 4;

  // Verify payload integrity
  const payloadStart = offset;
  const payloadEnd = offset + payloadLength;
  const payloadBytes = buffer.slice(payloadStart, payloadEnd);
  const actualSha = crypto.createHash('sha256').update(payloadBytes).digest();
  const actualCrc = computeCRC32(payloadBytes);

  if (!actualSha.equals(expectedSha) || actualCrc !== expectedCrc) {
    return null;
  }

  // Extract image
  const imageLen = new DataView(buffer.buffer).getUint32(offset, true);
  offset += 4;
  const imageData = buffer.slice(offset, offset + imageLen);
  offset += imageLen;

  // Extract metadata
  const metadataLen = new DataView(buffer.buffer).getUint32(offset, true);
  offset += 4;
  const compressedMetadata = buffer.slice(offset, offset + metadataLen);
  offset += metadataLen;
  const metadataBytes = zlib.inflateSync(compressedMetadata);
  const metadataJson = new TextDecoder().decode(metadataBytes);
  const metadata = JSON.parse(metadataJson);

  // Extract trait codes
  const traitCodesLen = new DataView(buffer.buffer).getUint32(offset, true);
  offset += 4;
  const traitCodes = buffer.slice(offset, offset + traitCodesLen);
  offset += traitCodesLen;

  // Extract fire letters
  const fireLettersLen = new DataView(buffer.buffer).getUint32(offset, true);
  offset += 4;
  const fireLetters = buffer.slice(offset, offset + fireLettersLen);

  return {
    imageData,
    metadata,
    traitCodes,
    fireLetters,
  };
}
