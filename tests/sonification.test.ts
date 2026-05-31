/**
 * BioSonify Sonification Engine Tests
 * Tests for deterministic, lossless pixel-to-sound translation.
 */

import { describe, it, expect } from "vitest";
import {
  synthesizeFromPixels,
  encodeWav,
  arrayBufferToBase64,
  extractWaveformBars,
  type PixelData,
  type SonificationOptions,
} from "../lib/sonification-engine";
import { FREQUENCY_LIBRARY } from "../lib/frequencies";

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makePixels(w: number, h: number, fill: PixelData): PixelData[] {
  return Array.from({ length: w * h }, () => ({ ...fill }));
}

function makeGradientPixels(w: number, h: number): PixelData[] {
  return Array.from({ length: w * h }, (_, i) => ({
    r: (i % 256),
    g: ((i * 2) % 256),
    b: ((i * 3) % 256),
    a: 255,
  }));
}

const BASE_OPTS: SonificationOptions = {
  mode: "SPECTRAL",
  durationSeconds: 1,
  carrierFrequencies: [528],
  sampleRate: 22050,
};

// ─── synthesizeFromPixels ─────────────────────────────────────────────────────

describe("synthesizeFromPixels", () => {
  it("returns a Float32Array of the correct length", () => {
    const pixels = makePixels(8, 8, { r: 128, g: 64, b: 200, a: 255 });
    const result = synthesizeFromPixels(pixels, 8, 8, BASE_OPTS);
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(BASE_OPTS.sampleRate * BASE_OPTS.durationSeconds);
  });

  it("is deterministic — same pixels always produce identical output", () => {
    const pixels = makeGradientPixels(16, 16);
    const a = synthesizeFromPixels(pixels, 16, 16, BASE_OPTS);
    const b = synthesizeFromPixels(pixels, 16, 16, BASE_OPTS);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toBe(b[i]);
    }
  });

  it("produces different output for different images", () => {
    const px1 = makePixels(8, 8, { r: 255, g: 0, b: 0, a: 255 });
    const px2 = makePixels(8, 8, { r: 0, g: 255, b: 0, a: 255 });
    const a = synthesizeFromPixels(px1, 8, 8, BASE_OPTS);
    const b = synthesizeFromPixels(px2, 8, 8, BASE_OPTS);
    let diff = false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) { diff = true; break; }
    }
    expect(diff).toBe(true);
  });

  it("produces silence for fully transparent pixels", () => {
    const pixels = makePixels(8, 8, { r: 128, g: 128, b: 128, a: 0 });
    const result = synthesizeFromPixels(pixels, 8, 8, BASE_OPTS);
    const maxAmp = Math.max(...Array.from(result).map(Math.abs));
    expect(maxAmp).toBeLessThan(0.001);
  });

  it("all samples are in the valid [-1, 1] range after normalization", () => {
    const pixels = makeGradientPixels(32, 32);
    const result = synthesizeFromPixels(pixels, 32, 32, BASE_OPTS);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBeGreaterThanOrEqual(-1.01);
      expect(result[i]).toBeLessThanOrEqual(1.01);
    }
  });

  it("WAVE_GENETICS mode is deterministic", () => {
    const pixels = makeGradientPixels(16, 16);
    const opts: SonificationOptions = { ...BASE_OPTS, mode: "WAVE_GENETICS" };
    const a = synthesizeFromPixels(pixels, 16, 16, opts);
    const b = synthesizeFromPixels(pixels, 16, 16, opts);
    for (let i = 0; i < a.length; i++) expect(a[i]).toBe(b[i]);
  });

  it("BIOFIELD mode is deterministic", () => {
    const pixels = makeGradientPixels(16, 16);
    const opts: SonificationOptions = {
      ...BASE_OPTS,
      mode: "BIOFIELD",
      carrierFrequencies: [7.83, 528, 40],
    };
    const a = synthesizeFromPixels(pixels, 16, 16, opts);
    const b = synthesizeFromPixels(pixels, 16, 16, opts);
    for (let i = 0; i < a.length; i++) expect(a[i]).toBe(b[i]);
  });

  it("different modes produce different outputs for the same image", () => {
    const pixels = makeGradientPixels(16, 16);
    const spectral = synthesizeFromPixels(pixels, 16, 16, { ...BASE_OPTS, mode: "SPECTRAL" });
    const wg = synthesizeFromPixels(pixels, 16, 16, { ...BASE_OPTS, mode: "WAVE_GENETICS" });
    let diff = false;
    for (let i = 0; i < spectral.length; i++) {
      if (spectral[i] !== wg[i]) { diff = true; break; }
    }
    expect(diff).toBe(true);
  });
});

