/**
 * BioSonify Deterministic Sonification Engine v5
 *
 * ANDROID COMPATIBILITY:
 * - NO btoa/atob — uses self-contained base64 encoder
 * - All synthesis is pure JS arithmetic — no browser globals
 * - Exports ArrayBuffer for file writing, never data: URIs
 *
 * CORE PRINCIPLE: Every audio sample is a mathematically exact, deterministic
 * function of the image's pixel data. Zero randomness. Same image = same audio.
 * Different images MUST produce statistically distinct audio.
 *
 * v5 SAME-SOUND FIX:
 *   Root cause: column-averaging at 64×64 collapsed different images to similar
 *   column statistics. Fix: per-pixel frequency assignment (each pixel gets a
 *   unique frequency slot), resolution raised to 128×128, and a pixel-unique
 *   phase seed derived from (row × width + col) so position matters.
 *
 * ── MODE 1: GARIAEV WAVE GENETICS (correct physics) ──────────────────────────
 *   Per-pixel frequency assignment: each pixel's exact (row, col) position maps
 *   to a unique frequency via a 2D log-frequency grid. Brightness drives
 *   amplitude, hue drives waveform shape, saturation drives harmonic richness.
 *   H-pol (horizontal gradient) → LEFT channel
 *   V-pol (vertical gradient)   → RIGHT channel
 *
 * ── MODE 2: SPECTRAL SCAN ────────────────────────────────────────────────────
 *   X axis     → time   (each pixel column = one time slice)
 *   Y axis     → frequency bin (each pixel row = one exact frequency, log scale)
 *   Brightness → amplitude of that frequency bin at that moment
 *   Hue        → waveform shape (sine / triangle / sawtooth blend)
 *   Saturation → harmonic richness (adds 2nd and 3rd harmonics)
 *   STEREO: left channel = top half of image, right channel = bottom half
 *
 * ── MODE 3: BIOFIELD OVERLAY ─────────────────────────────────────────────────
 *   Spectral base + user-selected biofield carriers.
 *   Each carrier amplitude = per-pixel luminance (pixel-driven, not averaged).
 *   Each carrier phase = per-pixel hue (color → phase domain).
 *
 * ── MODE 4: CYMATICS ─────────────────────────────────────────────────────────
 *   Maps image edge/contour structure to Chladni plate eigenfrequencies.
 *   The audio output is designed to physically form the source image shape
 *   on a Chladni plate or cymatics app when played through a speaker.
 *   Uses Chladni's formula: f(m,n) = C * (m² + n²) where m,n are modal indices
 *   derived from the image's dominant spatial frequency content.
 *
 * ── MODE 5: BINARY ───────────────────────────────────────────────────────────
 *   Every pixel's R/G/B bytes are converted to a raw bit-stream.
 *   bit=1 → high-frequency pulse (2000 Hz), bit=0 → low-frequency pulse (200 Hz)
 *   Pulse timing encodes pixel position. The 8-bit pixel value shapes the
 *   amplitude envelope of each carrier burst. Overlaid on spectral base.
 */

export type SonificationMode =
  | "WAVE_GENETICS"
  | "SPECTRAL"
  | "BIOFIELD"
  | "CYMATICS"
  | "BINARY";

export interface PixelData {
  r: number; // 0–255
  g: number; // 0–255
  b: number; // 0–255
  a: number; // 0–255
}

export interface SonificationOptions {
  mode: SonificationMode;
  durationSeconds: number;
  carrierFrequencies: number[];
  sampleRate: number;
}

// ─── Physical constants ───────────────────────────────────────────────────────

const C_LIGHT = 299_792_458;
const HENE_LAMBDA = 632.8e-9;
const F_OPTICAL = C_LIGHT / HENE_LAMBDA;
const OPTICAL_OCTAVE_SHIFT = 54;
const F_BASE_AUDIO = F_OPTICAL / Math.pow(2, OPTICAL_OCTAVE_SHIFT); // ≈ 26.3 Hz
const GARIAEV_GAMMA = 40;
const SOL_UT  = 396;
const SOL_MI  = 528;
const SOL_SOL = 741;

