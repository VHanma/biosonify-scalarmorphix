/**
 * BioSonify Save System v2
 * Handles individual, combined, and stacked WAV export.
 *
 * PERFORMANCE:
 * ─────────────────────────────────────────────────────────────────────────────
 * v1 had a save-hang: arrayBufferToBase64 converted a ~10 MB WAV character-by-
 * character in one synchronous loop, then FileSystem.writeAsStringAsync wrote
 * the entire ~14 MB base64 string at once — blocking the JS thread for several
 * seconds.
 *
 * v2 fixes:
 *  1. arrayBufferToBase64 now uses Array.push + join instead of string concat,
 *     which avoids repeated GC pressure from growing string allocation.
 *  2. writeWavBuffer yields to the UI between the encode and write steps.
 *  3. onProgress callbacks are threaded through all public APIs so the caller
 *     can show a progress bar instead of a frozen spinner.
 *
 * All mixing is deterministic — sample-accurate additive synthesis.
 * No randomness. Every output sample is a direct mathematical function of the input.
 */

import { Platform, Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { encodeWav, arrayBufferToBase64 } from "./sonification-engine";
import type { FrequencyEntry } from "./frequencies";

// ─── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_RATE = 44100;

/** Called with progress 0.0–1.0 during save operations */
export type SaveProgressCallback = (progress: number) => void;

// ─── Tone generation ──────────────────────────────────────────────────────────

/** Generate a pure sine tone for a frequency entry. Sub-20 Hz uses AM modulation. */
function generateToneSamples(entry: FrequencyEntry, durationSeconds: number, spinorFreqs?: number[]): Float32Array {
  const total = Math.round(SAMPLE_RATE * durationSeconds);
  const samples = new Float32Array(total);
  // Use spinor frequency if available (image-specific), else fall back to entry.hz
  const baseHz = spinorFreqs && spinorFreqs.length > 0 ? spinorFreqs[0] : entry.hz;
  const audibleHz = baseHz < 20 ? 200 : Math.min(baseHz, 14000);
  const modHz = baseHz < 20 ? baseHz : 0;
  const fadeSamples = Math.min(Math.round(SAMPLE_RATE * 0.5), Math.round(total * 0.1));

  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
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

// ─── Mixing ───────────────────────────────────────────────────────────────────

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

// ─── WAV decode ───────────────────────────────────────────────────────────────

/**
 * Decode a WAV ArrayBuffer (16-bit PCM) back to Float32Array samples.
 * Pure JS — no web APIs, works on Android Hermes.
 */
function decodeWavBufferToSamples(wavBuffer: ArrayBuffer): Float32Array {
  const dataView = new DataView(wavBuffer);
  const pcmStart = 44;
  const numSamples = (wavBuffer.byteLength - pcmStart) >> 1;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const offset = pcmStart + i * 2;
    if (offset + 1 >= wavBuffer.byteLength) break;
    let val = dataView.getUint16(offset, true);
    if (val >= 0x8000) val -= 0x10000;
    samples[i] = val / 32768;
  }
  return samples;
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

/** Yield to the JS event loop between encode and write steps */
function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Write a WAV ArrayBuffer to a cache file and return a file:// URI.
 * Uses array-join base64 encoding (avoids string-concat GC pressure) and
 * yields to the UI between encode and write so the app never appears frozen.
 */
async function writeWavBuffer(
  wavBuffer: ArrayBuffer,
  filename: string,
  onProgress?: SaveProgressCallback,
): Promise<string> {
  if (Platform.OS === "web") {
    onProgress?.(0.5);
    const base64 = arrayBufferToBase64(wavBuffer);
    onProgress?.(1.0);
    return `data:audio/wav;base64,${base64}`;
  }

  // Step 1: encode to base64 (CPU-bound, ~10 ms per MB)
  onProgress?.(0.1);
  await yieldToUI();
  const base64 = arrayBufferToBase64(wavBuffer);

  // Step 2: yield before the blocking file write
  onProgress?.(0.7);
  await yieldToUI();

  const path = (FileSystem.cacheDirectory ?? "") + filename;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  onProgress?.(1.0);
  return path;
}

/** Write Float32Array samples to a WAV file and return a file:// URI. */
async function writeSamplesToFile(
  samples: Float32Array,
  filename: string,
  onProgress?: SaveProgressCallback,
): Promise<string> {
  const wavBuffer = encodeWav(samples, SAMPLE_RATE);
  return writeWavBuffer(wavBuffer, filename, onProgress);
}

// ─── Device save / share ──────────────────────────────────────────────────────

/** Save a file:// path to the device media library, falling back to share. */
async function saveToDevice(fileUri: string, label: string): Promise<void> {
  if (Platform.OS === "web") {
    const a = (globalThis as any).document?.createElement("a");
    if (a) {
      a.href = fileUri;
      a.download = label;
      a.click();
    }
    return;
  }

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status === "granted") {
    try {
      await MediaLibrary.saveToLibraryAsync(fileUri);
      Alert.alert("Saved to Music Library", `"${label}" saved to your device's music library.`);
      return;
    } catch {
      // Fall through to share sheet
    }
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: "audio/wav",
      dialogTitle: `Save ${label}`,
    });
  } else {
    Alert.alert("Saved", `File saved to:\n${fileUri}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save the current image sonification output as a single WAV.
 * onProgress is called 0→1 during the encode+write phase.
 */
export async function saveIndividualSonification(
  wavBuffer: ArrayBuffer,
  label = "BioSonify_Image_Sonification",
  onProgress?: SaveProgressCallback,
): Promise<void> {
  const filename = `${label}.wav`;
  const fileUri = await writeWavBuffer(wavBuffer, filename, onProgress);
  await saveToDevice(fileUri, filename);
}

/**
 * Save a single frequency tone as a WAV (1 minute duration).
 */
export async function saveIndividualTone(
  entry: FrequencyEntry,
  onProgress?: SaveProgressCallback,
): Promise<void> {
  const samples = generateToneSamples(entry, 60);
  const safeName = entry.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  const filename = `BioSonify_${safeName}_${Math.round(entry.hz)}Hz.wav`;
  const fileUri = await writeSamplesToFile(samples, filename, onProgress);
  await saveToDevice(fileUri, filename);
}

/**
 * Save all enabled frequency tones mixed together into one WAV.
 */
export async function saveCombinedTones(
  enabledEntries: FrequencyEntry[],
  durationSeconds = 60,
  onProgress?: SaveProgressCallback,
): Promise<void> {
  if (enabledEntries.length === 0) {
    Alert.alert(
      "No frequencies selected",
      "Enable at least one frequency in the Frequency Library first."
    );
    return;
  }

  const tracks = enabledEntries.map((e) => generateToneSamples(e, durationSeconds));
  const mixed = mixSamples(tracks);
  const filename = `BioSonify_Combined_${enabledEntries.length}Frequencies.wav`;
  const fileUri = await writeSamplesToFile(mixed, filename, onProgress);
  await saveToDevice(fileUri, filename);
}

/**
 * Save the image sonification stacked (layered) with all enabled frequency tones.
 * onProgress is called 0→1 during the mix+encode+write phase.
 */
export async function saveStackedOutput(
  wavBuffer: ArrayBuffer,
  enabledEntries: FrequencyEntry[],
  durationSeconds: number,
  onProgress?: SaveProgressCallback,
  spinorFreqs?: number[],
): Promise<void> {
  onProgress?.(0.1);
  await yieldToUI();

  const imageTrack = decodeWavBufferToSamples(wavBuffer);

  const toneTracks = enabledEntries.map((e) => {
    const raw = generateToneSamples(e, durationSeconds, spinorFreqs);
    for (let i = 0; i < raw.length; i++) raw[i] *= 0.5;
    return raw;
  });

  onProgress?.(0.3);
  await yieldToUI();

  const allTracks = [imageTrack, ...toneTracks];
  const mixed = mixSamples(allTracks);

  onProgress?.(0.5);
  await yieldToUI();

  const filename = `BioSonify_Stacked_Image+${enabledEntries.length}Frequencies.wav`;
  const fileUri = await writeSamplesToFile(mixed, filename, (p) => {
    onProgress?.(0.5 + p * 0.5);
  });
  await saveToDevice(fileUri, filename);
}