// ─── encodeWav ────────────────────────────────────────────────────────────────

describe("encodeWav", () => {
  it("returns an ArrayBuffer with correct RIFF header", () => {
    const samples = new Float32Array(100).fill(0.5);
    const buffer = encodeWav(samples, 44100);
    const view = new DataView(buffer);
    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe("RIFF");
    expect(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))).toBe("WAVE");
  });

  it("encodes the correct sample rate in the header", () => {
    const samples = new Float32Array(100);
    const buffer = encodeWav(samples, 22050);
    const view = new DataView(buffer);
    expect(view.getUint32(24, true)).toBe(22050);
  });

  it("total buffer size is 44 + samples * 2 bytes", () => {
    const samples = new Float32Array(1000);
    const buffer = encodeWav(samples, 44100);
    expect(buffer.byteLength).toBe(44 + 1000 * 2);
  });
});

// ─── arrayBufferToBase64 ──────────────────────────────────────────────────────

describe("arrayBufferToBase64", () => {
  it("returns a non-empty base64 string", () => {
    const buf = new ArrayBuffer(8);
    const b64 = arrayBufferToBase64(buf);
    expect(typeof b64).toBe("string");
    expect(b64.length).toBeGreaterThan(0);
  });

  it("only contains valid base64 characters", () => {
    const buf = new ArrayBuffer(32);
    const b64 = arrayBufferToBase64(buf);
    expect(/^[A-Za-z0-9+/=]+$/.test(b64)).toBe(true);
  });

  it("is deterministic — same buffer always produces same base64", () => {
    const buf = new ArrayBuffer(16);
    const view = new Uint8Array(buf);
    view.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(arrayBufferToBase64(buf)).toBe(arrayBufferToBase64(buf));
  });

  it("does NOT use btoa — works on Android Hermes without browser globals", () => {
    // The function should work even if btoa is undefined
    const originalBtoa = (globalThis as any).btoa;
    delete (globalThis as any).btoa;
    const buf = new ArrayBuffer(8);
    const b64 = arrayBufferToBase64(buf);
    expect(b64.length).toBeGreaterThan(0);
    if (originalBtoa) (globalThis as any).btoa = originalBtoa;
  });
});

// ─── extractWaveformBars ──────────────────────────────────────────────────────

describe("extractWaveformBars", () => {
  it("returns exactly barCount values", () => {
    const samples = new Float32Array(44100).fill(0.5);
    const bars = extractWaveformBars(samples, 60);
    expect(bars.length).toBe(60);
  });

  it("returns values in [0, 1] range", () => {
    const samples = new Float32Array(44100);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i * 0.01);
    const bars = extractWaveformBars(samples, 60);
    bars.forEach((b) => {
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1.0001);
    });
  });

  it("returns all zeros for a silent buffer", () => {
    const samples = new Float32Array(44100).fill(0);
    const bars = extractWaveformBars(samples, 60);
    bars.forEach((b) => expect(b).toBe(0));
  });

  it("is deterministic", () => {
    const samples = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) samples[i] = Math.sin(i * 0.1);
    const a = extractWaveformBars(samples, 20);
    const b = extractWaveformBars(samples, 20);
    expect(a).toEqual(b);
  });
});

// ─── Frequency Library ────────────────────────────────────────────────────────

describe("FREQUENCY_LIBRARY", () => {
  it("contains at least 20 entries", () => {
    expect(FREQUENCY_LIBRARY.length).toBeGreaterThanOrEqual(20);
  });

  it("contains 528 Hz (DNA repair / MI Solfeggio)", () => {
    expect(FREQUENCY_LIBRARY.some((f) => f.hz === 528)).toBe(true);
  });

  it("contains 7.83 Hz (Schumann resonance)", () => {
    expect(FREQUENCY_LIBRARY.some((f) => f.hz === 7.83)).toBe(true);
  });

  it("contains 396 Hz (UT Solfeggio)", () => {
    expect(FREQUENCY_LIBRARY.some((f) => f.hz === 396)).toBe(true);
  });

  it("all entries have required fields", () => {
    FREQUENCY_LIBRARY.forEach((f) => {
      expect(typeof f.id).toBe("string");
      expect(typeof f.name).toBe("string");
      expect(typeof f.hz).toBe("number");
      expect(f.hz).toBeGreaterThan(0);
      expect(typeof f.effect).toBe("string");
      expect(typeof f.category).toBe("string");
    });
  });

  it("all IDs are unique", () => {
    const ids = FREQUENCY_LIBRARY.map((f) => f.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