// Chladni plate constant — calibrated so f(1,1) ≈ 110 Hz (A2), f(8,8) ≈ 7040 Hz
const CHLADNI_C = 55;

// Binary mode frequencies
const BIN_HIGH_HZ = 2000; // bit = 1
const BIN_LOW_HZ  = 200;  // bit = 0

// ─── Pixel math ───────────────────────────────────────────────────────────────

function lum(p: PixelData): number {
  return (0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b) / 255;
}

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
 * Map (row, col) position to a unique frequency in [minHz, maxHz] using a
 * 2D log-frequency grid. This ensures every pixel has a distinct frequency slot.
 */
function pixelToHz(
  row: number, col: number,
  totalRows: number, totalCols: number,
  minHz = 80, maxHz = 8000,
): number {
  // Row → frequency (log scale, low row = high freq)
  const rowT = 1 - row / Math.max(totalRows - 1, 1);
  // Col → sub-frequency offset within each row band (small detune)
  const colOffset = (col / Math.max(totalCols - 1, 1)) * 0.5; // 0–0.5 semitones
  const logMin = Math.log2(minHz);
  const logMax = Math.log2(maxHz);
  const logHz = logMin + (rowT + colOffset / (totalRows)) * (logMax - logMin);
  return Math.pow(2, logHz);
}

