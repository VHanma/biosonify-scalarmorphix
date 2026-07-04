/**
 * PCM Raw Archive Encoder/Decoder v20
 * 
 * EXACT byte-for-byte file embedding into audio.
 * No compression. No lossy transforms. No bullshit.
 * 
 * Encoding: sample = (byte - 128) × 256
 * Decoding: byte = clip(round(sample / 256) + 128, 0, 255)
 * 
 * This is the DIRECT transport layer — any file goes in, exact same file comes out.
 * Like Gariaev's laser: the audio IS the data, not a representation of it.
 * 
 * Format: 48,000 Hz mono PCM_16
 * Transport cells: 8192 bytes per cell
 * Header: magic + version + asset_count + payload_length + SHA-256 + CRC32 + cell_size
 * Footer: magic + CRC32
 */

// ─── CRC32 (pure JS, no dependencies) ───────────────────────────────────────

const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── SHA-256 (pure JS, no Node crypto dependency) ────────────────────────────

function sha256(data: Uint8Array): Uint8Array {
  // Pure JS SHA-256 implementation for React Native compatibility
  const K: number[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;

  // Pre-processing: pad message
  const msgLen = data.length;
  const bitLen = msgLen * 8;
  const padLen = ((56 - (msgLen + 1) % 64) + 64) % 64;
  const totalLen = msgLen + 1 + padLen + 8;
  const msg = new Uint8Array(totalLen);
  msg.set(data);
  msg[msgLen] = 0x80;
  // Length in bits as big-endian 64-bit
  const dv = new DataView(msg.buffer);
  dv.setUint32(totalLen - 4, bitLen, false);

  // Initial hash values
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = dv.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const hash = new Uint8Array(32);
  const hv = new DataView(hash.buffer);
  hv.setUint32(0, h0, false); hv.setUint32(4, h1, false);
  hv.setUint32(8, h2, false); hv.setUint32(12, h3, false);
  hv.setUint32(16, h4, false); hv.setUint32(20, h5, false);
  hv.setUint32(24, h6, false); hv.setUint32(28, h7, false);
  return hash;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ARCHIVE_MAGIC = "SRC20A01"; // 8 bytes
const ARCHIVE_FOOTER = "SRC20END"; // 8 bytes
const ARCHIVE_VERSION = 1;
const CELL_SIZE = 8192; // bytes per transport cell
const SAMPLE_RATE = 48000; // Hz

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssetEntry {
  id: number;
  filename: string;
  extension: string;
  mimeType: string;
  rawBytes: Uint8Array;
}

export interface ArchiveContainer {
  assets: AssetEntry[];
  totalPayloadBytes: number;
  sha256: Uint8Array;
  crc32: number;
}

export interface ArchiveHeader {
  magic: string;
  version: number;
  assetCount: number;
  directoryOffset: number;
  payloadByteCount: number;
  payloadSha256: Uint8Array;
  payloadCrc32: number;
  cellSize: number;
}

// ─── Encoder ─────────────────────────────────────────────────────────────────

/**
 * Build a deterministic binary container from one or more files.
 * Returns raw bytes ready for PCM encoding.
 */
export function buildArchiveContainer(assets: AssetEntry[]): Uint8Array {
  // Build directory entries
  const directoryEntries: Uint8Array[] = [];
  let payloadOffset = 0;

  for (const asset of assets) {
    const filenameBytes = new TextEncoder().encode(asset.filename);
    const extBytes = new TextEncoder().encode(asset.extension);
    const mimeBytes = new TextEncoder().encode(asset.mimeType);
    const assetSha = sha256(asset.rawBytes);
    const assetCrc = crc32(asset.rawBytes);

    // Entry: id(4) + filenameLen(2) + filename + extLen(2) + ext + mimeLen(2) + mime
    //        + offset(8) + length(8) + sha256(32) + crc32(4)
    const entrySize = 4 + 2 + filenameBytes.length + 2 + extBytes.length +
      2 + mimeBytes.length + 8 + 8 + 32 + 4;
    const entry = new Uint8Array(entrySize);
    const ev = new DataView(entry.buffer);
    let off = 0;

    ev.setUint32(off, asset.id, true); off += 4;
    ev.setUint16(off, filenameBytes.length, true); off += 2;
    entry.set(filenameBytes, off); off += filenameBytes.length;
    ev.setUint16(off, extBytes.length, true); off += 2;
    entry.set(extBytes, off); off += extBytes.length;
    ev.setUint16(off, mimeBytes.length, true); off += 2;
    entry.set(mimeBytes, off); off += mimeBytes.length;
    // Use DataView on a separate buffer for 64-bit values
    const tempBuf = new ArrayBuffer(8);
    const tempDv = new DataView(tempBuf);
    tempDv.setFloat64(0, payloadOffset, true);
    entry.set(new Uint8Array(tempBuf), off); off += 8;
    tempDv.setFloat64(0, asset.rawBytes.length, true);
    entry.set(new Uint8Array(tempBuf), off); off += 8;
    entry.set(assetSha, off); off += 32;
    ev.setUint32(off, assetCrc, true);

    directoryEntries.push(entry);
    payloadOffset += asset.rawBytes.length;
  }

  // Concatenate all raw asset bytes
  const totalPayloadBytes = assets.reduce((sum, a) => sum + a.rawBytes.length, 0);
  const payloadData = new Uint8Array(totalPayloadBytes);
  let pOff = 0;
  for (const asset of assets) {
    payloadData.set(asset.rawBytes, pOff);
    pOff += asset.rawBytes.length;
  }

  // Concatenate directory
  const directorySize = directoryEntries.reduce((sum, e) => sum + e.length, 0);
  const directory = new Uint8Array(directorySize);
  let dOff = 0;
  for (const entry of directoryEntries) {
    directory.set(entry, dOff);
    dOff += entry.length;
  }

  // Compute payload hash and CRC
  const payloadSha = sha256(payloadData);
  const payloadCrc = crc32(payloadData);

  // Build header (fixed size: 8 + 4 + 4 + 8 + 8 + 32 + 4 + 4 = 72 bytes)
  const HEADER_SIZE = 72;
  const header = new Uint8Array(HEADER_SIZE);
  const hv = new DataView(header.buffer);
  let hOff = 0;

  // Magic (8 bytes)
  header.set(new TextEncoder().encode(ARCHIVE_MAGIC), hOff); hOff += 8;
  // Version (4 bytes)
  hv.setUint32(hOff, ARCHIVE_VERSION, true); hOff += 4;
  // Asset count (4 bytes)
  hv.setUint32(hOff, assets.length, true); hOff += 4;
  // Directory offset (8 bytes) — after header + payload
  const dirOffset = HEADER_SIZE + totalPayloadBytes;
  const tempBuf2 = new ArrayBuffer(8);
  new DataView(tempBuf2).setFloat64(0, dirOffset, true);
  header.set(new Uint8Array(tempBuf2), hOff); hOff += 8;
  // Payload byte count (8 bytes)
  new DataView(tempBuf2).setFloat64(0, totalPayloadBytes, true);
  header.set(new Uint8Array(tempBuf2), hOff); hOff += 8;
  // Payload SHA-256 (32 bytes)
  header.set(payloadSha, hOff); hOff += 32;
  // Payload CRC32 (4 bytes)
  hv.setUint32(hOff, payloadCrc, true); hOff += 4;
  // Cell size (4 bytes)
  hv.setUint32(hOff, CELL_SIZE, true);

  // Build footer (12 bytes: magic 8 + crc 4)
  const footer = new Uint8Array(12);
  footer.set(new TextEncoder().encode(ARCHIVE_FOOTER), 0);
  new DataView(footer.buffer).setUint32(8, payloadCrc, true);

  // Assemble: header + payload + directory + footer
  const totalSize = HEADER_SIZE + totalPayloadBytes + directorySize + 12;
  const container = new Uint8Array(totalSize);
  let cOff = 0;
  container.set(header, cOff); cOff += HEADER_SIZE;
  container.set(payloadData, cOff); cOff += totalPayloadBytes;
  container.set(directory, cOff); cOff += directorySize;
  container.set(footer, cOff);

  return container;
}

/**
 * Encode raw bytes into PCM_16 mono samples.
 * EXACT mapping: sample = (byte - 128) × 256
 * NO normalization, NO limiting, NO compression, NO dither.
 */
export function bytesToPcmSamples(rawBytes: Uint8Array): Int16Array {
  const samples = new Int16Array(rawBytes.length);
  for (let i = 0; i < rawBytes.length; i++) {
    samples[i] = (rawBytes[i] - 128) * 256;
  }
  return samples;
}

/**
 * Decode PCM_16 samples back to raw bytes.
 * EXACT inverse: byte = clip(round(sample / 256) + 128, 0, 255)
 */
export function pcmSamplesToBytes(samples: Int16Array): Uint8Array {
  const bytes = new Uint8Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const val = Math.round(samples[i] / 256) + 128;
    bytes[i] = Math.max(0, Math.min(255, val));
  }
  return bytes;
}

/**
 * Encode a complete archive container into a WAV ArrayBuffer.
 * 48,000 Hz mono PCM_16. One byte per sample.
 */
export function encodeArchiveToWav(container: Uint8Array): ArrayBuffer {
  const samples = bytesToPcmSamples(container);
  const numSamples = samples.length;
  const dataSize = numSamples * 2; // 16-bit = 2 bytes per sample
  const channels = 1;
  const bitsPerSample = 16;

  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const ws = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };

  // RIFF header
  ws(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  ws(8, "WAVE");

  // fmt chunk
  ws(12, "fmt ");
  v.setUint32(16, 16, true); // chunk size
  v.setUint16(20, 1, true); // PCM format
  v.setUint16(22, channels, true);
  v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, SAMPLE_RATE * channels * (bitsPerSample / 8), true);
  v.setUint16(32, channels * (bitsPerSample / 8), true);
  v.setUint16(34, bitsPerSample, true);

  // data chunk
  ws(36, "data");
  v.setUint32(40, dataSize, true);

  // Write samples
  for (let i = 0; i < numSamples; i++) {
    v.setInt16(44 + i * 2, samples[i], true);
  }

  return buf;
}

