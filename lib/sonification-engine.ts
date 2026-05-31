/**
 * BioSonify Deterministic Sonification Engine v2
 *
 * CORE PRINCIPLE: Every audio sample is a mathematically exact, deterministic
 * function of the image's pixel data. There is ZERO randomness. The same image
 * always produces the exact same audio. Every pixel's R, G, B, brightness,
 * hue, saturation, and position all contribute to the output.
 *
 * ── MODE 1: SPECTRAL SCAN (Gariaev biophoton laser scan model) ─────────────
 * The image is treated as a 2D spectrogram — exactly as a laser scanner reads
 * a biological sample column by column:
 *   X axis     → time   (each pixel column = one time slice)
 *   Y axis     → frequency bin (each pixel row = one exact frequency)
 *   Brightness → amplitude of that frequency bin at that moment
 *   Hue        → waveform shape (sine / triangle / sawtooth blend)
 *   Saturation → harmonic richness (adds 2nd and 3rd harmonics)
 *   Alpha      → gates the pixel (transparent pixels = silence)
 *
 * ── MODE 2: WAVE GENETICS (Gariaev / Jiang Kanzhen) ───────────────────────
 * Each pixel drives four carriers independently — no averaging loses data:
 *   R channel  → amplitude of 396 Hz (UT — liberation from fear)
 *   G channel  → amplitude of 528 Hz (MI — DNA repair / transformation)
 *   B channel  → amplitude of 741 Hz (SOL — awakening intuition)
 *   Luminance  → AM depth of 40 Hz coherence carrier (Gariaev gamma carrier)
 *   X position → phase offset of all carriers (encodes spatial info in phase)
 *   Y position → frequency micro-shift (encodes vertical position in pitch)
 *
 * ── MODE 3: BIOFIELD OVERLAY ───────────────────────────────────────────────
 * Full Spectral base (all pixel data) + user-selected biofield carriers.
 * Each carrier's amplitude is driven by the column's luminance (not fixed).
 * Each carrier's phase is seeded by the column's dominant hue (color → phase).
 * Nothing in the carrier layer is constant — all parameters are pixel-driven.
 */

export type SonificationMode = "SPECTRAL" | "WAVE_GENETICS" | "BIOFIELD";

export interface PixelData {
  r: number; // 0–255
  g: number; // 0–255
  b: number; // 0–255
  a: number; // 0–255
}

export interface SonificationOptions {
  mode: SonificationMode;
  durationSeconds: number;
  carrierFrequencies: number[]; // Hz — used in BIOFIELD mode
  sampleRate: number;
}

// ─── Frequency mapping constants ──────────────────────────────────────────────
const MIN_FREQ_HZ = 80;   // bottom pixel row → 80 Hz
const MAX_FREQ_HZ = 8000; // top pixel row → 8000 Hz

// Gariaev coherence carrier
const GARIAEV_HZ = 40;

// Solfeggio carriers
const SOL_UT  = 396; // R channel
const SOL_MI  = 528; // G channel — DNA repair
const SOL_SOL = 741; // B channel

// ─── Pixel math utilities ─────────────────────────────────────────────────────

/** Perceptual luminance 0–1 */
function lum(p: PixelData): number {
  return (0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b) / 255;
}

/** RGB → HSV. Returns [hue 0–360, sat 0–1, val 0–1] */
function toHsv(p: PixelData): [number, number, number] {
  const r = p.r / 255, g = p.g / 255, b = p.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else                h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, max === 0 ? 0 : d / max, max];
}

/**
 * Map pixel row to frequency using logarithmic (musical) spacing.
 * Top row = highest frequency, bottom row = lowest.
 */
function rowToHz(row: number, totalRows: number): number {
  const t = 1 - row / Math.max(totalRows - 1, 1);
  const logMin = Math.log2(MIN_FREQ_HZ);
  const logMax = Math.log2(MAX_FREQ_HZ);
  return Math.pow(2, logMin + t * (logMax - logMin));
}

/**
 * Waveform shape blend based on hue.
 * hue 0–120 (red-green): sine
 * hue 120–240 (green-blue): triangle
 * hue 240–360 (blue-red): sawtooth
 * Returns a sample value at the given phase.
 */
function shapedOscillator(phase: number, hue: number): number {
  const p = phase - Math.floor(phase); // 0–1
  const sine = Math.sin(2 * Math.PI * p);
  const tri  = 4 * Math.abs(p - 0.5) - 1;
  const saw  = 2 * p - 1;

  if (hue < 120) {
    const t = hue / 120;
    return sine * (1 - t) + tri * t;
  } else if (hue < 240) {
    const t = (hue - 120) / 120;
    return tri * (1 - t) + saw * t;
  } else {
    const t = (hue - 240) / 120;
    return saw * (1 - t) + sine * t;
  }
}

// ─── Normalize ────────────────────────────────────────────────────────────────

function normalize(buf: Float32Array): Float32Array {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i]);
    if (a > peak) peak = a;
  }
  if (peak < 1e-9) return buf;
  const scale = 0.92 / peak;
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] * scale;
  return out;
}