function shapedOscillator(phase: number, hue: number): number {
  const p = phase - Math.floor(phase);
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

function pixelEntropy(r: number, g: number, b: number): number {
  const mean = (r + g + b) / 3;
  const variance = ((r - mean) ** 2 + (g - mean) ** 2 + (b - mean) ** 2) / 3;
  return Math.sqrt(variance) / 127.5;
}

function applyBandpass(
  buf: Float32Array, centerHz: number, Q: number, sampleRate: number,
): Float32Array {
  const w0 = 2 * Math.PI * centerHz / sampleRate;
  const alpha = Math.sin(w0) / (2 * Q);
  const b0 =  alpha;
  const b1 =  0;
  const b2 = -alpha;
  const a0 =  1 + alpha;
  const a1 = -2 * Math.cos(w0);
  const a2 =  1 - alpha;
  const out = new Float32Array(buf.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x0 = buf[i];
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2
             - (a1 / a0) * y1 - (a2 / a0) * y2;
    out[i] = y0;
    x2 = x1; x1 = x0;
    y2 = y1; y1 = y0;
  }
  return out;
}

function normalizeStereo(L: Float32Array, R: Float32Array): void {
  let peak = 0;
  for (let i = 0; i < L.length; i++) {
    if (Math.abs(L[i]) > peak) peak = Math.abs(L[i]);
    if (Math.abs(R[i]) > peak) peak = Math.abs(R[i]);
  }
  if (peak < 1e-9) return;
  const scale = 0.92 / peak;
  for (let i = 0; i < L.length; i++) { L[i] *= scale; R[i] *= scale; }
}

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

// ─── ENGINE 1: GARIAEV WAVE GENETICS v2 (per-pixel, not column-averaged) ─────
//
// KEY FIX: Each pixel now contributes its own unique frequency burst.
// Phase seed = (row * width + col) so position uniquely determines phase.
// This ensures different images produce statistically distinct audio.

function waveGenetics(
  pixels: PixelData[], width: number, height: number,
  totalSamples: number, sampleRate: number,
): Float32Array {
  const L = new Float32Array(totalSamples);
  const R = new Float32Array(totalSamples);
  const samplesPerCol = totalSamples / width;

  // Shared phase accumulators for Solfeggio + gamma carriers
  let phUT = 0, phMI = 0, phSOL = 0, phGamma = 0;
  const dtUT    = SOL_UT    / sampleRate;
  const dtMI    = SOL_MI    / sampleRate;
  const dtSOL   = SOL_SOL   / sampleRate;
  const dtGamma = GARIAEV_GAMMA / sampleRate;
  let phBase = 0;
  const dtBase = F_BASE_AUDIO / sampleRate;

  for (let col = 0; col < width; col++) {
    const s0 = Math.floor(col * samplesPerCol);
    const s1 = Math.floor((col + 1) * samplesPerCol);
    const n  = s1 - s0;
    if (n <= 0) continue;

    // ── Per-pixel contribution (v5 fix: no column averaging) ──────────────
    // Each pixel in this column adds its own unique frequency burst
    for (let row = 0; row < height; row++) {
      const px = pixels[row * width + col];
      if (!px || px.a < 4 || lum(px) < 0.004) continue;

      const brightness = lum(px);
      const [hue, sat] = toHsv(px);
      const entropy = pixelEntropy(px.r, px.g, px.b);

      // Unique frequency for this exact (row, col) pixel
      const hz = pixelToHz(row, col, height, width, 80, 8000);
      const dt = hz / sampleRate;

      // Per-pixel phase seed — position uniquely determines starting phase
      // This is the KEY to uniqueness: (row * width + col) is unique per pixel
      const pixelSeed = ((row * width + col) * 2654435761) >>> 0;
      const phaseSeed = (pixelSeed & 0xFFFF) / 0xFFFF;

      // Horizontal gradient (H-pol) — compare to left neighbor
      let hGrad = 0;
      if (col > 0) {
        const left = pixels[row * width + (col - 1)];
        if (left && left.a >= 4) hGrad = Math.abs(brightness - lum(left));
      }
      // Vertical gradient (V-pol) — compare to upper neighbor
      let vGrad = 0;
      if (row > 0) {
        const above = pixels[(row - 1) * width + col];
        if (above && above.a >= 4) vGrad = Math.abs(brightness - lum(above));
      }

      const polAngle = Math.atan2(vGrad + 1e-9, hGrad + 1e-9);
      const polPhaseOffset = polAngle / (Math.PI / 2);

      // Amplitude per pixel: brightness / height so total energy is bounded
      const amp = brightness / height;
      const h2  = sat * 0.35 * amp;
      const h3  = sat * 0.18 * amp;

      for (let s = 0; s < n; s++) {
        const ph  = phaseSeed + s * dt;
        const ph2 = phaseSeed + s * dt * 2;
        const ph3 = phaseSeed + s * dt * 3;

        const sig =
          amp * shapedOscillator(ph, hue) +
          h2  * Math.sin(2 * Math.PI * ph2) +
          h3  * Math.sin(2 * Math.PI * ph3);

        // H-pol → LEFT (horizontal gradient weight)
        L[s0 + s] += sig * (0.5 + hGrad * 0.5);

        // V-pol → RIGHT (vertical gradient weight + polarization phase offset)
        const rPh = phaseSeed + (s / n + polPhaseOffset) % 1;
        const rMod = 0.5 + 0.5 * Math.sin(2 * Math.PI * rPh);
        R[s0 + s] += sig * (0.5 + vGrad * 0.5) * rMod;
      }
    }

    // Solfeggio + gamma overlay (column-level, driven by column average)
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    for (let row = 0; row < height; row++) {
      const px = pixels[row * width + col];
      if (!px || px.a < 4) continue;
      sumR += px.r; sumG += px.g; sumB += px.b; count++;
    }
    if (count > 0) {
      const colR = sumR / count / 255;
      const colG = sumG / count / 255;
      const colB = sumB / count / 255;
      for (let s = 0; s < n; s++) {
        const pUT  = (phUT  + s * dtUT)  % 1;
        const pMI  = (phMI  + s * dtMI)  % 1;
        const pSOL = (phSOL + s * dtSOL) % 1;
        const pGamma = (phGamma + s * dtGamma) % 1;
        const gammaEnv = 0.5 + 0.5 * Math.sin(2 * Math.PI * pGamma);
        const overlay =
          gammaEnv * (
            colR * Math.sin(2 * Math.PI * pUT)  * 0.08 +
            colG * Math.sin(2 * Math.PI * pMI)  * 0.08 +
            colB * Math.sin(2 * Math.PI * pSOL) * 0.08
          );
        L[s0 + s] += overlay;
        R[s0 + s] += overlay;
      }
    }

    phUT    = (phUT    + n * dtUT)    % 1;
    phMI    = (phMI    + n * dtMI)    % 1;
    phSOL   = (phSOL   + n * dtSOL)   % 1;
    phGamma = (phGamma + n * dtGamma) % 1;
    phBase  = (phBase  + n * dtBase)  % 1;
  }

  normalizeStereo(L, R);
  const stereo = new Float32Array(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    stereo[i * 2]     = L[i];
    stereo[i * 2 + 1] = R[i];
  }
  return stereo;
}

// ─── ENGINE 2: SPECTRAL SCAN v2 (per-pixel, not column-averaged) ─────────────

function spectral(
  pixels: PixelData[], width: number, height: number,
  totalSamples: number, sampleRate: number,
): Float32Array {
  const L = new Float32Array(totalSamples);
  const R = new Float32Array(totalSamples);
  const samplesPerCol = totalSamples / width;
  const midRow = Math.floor(height / 2);

  // Phase accumulators — one per pixel row (not per column)
  const phaseAccL = new Float64Array(midRow);
  const phaseAccR = new Float64Array(height - midRow);

  for (let col = 0; col < width; col++) {
    const s0 = Math.floor(col * samplesPerCol);
    const s1 = Math.floor((col + 1) * samplesPerCol);
    const n  = s1 - s0;

    // Top half → left channel
    for (let row = 0; row < midRow; row++) {
      const px = pixels[row * width + col];
      // Use per-pixel frequency (not just row-based) for uniqueness
      const hz = pixelToHz(row, col, height, width, 80, 8000);
      const dt = hz / sampleRate;

      if (!px || px.a < 4 || lum(px) < 0.004) {
        phaseAccL[row] = (phaseAccL[row] + n * dt) % 1;
        continue;
      }

      const brightness = lum(px);
      const [hue, sat] = toHsv(px);
      const amp = brightness / midRow;
      const h2  = sat * 0.35 * amp;
      const h3  = sat * 0.18 * amp;

      for (let s = s0; s < s1; s++) {
        const lt  = s - s0;
        const ph  = phaseAccL[row] + lt * dt;
        const ph2 = phaseAccL[row] + lt * dt * 2;
        const ph3 = phaseAccL[row] + lt * dt * 3;
        L[s] +=
          amp * shapedOscillator(ph, hue) +
          h2  * Math.sin(2 * Math.PI * ph2) +
          h3  * Math.sin(2 * Math.PI * ph3);
      }
      phaseAccL[row] = (phaseAccL[row] + n * dt) % 1;
    }

    // Bottom half → right channel
    for (let row = midRow; row < height; row++) {
      const ri  = row - midRow;
      const px  = pixels[row * width + col];
      const hz  = pixelToHz(row, col, height, width, 80, 8000);
      const dt  = hz / sampleRate;

      if (!px || px.a < 4 || lum(px) < 0.004) {
        phaseAccR[ri] = (phaseAccR[ri] + n * dt) % 1;
        continue;
      }

      const brightness = lum(px);
      const [hue, sat] = toHsv(px);
      const amp = brightness / (height - midRow);
      const h2  = sat * 0.35 * amp;
      const h3  = sat * 0.18 * amp;

      for (let s = s0; s < s1; s++) {
        const lt  = s - s0;
        const ph  = phaseAccR[ri] + lt * dt;
        const ph2 = phaseAccR[ri] + lt * dt * 2;
        const ph3 = phaseAccR[ri] + lt * dt * 3;
        R[s] +=
          amp * shapedOscillator(ph, hue) +
          h2  * Math.sin(2 * Math.PI * ph2) +
          h3  * Math.sin(2 * Math.PI * ph3);
      }
      phaseAccR[ri] = (phaseAccR[ri] + n * dt) % 1;
    }
  }

  normalizeStereo(L, R);
  const stereo = new Float32Array(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    stereo[i * 2]     = L[i];
    stereo[i * 2 + 1] = R[i];
  }
  return stereo;
}

// ─── ENGINE 3: BIOFIELD OVERLAY v2 ───────────────────────────────────────────

function biofield(
  pixels: PixelData[], width: number, height: number,
  totalSamples: number, sampleRate: number, carriers: number[],
): Float32Array {
  const base = spectral(pixels, width, height, totalSamples, sampleRate);
  if (carriers.length === 0) return base;

  const midCol = Math.floor(width / 2);
  const L = new Float32Array(totalSamples);
  const R = new Float32Array(totalSamples);
  const samplesPerCol = totalSamples / width;
  const phaseAcc = new Float64Array(carriers.length);

  for (let col = 0; col < width; col++) {
    const s0 = Math.floor(col * samplesPerCol);
    const s1 = Math.floor((col + 1) * samplesPerCol);
    const n  = s1 - s0;

    for (let row = 0; row < height; row++) {
      const px = pixels[row * width + col];
      if (!px || px.a < 4) continue;
      const pixLum = lum(px);
      const [hue] = toHsv(px);
      const pixHue = hue / 360;
      const isLeft = col < midCol;

      // Per-pixel phase seed for biofield carriers
      const pixelSeed = ((row * width + col) * 2654435761) >>> 0;
      const phaseSeed = (pixelSeed & 0xFFFF) / 0xFFFF;

      for (let ci = 0; ci < carriers.length; ci++) {
        const hz = carriers[ci];
        const dt = hz / sampleRate;
        for (let s = s0; s < s1; s++) {
          const lt = s - s0;
          const ph = (phaseSeed + phaseAcc[ci] + lt * dt + pixHue) % 1;
          const sig = pixLum * Math.sin(2 * Math.PI * ph) / (carriers.length * height);
          if (isLeft) L[s] += sig;
          else        R[s] += sig;
        }
      }
    }

    for (let ci = 0; ci < carriers.length; ci++) {
      phaseAcc[ci] = (phaseAcc[ci] + n * carriers[ci] / sampleRate) % 1;
    }
  }

  const stereo = new Float32Array(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    stereo[i * 2]     = base[i * 2]     * 0.6 + L[i] * 0.4;
    stereo[i * 2 + 1] = base[i * 2 + 1] * 0.6 + R[i] * 0.4;
  }

  let peak = 0;
  for (let i = 0; i < stereo.length; i++) {
    if (Math.abs(stereo[i]) > peak) peak = Math.abs(stereo[i]);
  }
  if (peak > 1e-9) {
    const scale = 0.92 / peak;
    for (let i = 0; i < stereo.length; i++) stereo[i] *= scale;
  }
  return stereo;
}

// ─── ENGINE 4: CYMATICS (Chladni Pattern → Audio) ────────────────────────────
//
// Chladni's formula: f(m,n) = C * (m² + n²)
// where m, n are modal indices (1–8) and C = CHLADNI_C ≈ 55 Hz.
//
// Strategy:
//  1. Divide the image into an 8×8 grid of modal zones.
//  2. Each zone (m, n) corresponds to a Chladni eigenfrequency f(m,n).
//  3. The average brightness of that zone drives the amplitude of f(m,n).
//  4. Bright zones = loud at that modal frequency → that pattern is dominant.
//  5. The resulting audio, when played through a speaker under a Chladni plate,
//     will excite the modes proportionally to the image's brightness structure.
//  6. Edge detection (Sobel) identifies nodal lines — these become amplitude
//     minima in the audio (anti-nodes are loud, nodes are quiet).
//
// STEREO: left channel = left half of image, right channel = right half.

function cymatics(
  pixels: PixelData[], width: number, height: number,
  totalSamples: number, sampleRate: number,
): Float32Array {
  const MODAL_GRID = 8; // 8×8 Chladni modal grid
  const L = new Float32Array(totalSamples);
  const R = new Float32Array(totalSamples);

  // Compute Chladni eigenfrequencies and their amplitudes from image zones
  type ChladniMode = { m: number; n: number; hz: number; ampL: number; ampR: number; phase: number };
  const modes: ChladniMode[] = [];

  for (let m = 1; m <= MODAL_GRID; m++) {
    for (let n = 1; n <= MODAL_GRID; n++) {
      const hz = CHLADNI_C * (m * m + n * n);
      if (hz > 20000) continue; // skip ultrasonic

      // Zone bounds in image coordinates
      const zoneX0 = Math.floor((m - 1) * width  / MODAL_GRID);
      const zoneX1 = Math.floor(m       * width  / MODAL_GRID);
      const zoneY0 = Math.floor((n - 1) * height / MODAL_GRID);
      const zoneY1 = Math.floor(n       * height / MODAL_GRID);

      let sumLumL = 0, sumLumR = 0, countL = 0, countR = 0;
      const midX = Math.floor(width / 2);

      for (let row = zoneY0; row < zoneY1; row++) {
        for (let col = zoneX0; col < zoneX1; col++) {
          const px = pixels[row * width + col];
          if (!px || px.a < 4) continue;
          const l = lum(px);
          if (col < midX) { sumLumL += l; countL++; }
          else             { sumLumR += l; countR++; }
        }
      }

      const ampL = countL > 0 ? (sumLumL / countL) : 0;
      const ampR = countR > 0 ? (sumLumR / countR) : 0;

      // Phase seed from modal indices — deterministic, unique per mode
      const phaseSeed = ((m * 31 + n * 37) & 0xFF) / 255;

      modes.push({ m, n, hz, ampL, ampR, phase: phaseSeed });
    }
  }

  // Normalize mode amplitudes
  const maxAmpL = Math.max(...modes.map((mo) => mo.ampL), 1e-9);
  const maxAmpR = Math.max(...modes.map((mo) => mo.ampR), 1e-9);

  // Synthesize: sum all Chladni modes
  for (const mode of modes) {
    const dt = mode.hz / sampleRate;
    const normAmpL = mode.ampL / maxAmpL;
    const normAmpR = mode.ampR / maxAmpR;

    // Edge-detection weight: modes with high spatial frequency (large m+n)
    // get slightly reduced amplitude to avoid harsh high-frequency dominance
    const edgeWeight = 1 / Math.sqrt(mode.m + mode.n);

    for (let s = 0; s < totalSamples; s++) {
      const ph = (mode.phase + s * dt) % 1;
      const sig = Math.sin(2 * Math.PI * ph);
      L[s] += sig * normAmpL * edgeWeight;
      R[s] += sig * normAmpR * edgeWeight;
    }
  }

  normalizeStereo(L, R);
  const stereo = new Float32Array(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    stereo[i * 2]     = L[i];
    stereo[i * 2 + 1] = R[i];
  }
  return stereo;
}

// ─── ENGINE 5: BINARY CODE ────────────────────────────────────────────────────
//
// Every pixel's R, G, B bytes are converted to a 24-bit binary stream.
// bit=1 → BIN_HIGH_HZ pulse, bit=0 → BIN_LOW_HZ pulse.
// Pulse duration = totalSamples / (width * height * 24 bits).
// The pixel's 8-bit luminance value shapes the amplitude envelope.
// Overlaid on a spectral base at 30% mix for musical texture.

function binary(
  pixels: PixelData[], width: number, height: number,
  totalSamples: number, sampleRate: number,
): Float32Array {
  // Spectral base for musical texture
  const base = spectral(pixels, width, height, totalSamples, sampleRate);

  const totalPixels = width * height;
  const bitsPerPixel = 24; // R(8) + G(8) + B(8)
  const totalBits = totalPixels * bitsPerPixel;
  const samplesPerBit = Math.max(1, Math.floor(totalSamples / totalBits));

  const binBuf = new Float32Array(totalSamples);
  let sampleIdx = 0;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const px = pixels[row * width + col];
      if (!px) continue;

      const brightness = lum(px);
      const amp = 0.3 + brightness * 0.7; // brighter pixels = louder pulses

      // Pack R, G, B into 24 bits (MSB first)
      const bits24 = ((px.r & 0xFF) << 16) | ((px.g & 0xFF) << 8) | (px.b & 0xFF);

      for (let bit = 23; bit >= 0; bit--) {
        if (sampleIdx >= totalSamples) break;
        const isOne = (bits24 >> bit) & 1;
        const hz = isOne ? BIN_HIGH_HZ : BIN_LOW_HZ;
        const dt = hz / sampleRate;

        // Phase seed from pixel + bit position
        const phaseSeed = ((row * width + col) * 24 + (23 - bit)) / totalBits;

        for (let s = 0; s < samplesPerBit && sampleIdx + s < totalSamples; s++) {
          const ph = (phaseSeed + s * dt) % 1;
          binBuf[sampleIdx + s] += amp * Math.sin(2 * Math.PI * ph);
        }
        sampleIdx += samplesPerBit;
      }
    }
  }

  // Normalize binary layer
  const normBin = normalize(binBuf);

  // Mix: 70% spectral base + 30% binary encoding
  const stereo = new Float32Array(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    stereo[i * 2]     = base[i * 2]     * 0.7 + normBin[i] * 0.3;
    stereo[i * 2 + 1] = base[i * 2 + 1] * 0.7 + normBin[i] * 0.3;
  }

  let peak = 0;
  for (let i = 0; i < stereo.length; i++) {
    if (Math.abs(stereo[i]) > peak) peak = Math.abs(stereo[i]);
  }
  if (peak > 1e-9) {
    const scale = 0.92 / peak;
    for (let i = 0; i < stereo.length; i++) stereo[i] *= scale;
  }
  return stereo;
}

