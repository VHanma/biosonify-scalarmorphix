import { describe, it, expect } from "vitest";
import {
  synthesizeFromPixels,
  encodeWav,
  arrayBufferToBase64DataUri,
  extractWaveformBars,
  type PixelData,
} from "../lib/sonification-engine";
import {
  FREQUENCY_LIBRARY,
  getDefaultEnabled,
  getByCategory,
} from "../lib/frequencies";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePixels(w: number, h: number): PixelData[] {
  const pixels: PixelData[] = [];
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      pixels.push({
        r: Math.floor((col / w) * 255),
        g: Math.floor((row / h) * 255),
        b: 128,
        a: 255,
      });
    }
  }
  return pixels;
}

// ─── Sonification Engine Tests ────────────────────────────────────────────────

describe("synthesizeFromPixels", () => {
  const W = 8, H = 4;
  const pixels = makePixels(W, H);

  it("produces a Float32Array of the correct length for SPECTRAL mode", () => {
    const samples = synthesizeFromPixels(pixels, W, H, {
      mode: "SPECTRAL",
      durationSeconds: 1,
      carrierFrequencies: [],
      sampleRate: 8000,
    });
    expect(samples).toBeInstanceOf(Float32Array);
    expect(samples.length).toBe(8000);
  });

  it("produces a Float32Array of the correct length for WAVE_GENETICS mode", () => {
    const samples = synthesizeFromPixels(pixels, W, H, {
      mode: "WAVE_GENETICS",
      durationSeconds: 1,
      carrierFrequencies: [],
      sampleRate: 8000,
    });
    expect(samples.length).toBe(8000);
  });

  it("produces a Float32Array of the correct length for BIOFIELD mode", () => {
    const samples = synthesizeFromPixels(pixels, W, H, {
      mode: "BIOFIELD",
      durationSeconds: 1,
      carrierFrequencies: [7.83, 528],
      sampleRate: 8000,
    });
    expect(samples.length).toBe(8000);
  });

  it("normalizes output to [-1, 1] range", () => {
    const samples = synthesizeFromPixels(pixels, W, H, {
      mode: "SPECTRAL",
      durationSeconds: 1,
      carrierFrequencies: [],
      sampleRate: 8000,
    });
    const maxAmp = Math.max(...Array.from(samples).map(Math.abs));
    expect(maxAmp).toBeLessThanOrEqual(1.0);
  });

  it("produces non-zero output for non-black images", () => {
    const samples = synthesizeFromPixels(pixels, W, H, {
      mode: "SPECTRAL",
      durationSeconds: 1,
      carrierFrequencies: [],
      sampleRate: 8000,
    });
    const hasNonZero = Array.from(samples).some((s) => s !== 0);
    expect(hasNonZero).toBe(true);
  });
});

// ─── WAV Encoding Tests ───────────────────────────────────────────────────────

describe("encodeWav", () => {
  it("produces a valid WAV ArrayBuffer with correct RIFF header", () => {
    const samples = new Float32Array(44100);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * (i / 44100)) * 0.5;
    }
    const buffer = encodeWav(samples, 44100);
    const view = new DataView(buffer);

    // Check RIFF header
    const riff = String.fromCharCode(
      view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)
    );
    expect(riff).toBe("RIFF");

    // Check WAVE marker
    const wave = String.fromCharCode(
      view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)
    );
    expect(wave).toBe("WAVE");

    // Check total size (36 + data size = 36 + 44100*2 = 36 + 88200 = 88236)
    expect(view.getUint32(4, true)).toBe(36 + 44100 * 2);
  });

  it("produces correct sample rate in header", () => {
    const samples = new Float32Array(100);
    const buffer = encodeWav(samples, 22050);
    const view = new DataView(buffer);
    expect(view.getUint32(24, true)).toBe(22050);
  });
});

describe("arrayBufferToBase64DataUri", () => {
  it("returns a string starting with data:audio/wav;base64,", () => {
    const buf = new ArrayBuffer(8);
    const uri = arrayBufferToBase64DataUri(buf);
    expect(uri.startsWith("data:audio/wav;base64,")).toBe(true);
  });
});

// ─── Waveform Bars Tests ──────────────────────────────────────────────────────

describe("extractWaveformBars", () => {
  it("returns exactly barCount values", () => {
    const samples = new Float32Array(44100).fill(0.5);
    const bars = extractWaveformBars(samples, 60);
    expect(bars.length).toBe(60);
  });

  it("returns values in [0, 1] range", () => {
    const samples = new Float32Array(44100);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i) * 0.8;
    const bars = extractWaveformBars(samples, 30);
    bars.forEach((b) => {
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    });
  });
});

// ─── Frequency Library Tests ──────────────────────────────────────────────────

describe("FREQUENCY_LIBRARY", () => {
  it("contains at least 20 entries", () => {
    expect(FREQUENCY_LIBRARY.length).toBeGreaterThanOrEqual(20);
  });

  it("all entries have required fields", () => {
    FREQUENCY_LIBRARY.forEach((f) => {
      expect(f.id).toBeTruthy();
      expect(f.name).toBeTruthy();
      expect(typeof f.hz).toBe("number");
      expect(f.hz).toBeGreaterThan(0);
      expect(f.category).toBeTruthy();
      expect(f.effect).toBeTruthy();
    });
  });

  it("includes 528 Hz (DNA repair Solfeggio)", () => {
    const entry = FREQUENCY_LIBRARY.find((f) => f.hz === 528);
    expect(entry).toBeDefined();
    expect(entry?.id).toBe("sol_528");
  });

  it("includes 7.83 Hz (Schumann fundamental)", () => {
    const entry = FREQUENCY_LIBRARY.find((f) => f.hz === 7.83);
    expect(entry).toBeDefined();
  });

  it("getDefaultEnabled returns only entries with enabledByDefault=true", () => {
    const defaults = getDefaultEnabled();
    defaults.forEach((f) => {
      expect(f.enabledByDefault).toBe(true);
    });
  });

  it("getByCategory returns only entries of that category", () => {
    const solfeggio = getByCategory("Solfeggio");
    solfeggio.forEach((f) => {
      expect(f.category).toBe("Solfeggio");
    });
    expect(solfeggio.length).toBeGreaterThan(0);
  });

  it("all IDs are unique", () => {
    const ids = FREQUENCY_LIBRARY.map((f) => f.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