// ─── ENGINE 1: SPECTRAL SCAN ─────────────────────────────────────────────────

function spectral(
  pixels: PixelData[],
  width: number,
  height: number,
  totalSamples: number,
  sampleRate: number,
): Float32Array {
  const out = new Float32Array(totalSamples);
  const samplesPerCol = totalSamples / width;

  // One phase accumulator per row (frequency bin) — carries phase across columns
  const phaseAcc = new Float64Array(height);

  for (let col = 0; col < width; col++) {
    const s0 = Math.floor(col * samplesPerCol);
    const s1 = Math.floor((col + 1) * samplesPerCol);
    const n  = s1 - s0;

    for (let row = 0; row < height; row++) {
      const px = pixels[row * width + col];
      if (!px || px.a < 4) {
        // Transparent pixel — advance phase silently to maintain continuity
        const hz = rowToHz(row, height);
        phaseAcc[row] = (phaseAcc[row] + n * hz / sampleRate) % 1;
        continue;
      }

      const brightness = lum(px);
      if (brightness < 0.004) {
        const hz = rowToHz(row, height);
        phaseAcc[row] = (phaseAcc[row] + n * hz / sampleRate) % 1;
        continue;
      }

      const hz  = rowToHz(row, height);
      const dt  = hz / sampleRate;
      const [hue, sat] = toHsv(px);

      // Amplitude: brightness / height so all rows sum to ≤ 1
      const amp  = brightness / height;
      // Harmonic amplitudes driven by saturation (not random)
      const h2   = sat * 0.35 * amp;
      const h3   = sat * 0.18 * amp;
      const dt2  = dt * 2;
      const dt3  = dt * 3;

      for (let s = s0; s < s1; s++) {
        const localT = s - s0;
        const ph  = phaseAcc[row] + localT * dt;
        const ph2 = phaseAcc[row] + localT * dt2;
        const ph3 = phaseAcc[row] + localT * dt3;

        out[s] +=
          amp * shapedOscillator(ph, hue) +
          h2  * Math.sin(2 * Math.PI * ph2) +
          h3  * Math.sin(2 * Math.PI * ph3);
      }

      phaseAcc[row] = (phaseAcc[row] + n * dt) % 1;
    }
  }

  return normalize(out);
}

// ─── ENGINE 2: WAVE GENETICS ─────────────────────────────────────────────────

function waveGenetics(
  pixels: PixelData[],
  width: number,
  height: number,
  totalSamples: number,
  sampleRate: number,
): Float32Array {
  const out = new Float32Array(totalSamples);
  const samplesPerCol = totalSamples / width;

  // Persistent phase accumulators for the four carriers
  let phUT  = 0, phMI  = 0, phSOL = 0, phCoh = 0;
  const dtUT  = SOL_UT  / sampleRate;
  const dtMI  = SOL_MI  / sampleRate;
  const dtSOL = SOL_SOL / sampleRate;
  const dtCoh = GARIAEV_HZ / sampleRate;

  for (let col = 0; col < width; col++) {
    const s0 = Math.floor(col * samplesPerCol);
    const s1 = Math.floor((col + 1) * samplesPerCol);
    const n  = s1 - s0;

    // Spatial phase offset from column position — encodes X position in phase
    const spatialPhase = col / width; // 0–1, deterministic

    // Process each pixel in the column individually — no lossy averaging
    for (let row = 0; row < height; row++) {
      const px = pixels[row * width + col];
      if (!px || px.a < 4) continue;

      // Per-pixel amplitudes from actual channel values
      const ampUT  = px.r / 255 / height; // R → 396 Hz
      const ampMI  = px.g / 255 / height; // G → 528 Hz
      const ampSOL = px.b / 255 / height; // B → 741 Hz
      const ampCoh = lum(px)    / height; // luminance → 40 Hz

      // Y position encodes a micro-pitch shift (row/height → ±2% detune)
      const detune = 1 + (row / height - 0.5) * 0.04;

      for (let s = s0; s < s1; s++) {
        const lt = s - s0;
        const pUT  = (phUT  + lt * dtUT  * detune + spatialPhase * 0.5) % 1;
        const pMI  = (phMI  + lt * dtMI  * detune + spatialPhase * 0.5) % 1;
        const pSOL = (phSOL + lt * dtSOL * detune + spatialPhase * 0.5) % 1;
        const pCoh = (phCoh + lt * dtCoh) % 1;

        // 40 Hz coherence carrier AM-modulates all three Solfeggio carriers
        const coh = 0.5 + 0.5 * Math.sin(2 * Math.PI * pCoh);

        out[s] +=
          coh * (
            ampUT  * Math.sin(2 * Math.PI * pUT)  +
            ampMI  * Math.sin(2 * Math.PI * pMI)  +
            ampSOL * Math.sin(2 * Math.PI * pSOL)
          ) +
          ampCoh * Math.sin(2 * Math.PI * pCoh);
      }
    }

    // Advance carrier phases by the column's sample count
    phUT  = (phUT  + n * dtUT)  % 1;
    phMI  = (phMI  + n * dtMI)  % 1;
    phSOL = (phSOL + n * dtSOL) % 1;
    phCoh = (phCoh + n * dtCoh) % 1;
  }

  return normalize(out);
}