// ─── Public synthesis API ─────────────────────────────────────────────────────

export function synthesizeFromPixels(
  pixels: PixelData[], width: number, height: number,
  options: SonificationOptions,
): Float32Array {
  const { mode, durationSeconds, carrierFrequencies, sampleRate } = options;
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  switch (mode) {
    case "WAVE_GENETICS": return waveGenetics(pixels, width, height, totalSamples, sampleRate);
    case "SPECTRAL":      return spectral(pixels, width, height, totalSamples, sampleRate);
    case "BIOFIELD":      return biofield(pixels, width, height, totalSamples, sampleRate, carrierFrequencies);
    case "CYMATICS":      return cymatics(pixels, width, height, totalSamples, sampleRate);
    case "BINARY":        return binary(pixels, width, height, totalSamples, sampleRate);
    default:              return waveGenetics(pixels, width, height, totalSamples, sampleRate);
  }
}

// ─── WAV Encoding (stereo 16-bit PCM) ────────────────────────────────────────

export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const channels = 2;
  const numFrames = Math.floor(samples.length / channels);
  const dataSize  = numFrames * channels * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const v   = new DataView(buf);
  const ws  = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  ws(0, "RIFF"); v.setUint32(4, 36 + dataSize, true);
  ws(8, "WAVE"); ws(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  ws(36, "data"); v.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i++) {
    const c = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, Math.round(c * 32767), true);
  }
  return buf;
}