/**
 * Decode a WAV back to the archive container bytes.
 * Verifies header integrity and returns the original file data.
 */
export function decodeArchiveFromWav(wavBuffer: ArrayBuffer): Uint8Array | null {
  const v = new DataView(wavBuffer);

  // Skip WAV header (44 bytes for standard PCM)
  const dataOffset = 44;
  const numSamples = (wavBuffer.byteLength - dataOffset) / 2;
  const samples = new Int16Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    samples[i] = v.getInt16(dataOffset + i * 2, true);
  }

  const rawBytes = pcmSamplesToBytes(samples);

  // Verify magic
  const magic = new TextDecoder().decode(rawBytes.slice(0, 8));
  if (magic !== ARCHIVE_MAGIC) return null;

  // Read header
  const hv = new DataView(rawBytes.buffer, rawBytes.byteOffset);
  const version = hv.getUint32(8, true);
  if (version !== ARCHIVE_VERSION) return null;

  return rawBytes;
}

/**
 * Extract individual assets from a decoded archive container.
 */
export function extractAssetsFromContainer(container: Uint8Array): AssetEntry[] | null {
  const hv = new DataView(container.buffer, container.byteOffset);

  // Verify magic
  const magic = new TextDecoder().decode(container.slice(0, 8));
  if (magic !== ARCHIVE_MAGIC) return null;

  const assetCount = hv.getUint32(12, true);

  // Read directory offset and payload byte count as float64 (for large values)
  const dirOffset = new DataView(container.buffer, container.byteOffset + 16).getFloat64(0, true);
  const payloadByteCount = new DataView(container.buffer, container.byteOffset + 24).getFloat64(0, true);

  // Read expected SHA and CRC
  const expectedSha = container.slice(32, 64);
  const expectedCrc = hv.getUint32(64, true);

  // Verify payload integrity
  const payloadStart = 72; // HEADER_SIZE
  const payloadData = container.slice(payloadStart, payloadStart + payloadByteCount);
  const actualSha = sha256(payloadData);
  const actualCrc = crc32(payloadData);

  // Compare SHA
  for (let i = 0; i < 32; i++) {
    if (actualSha[i] !== expectedSha[i]) return null;
  }
  if (actualCrc !== expectedCrc) return null;

  // Verify footer
  const footerStart = payloadStart + payloadByteCount + (dirOffset - 72 - payloadByteCount + payloadByteCount);
  // Footer is at the very end: totalSize - 12
  const totalSize = container.length;
  const footerMagic = new TextDecoder().decode(container.slice(totalSize - 12, totalSize - 4));
  if (footerMagic !== ARCHIVE_FOOTER) return null;
  const footerCrc = new DataView(container.buffer, container.byteOffset + totalSize - 4).getUint32(0, true);
  if (footerCrc !== expectedCrc) return null;

  // Parse directory entries
  const assets: AssetEntry[] = [];
  let dOff = Math.round(dirOffset);

  for (let i = 0; i < assetCount; i++) {
    const dv = new DataView(container.buffer, container.byteOffset + dOff);
    const id = dv.getUint32(0, true);
    let eOff = 4;

    const fnLen = dv.getUint16(eOff, true); eOff += 2;
    const filename = new TextDecoder().decode(container.slice(dOff + eOff, dOff + eOff + fnLen));
    eOff += fnLen;

    const extLen = dv.getUint16(eOff, true); eOff += 2;
    const extension = new TextDecoder().decode(container.slice(dOff + eOff, dOff + eOff + extLen));
    eOff += extLen;

    const mimeLen = dv.getUint16(eOff, true); eOff += 2;
    const mimeType = new TextDecoder().decode(container.slice(dOff + eOff, dOff + eOff + mimeLen));
    eOff += mimeLen;

    const rawOffset = new DataView(container.buffer, container.byteOffset + dOff + eOff).getFloat64(0, true);
    eOff += 8;
    const rawLength = new DataView(container.buffer, container.byteOffset + dOff + eOff).getFloat64(0, true);
    eOff += 8;

    // Skip SHA-256 (32) + CRC32 (4) for now
    eOff += 36;

    const rawBytes = payloadData.slice(Math.round(rawOffset), Math.round(rawOffset + rawLength));
    assets.push({ id, filename, extension, mimeType, rawBytes });

    dOff += eOff;
  }

  return assets;
}