// ─── ENGINE 3: BIOFIELD OVERLAY ──────────────────────────────────────────────

function biofield(
  pixels: PixelData[],
  width: number,
  height: number,
  totalSamples: number,
  sampleRate: number,
  carriers: number[],
): Float32Array {
  // Spectral base carries ALL pixel information
  const base = spectral(pixels, width, height, totalSamples, sampleRate);
  if (carriers.length === 0) return base;

  const overlay = new Float32Array(totalSamples);
  const samplesPerCol = totalSamples / width;
  const phaseAcc = new Float64Array(carriers.length);

  for (let col = 0; col < width; col++) {
    const s0 = Math.floor(col * samplesPerCol);
    const s1 = Math.floor((col + 1) * samplesPerCol);
    const n  = s1 - s0;

    // Column statistics — derived entirely from pixel data
    let sumLum = 0, sumHue = 0, count = 0;
    for (let row = 0; row < height; row++) {
      const px = pixels[row * width + col];
      if (!px || px.a < 4) continue;
      sumLum += lum(px);
      const [h] = toHsv(px);
      sumHue += h;
      count++;
    }
    if (count === 0) {
      for (let ci = 0; ci < carriers.length; ci++) {
        phaseAcc[ci] = (phaseAcc[ci] + n * carriers[ci] / sampleRate) % 1;
      }
      continue;
    }

    const colLum = sumLum / count;         // drives carrier amplitude
    const colHue = sumHue / (count * 360); // drives phase offset (color → phase)

    for (let ci = 0; ci < carriers.length; ci++) {
      const hz = carriers[ci];
      const dt = hz / sampleRate;

      for (let s = s0; s < s1; s++) {
        const lt = s - s0;
        const ph = (phaseAcc[ci] + lt * dt + colHue) % 1;
        overlay[s] += colLum * Math.sin(2 * Math.PI * ph) / carriers.length;
      }

      phaseAcc[ci] = (phaseAcc[ci] + n * dt) % 1;
    }
  }

  // Mix: 60% spectral (full pixel data) + 40% biofield carriers (pixel-driven)
  const mixed = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    mixed[i] = base[i] * 0.6 + overlay[i] * 0.4;
  }
  return normalize(mixed);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function synthesizeFromPixels(
  pixels: PixelData[],
  width: number,
  height: number,
  options: SonificationOptions,
): Float32Array {
  const { mode, durationSeconds, carrierFrequencies, sampleRate } = options;
  const totalSamples = Math.floor(sampleRate * durationSeconds);

  switch (mode) {
    case "SPECTRAL":
      return spectral(pixels, width, height, totalSamples, sampleRate);
    case "WAVE_GENETICS":
      return waveGenetics(pixels, width, height, totalSamples, sampleRate);
    case "BIOFIELD":
      return biofield(pixels, width, height, totalSamples, sampleRate, carrierFrequencies);
    default:
      return spectral(pixels, width, height, totalSamples, sampleRate);
  }
}

// ─── WAV Encoding ─────────────────────────────────────────────────────────────

export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataSize = samples.length * 2; // 16-bit PCM
  const buf = new ArrayBuffer(44 + dataSize);
  const v   = new DataView(buf);
  const ws  = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  ws(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  ws(8, "WAVE");
  ws(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);           // PCM
  v.setUint16(22, 1, true);           // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ws(36, "data");
  v.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i++) {
    const c = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, Math.round(c * 32767), true);
  }
  return buf;
}

export function arrayBufferToBase64DataUri(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(bin)}`;
}

/**
 * Extract waveform bar heights from synthesized samples.
 * Uses RMS (root-mean-square) energy per chunk — purely from the audio data.
 * Returns values in [0, 1].
 */
export function extractWaveformBars(samples: Float32Array, barCount: number): number[] {
  const chunk = Math.floor(samples.length / barCount);
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    let rms = 0;
    const start = i * chunk;
    const end   = Math.min(start + chunk, samples.length);
    for (let j = start; j < end; j++) rms += samples[j] * samples[j];
    bars.push(Math.sqrt(rms / (end - start)));
  }
  const maxBar = Math.max(...bars, 1e-9);
  return bars.map((b) => b / maxBar);
}

// ─── Legacy helpers (kept for compatibility) ──────────────────────────────────

export function extractPixelGrid(
  raw: Uint8ClampedArray | Uint8Array,
  srcW: number,
  srcH: number,
  tW = 64,
  tH = 32,
): { pixels: PixelData[]; width: number; height: number } {
  const pixels: PixelData[] = [];
  const sx = srcW / tW, sy = srcH / tH;
  for (let row = 0; row < tH; row++) {
    for (let col = 0; col < tW; col++) {
      const idx = (Math.floor(row * sy) * srcW + Math.floor(col * sx)) * 4;
      pixels.push({ r: raw[idx], g: raw[idx + 1], b: raw[idx + 2], a: raw[idx + 3] });
    }
  }
  return { pixels, width: tW, height: tH };
}