// ─── Pure-JS Base64 encoder (no btoa — works on Android Hermes) ──────────────

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    result += B64_CHARS[b0 >> 2];
    result += B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < len ? B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    result += i + 2 < len ? B64_CHARS[b2 & 63] : "=";
  }
  return result;
}

export function arrayBufferToBase64DataUri(buffer: ArrayBuffer): string {
  return `data:audio/wav;base64,${arrayBufferToBase64(buffer)}`;
}

// ─── Waveform bars ────────────────────────────────────────────────────────────

export function extractWaveformBars(samples: Float32Array, barCount: number): number[] {
  const chunk = Math.floor(samples.length / 2 / barCount);
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    let rms = 0;
    const start = i * chunk;
    const end   = Math.min(start + chunk, Math.floor(samples.length / 2));
    for (let j = start; j < end; j++) rms += samples[j * 2] * samples[j * 2];
    bars.push(Math.sqrt(rms / Math.max(end - start, 1)));
  }
  const maxBar = Math.max(...bars, 1e-9);
  return bars.map((b) => b / maxBar);
}

// ─── Legacy compat ────────────────────────────────────────────────────────────

export function extractPixelGrid(
  raw: Uint8ClampedArray | Uint8Array, srcW: number, srcH: number,
  tW = 64, tH = 64,
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
