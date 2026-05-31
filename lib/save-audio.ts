/**
 * BioSonify Save System
 * Handles individual, combined, and stacked WAV export.
 *
 * - Individual: one WAV per audio (image sonification or frequency tone)
 * - Combined: all enabled frequency tones mixed into one WAV
 * - Stacked: image sonification + all enabled frequency tones layered together
 *
 * All mixing is deterministic — sample-accurate additive synthesis.
 * No randomness. Every output sample is a direct mathematical function of the input data.
 */

import { Platform, Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { encodeWav, arrayBufferToBase64 } from "./sonification-engine";
import type { FrequencyEntry } from "./frequencies";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SAMPLE_RATE = 44100;

/** Generate a pure sine tone for a frequency entry. Sub-20 Hz uses AM modulation. */
function generateToneSamples(entry: FrequencyEntry, durationSeconds: number): Float32Array {
  const total = Math.round(SAMPLE_RATE * durationSeconds);
  const samples = new Float32Array(total);
  const audibleHz = entry.hz < 20 ? 200 : Math.min(entry.hz, 14000);
  const modHz = entry.hz < 20 ? entry.hz : 0;
  const fadeSamples = Math.min(Math.round(SAMPLE_RATE * 0.5), Math.round(total * 0.1));

  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    // Linear fade in/out — deterministic, no randomness
    const fade =
      i < fadeSamples
        ? i / fadeSamples
        : i > total - fadeSamples
        ? (total - i) / fadeSamples
        : 1;
    let s = Math.sin(2 * Math.PI * audibleHz * t) * 0.7 * fade;
    if (modHz > 0) {
      s *= 0.5 + 0.5 * Math.sin(2 * Math.PI * modHz * t);
    }
    samples[i] = s;
  }
  return samples;
}

/** Mix multiple Float32Arrays into one, normalizing to prevent clipping. */
function mixSamples(tracks: Float32Array[]): Float32Array {
  if (tracks.length === 0) return new Float32Array(0);
  const maxLen = Math.max(...tracks.map((t) => t.length));
  const out = new Float32Array(maxLen);

  for (const track of tracks) {
    for (let i = 0; i < track.length; i++) {
      out[i] += track[i];
    }
  }

  // Normalize to prevent clipping — find peak and scale down if needed
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    const abs = Math.abs(out[i]);
    if (abs > peak) peak = abs;
  }
  if (peak > 0.95) {
    const scale = 0.95 / peak;
    for (let i = 0; i < out.length; i++) {
      out[i] *= scale;
    }
  }

  return out;
}

