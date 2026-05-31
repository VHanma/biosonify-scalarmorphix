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
 * No data: URIs on native — all files written to file:// cache paths.
 */

import { Platform, Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { encodeWav, arrayBufferToBase64 } from "./sonification-engine";
import type { FrequencyEntry } from "./frequencies";

// ─── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_RATE = 44100;

// ─── Tone generation ──────────────────────────────────────────────────────────

/** Generate a pure sine tone for a frequency entry. Sub-20 Hz uses AM modulation. */
function generateToneSamples(entry: FrequencyEntry, durationSeconds: number): Float32Array {
  const total = Math.round(SAMPLE_RATE * durationSeconds);
  const samples = new Float32Array(total);
  const audibleHz = entry.hz < 20 ? 200 : Math.min(entry.hz, 14000);
  const modHz = entry.hz < 20 ? entry.hz : 0;
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
  const pcmStart = 44; // standard WAV header is 44 bytes
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

/**
 * Write a WAV ArrayBuffer to a cache file and return a file:// URI.
 * On web, returns a data: URI (web-only branch, never called on Android).
 */
async function writeWavBuffer(wavBuffer: ArrayBuffer, filename: string): Promise<string> {
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

/** Write Float32Array samples to a WAV file and return a file:// URI. */
async function writeSamplesToFile(samples: Float32Array, filename: string): Promise<string> {
  const wavBuffer = encodeWav(samples, SAMPLE_RATE);
  return writeWavBuffer(wavBuffer, filename);
}

// ─── Device save / share ──────────────────────────────────────────────────────

/** Save a file:// path to the device media library, falling back to share. */
async function saveToDevice(fileUri: string, label: string): Promise<void> {
  if (Platform.OS === "web") {
    // On web, fileUri is a data: URI — trigger download via anchor element
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
 * Accepts the raw WAV ArrayBuffer from the synthesis engine.
 */
export async function saveIndividualSonification(
  wavBuffer: ArrayBuffer,
  label = "BioSonify_Image_Sonification"
): Promise<void> {
  const filename = `${label}.wav`;
  const fileUri = await writeWavBuffer(wavBuffer, filename);
  await saveToDevice(fileUri, filename);
}

/**
 * Save a single frequency tone as a WAV (1 minute duration).
 */
export async function saveIndividualTone(entry: FrequencyEntry): Promise<void> {
  const samples = generateToneSamples(entry, 60);
  const safeName = entry.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  const filename = `BioSonify_${safeName}_${Math.round(entry.hz)}Hz.wav`;
  const fileUri = await writeSamplesToFile(samples, filename);
  await saveToDevice(fileUri, filename);
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
    Alert.alert(
      "No frequencies selected",
      "Enable at least one frequency in the Frequency Library first."
    );
    return;
  }

  const tracks = enabledEntries.map((e) => generateToneSamples(e, durationSeconds));
  const mixed = mixSamples(tracks);
  const filename = `BioSonify_Combined_${enabledEntries.length}Frequencies.wav`;
  const fileUri = await writeSamplesToFile(mixed, filename);
  await saveToDevice(fileUri, filename);
}

/**
 * Save the image sonification stacked (layered) with all enabled frequency tones.
 * The image data is preserved at full amplitude; tones are blended at 50%.
 * Accepts the raw WAV ArrayBuffer from the synthesis engine.
 */
export async function saveStackedOutput(
  wavBuffer: ArrayBuffer,
  enabledEntries: FrequencyEntry[],
  durationSeconds: number
): Promise<void> {
  // Decode the image sonification WAV back to samples
  const imageTrack = decodeWavBufferToSamples(wavBuffer);

  // Re-generate frequency tones at 50% amplitude to blend under the image data
  const toneTracks = enabledEntries.map((e) => {
    const raw = generateToneSamples(e, durationSeconds);
    for (let i = 0; i < raw.length; i++) raw[i] *= 0.5;
    return raw;
  });

  const allTracks = [imageTrack, ...toneTracks];
  const mixed = mixSamples(allTracks);
  const filename = `BioSonify_Stacked_Image+${enabledEntries.length}Frequencies.wav`;
  const fileUri = await writeSamplesToFile(mixed, filename);
  await saveToDevice(fileUri, filename);
}