/**
 * Verify archive integrity: encode → decode → compare byte-for-byte.
 */
export function verifyArchiveIntegrity(
  originalAssets: AssetEntry[],
  archiveWav: ArrayBuffer
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const decoded = decodeArchiveFromWav(archiveWav);
  if (!decoded) {
    errors.push("Failed to decode WAV back to archive container");
    return { valid: false, errors };
  }

  const recovered = extractAssetsFromContainer(decoded);
  if (!recovered) {
    errors.push("Failed to extract assets from decoded container");
    return { valid: false, errors };
  }

  if (recovered.length !== originalAssets.length) {
    errors.push(`Asset count mismatch: expected ${originalAssets.length}, got ${recovered.length}`);
    return { valid: false, errors };
  }

  for (let i = 0; i < originalAssets.length; i++) {
    const orig = originalAssets[i];
    const rec = recovered[i];

    if (orig.rawBytes.length !== rec.rawBytes.length) {
      errors.push(`Asset ${i} (${orig.filename}): size mismatch ${orig.rawBytes.length} vs ${rec.rawBytes.length}`);
      continue;
    }

    for (let j = 0; j < orig.rawBytes.length; j++) {
      if (orig.rawBytes[j] !== rec.rawBytes[j]) {
        errors.push(`Asset ${i} (${orig.filename}): byte mismatch at offset ${j}`);
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Export constants for external use
export const PCM_ARCHIVE_SAMPLE_RATE = SAMPLE_RATE;
export const PCM_ARCHIVE_CELL_SIZE = CELL_SIZE;