/** Write a WAV buffer to a file:// path on native, or return a data: URI on web. */
async function writeWav(samples: Float32Array, filename: string): Promise<string> {
  const wavBuffer = encodeWav(samples, SAMPLE_RATE);
  if (Platform.OS === "web") {
    const base64 = arrayBufferToBase64(wavBuffer);
    return `data:audio/wav;base64,${base64}`;
  }
  const path = (FileSystem.cacheDirectory ?? "") + filename;
  await FileSystem.writeAsStringAsync(path, arrayBufferToBase64(wavBuffer), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

/** Save a file:// path to the device media library, falling back to share. */
async function saveToDevice(path: string, label: string): Promise<void> {
  if (Platform.OS === "web") {
    // On web, path is a data: URI — trigger download
    const a = (global as any).document?.createElement("a");
    if (a) {
      a.href = path;
      a.download = label;
      a.click();
    }
    return;
  }

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status === "granted") {
    try {
      await MediaLibrary.saveToLibraryAsync(path);
      Alert.alert("✓ Saved to Music Library", `"${label}" saved to your device's music library.`);
      return;
    } catch {
      // Fall through to share
    }
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: "audio/wav",
      dialogTitle: `Save ${label}`,
    });
  } else {
    Alert.alert("Saved", `File saved to cache:\n${path}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save the current image sonification output as a single WAV.
 * The audioDataUri comes from the sonification engine output.
 */
export async function saveIndividualSonification(
  audioDataUri: string,
  label = "BioSonify_Image_Sonification"
): Promise<void> {
  const filename = `${label}.wav`;

  if (Platform.OS === "web") {
    const a = (global as any).document?.createElement("a");
    if (a) {
      a.href = audioDataUri;
      a.download = filename;
      a.click();
    }
    return;
  }

  const base64 = audioDataUri.replace(/^data:audio\/wav;base64,/, "");
  const path = (FileSystem.cacheDirectory ?? "") + filename;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await saveToDevice(path, filename);
}

/**
 * Save a single frequency tone as a WAV (1 minute duration).
 */
export async function saveIndividualTone(entry: FrequencyEntry): Promise<void> {
  const samples = generateToneSamples(entry, 60);
  const safeName = entry.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  const filename = `BioSonify_${safeName}_${Math.round(entry.hz)}Hz.wav`;
  const path = await writeWav(samples, filename);
  await saveToDevice(path, filename);
}

/**
 * Save all enabled frequency tones mixed together into one WAV.
 * Each tone is generated at equal amplitude and mixed additively.
 */
export async function saveCombinedTones(
  enabledEntries: FrequencyEntry[],
  durationSeconds = 60
): Promise<void> {
  if (enabledEntries.length === 0) {
    Alert.alert("No frequencies selected", "Enable at least one frequency in the Frequency Library first.");
    return;
  }

  const tracks = enabledEntries.map((e) => generateToneSamples(e, durationSeconds));
  const mixed = mixSamples(tracks);
  const filename = `BioSonify_Combined_${enabledEntries.length}Frequencies.wav`;
  const path = await writeWav(mixed, filename);
  await saveToDevice(path, filename);
}

/**
 * Save the image sonification stacked (layered) with all enabled frequency tones.
 * The image data is preserved at full amplitude; tones are blended at 50%.
 */
export async function saveStackedOutput(
  audioDataUri: string,
  enabledEntries: FrequencyEntry[],
  durationSeconds: number
): Promise<void> {
  // Decode the image sonification WAV back to samples
  const base64 = audioDataUri.replace(/^data:audio\/wav;base64,/, "");

  // Re-generate frequency tones at 50% amplitude to blend under the image data
  const toneTracks = enabledEntries.map((e) => {
    const raw = generateToneSamples(e, durationSeconds);
    // Scale tones to 50% so image data is dominant
    for (let i = 0; i < raw.length; i++) raw[i] *= 0.5;
    return raw;
  });

  // Decode the WAV PCM samples from the base64 data
  const imageTrack = decodeWavBase64ToSamples(base64);

  const allTracks = [imageTrack, ...toneTracks];
  const mixed = mixSamples(allTracks);
  const filename = `BioSonify_Stacked_Image+${enabledEntries.length}Frequencies.wav`;
  const path = await writeWav(mixed, filename);
  await saveToDevice(path, filename);
}

/**
 * Decode a base64 WAV (16-bit PCM) back to Float32Array samples.
 * This is a pure-JS WAV decoder — no web APIs required.
 */
function decodeWavBase64ToSamples(base64: string): Float32Array {
  // Decode base64 to byte array using pure JS (no atob — Hermes safe)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = (clean.length * 3) >> 2;
  const bytes = new Uint8Array(len);
  let bi = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)];
    const d = lookup[clean.charCodeAt(i + 3)];
    bytes[bi++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length - 1) bytes[bi++] = ((b & 0xf) << 4) | (c >> 2);
    if (i + 3 < clean.length - 1) bytes[bi++] = ((c & 0x3) << 6) | d;
  }

  // WAV header is 44 bytes; PCM data starts at offset 44
  // Each sample is 2 bytes (16-bit signed little-endian)
  const dataView = new DataView(bytes.buffer);
  const pcmStart = 44;
  const numSamples = (bytes.length - pcmStart) >> 1;
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const offset = pcmStart + i * 2;
    if (offset + 1 >= bytes.length) break;
    // Read 16-bit signed little-endian
    let val = dataView.getUint16(offset, true);
    if (val >= 0x8000) val -= 0x10000;
    samples[i] = val / 32768;
  }

  return samples;
}
