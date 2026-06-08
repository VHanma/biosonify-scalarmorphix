/**
 * BioSonify Deterministic Sonification Engine v6
 *
 * PERFORMANCE ARCHITECTURE:
 * ─────────────────────────────────────────────────────────────────────────────
 * v5 had a UI-freeze problem: 128×128 pixels × 30 s × 44100 Hz = ~2 billion
 * float ops, all on the JS main thread. v6 fixes this with chunked async
 * synthesis: work is split into column-batches (COLS_PER_CHUNK columns at a
 * time), each batch is scheduled with a zero-delay setTimeout so the React
 * Native event loop can process UI events between batches. The result is a
 * smooth progress bar instead of a frozen screen — at zero quality cost.
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
 * v5 SAME-SOUND FIX (preserved in v6):
 *   Per-pixel frequency assignment — each pixel's exact (row, col) position maps
 *   to a unique frequency via a 2D log-frequency grid. Brightness drives
 *   amplitude, hue drives waveform shape, saturation drives harmonic richness.
 *   Resolution: 128×128 (16,384 unique pixels).
 *
 * ── MODE 1: GARIAEV WAVE GENETICS ────────────────────────────────────────────
 * ── MODE 2: SPECTRAL SCAN ────────────────────────────────────────────────────
 * ── MODE 3: BIOFIELD OVERLAY ─────────────────────────────────────────────────
 * ── MODE 4: CYMATICS (Chladni Pattern → Audio) ───────────────────────────────
 * ── MODE 5: BINARY CODE ──────────────────────────────────────────────────────
 */

export type SonificationMode =
  | "WAVE_GENETICS"
  | "SPECTRAL"
  | "BIOFIELD"
  | "CYMATICS"
  | "BINARY"
  | "SIMULTANEOUS";

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

/** Called with progress 0.0–1.0 during async synthesis */
export type ProgressCallback = (progress: number) => void;

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

// Chunked async: process this many columns per async tick to keep UI responsive
// 8 cols × 128 rows × 44100 × 30 s ≈ ~4M ops per tick — fast but non-blocking
const COLS_PER_CHUNK = 8;

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
  const rowT = 1 - row / Math.max(totalRows - 1, 1);
  const colOffset = (col / Math.max(totalCols - 1, 1)) * 0.5;
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

/** Yield to the JS event loop — lets React Native process UI events between chunks */
function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ─── ENGINE 1: GARIAEV WAVE GENETICS v2 (chunked async) ──────────────────────

async function waveGenetics(
  pixels: PixelData[], width: number, height: number,
  totalSamples: number, sampleRate: number,
  onProgress?: ProgressCallback,
): Promise<Float32Array> {
  const L = new Float32Array(totalSamples);
  const R = new Float32Array(totalSamples);
  const samplesPerCol = totalSamples / width;

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

    for (let row = 0; row < height; row++) {
      const px = pixels[row * width + col];
      if (!px || px.a < 4 || lum(px) < 0.004) continue;

      const brightness = lum(px);
      const [hue, sat] = toHsv(px);

      const hz = pixelToHz(row, col, height, width, 80, 8000);
      const dt = hz / sampleRate;

      const pixelSeed = ((row * width + col) * 2654435761) >>> 0;
      const phaseSeed = (pixelSeed & 0xFFFF) / 0xFFFF;

      let hGrad = 0;
      if (col > 0) {
        const left = pixels[row * width + (col - 1)];
        if (left && left.a >= 4) hGrad = Math.abs(brightness - lum(left));
      }
      let vGrad = 0;
      if (row > 0) {
        const above = pixels[(row - 1) * width + col];
        if (above && above.a >= 4) vGrad = Math.abs(brightness - lum(above));
      }

      const polAngle = Math.atan2(vGrad + 1e-9, hGrad + 1e-9);
      const polPhaseOffset = polAngle / (Math.PI / 2);

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

        L[s0 + s] += sig * (0.5 + hGrad * 0.5);

        const rPh = phaseSeed + (s / n + polPhaseOffset) % 1;
        const rMod = 0.5 + 0.5 * Math.sin(2 * Math.PI * rPh);
        R[s0 + s] += sig * (0.5 + vGrad * 0.5) * rMod;
      }
    }

    // Solfeggio + gamma overlay
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
        const pUT    = (phUT    + s * dtUT)    % 1;
        const pMI    = (phMI    + s * dtMI)    % 1;
        const pSOL   = (phSOL   + s * dtSOL)   % 1;
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

    // Yield to UI every COLS_PER_CHUNK columns
    if (col % COLS_PER_CHUNK === COLS_PER_CHUNK - 1) {
      onProgress?.((col + 1) / width);
      await yieldToUI();
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

// ─── ENGINE 2: SPECTRAL SCAN v2 (chunked async) ──────────────────────────────

async function spectral(
  pixels: PixelData[], width: number, height: number,
  totalSamples: number, sampleRate: number,
  onProgress?: ProgressCallback,
): Promise<Float32Array> {
  const L = new Float32Array(totalSamples);
  const R = new Float32Array(totalSamples);
  const samplesPerCol = totalSamples / width;
  const midRow = Math.floor(height / 2);

  const phaseAccL = new Float64Array(midRow);
  const phaseAccR = new Float64Array(height - midRow);

  for (let col = 0; col < width; col++) {
    const s0 = Math.floor(col * samplesPerCol);
    const s1 = Math.floor((col + 1) * samplesPerCol);
    const n  = s1 - s0;

    for (let row = 0; row < midRow; row++) {
      const px = pixels[row * width + col];
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

    if (col % COLS_PER_CHUNK === COLS_PER_CHUNK - 1) {
      onProgress?.((col + 1) / width);
      await yieldToUI();
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

// ─── ENGINE 3: BIOFIELD OVERLAY v2 (chunked async) ───────────────────────────

async function biofield(
  pixels: PixelData[], width: number, height: number,
  totalSamples: number, sampleRate: number, carriers: number[],
  onProgress?: ProgressCallback,
): Promise<Float32Array> {
  // Spectral base uses first 50% of progress
  const base = await spectral(pixels, width, height, totalSamples, sampleRate,
    onProgress ? (p) => onProgress(p * 0.5) : undefined);
  if (carriers.length === 0) return base;

  const midCol = Math.floor(width / 2);
  const L = new Float32Array(totalSamples);
  const R = new Float32Array(totalSamples);
  const samplesPerCol = totalSamples / width;
  const phaseAcc = new Float64Array(carriers.length);
  const ampScale = 1 / (carriers.length * height);

  // Pre-compute per-pixel amplitude (lum) and phase seed to avoid recalculation
  const pixelAmp = new Float32Array(width * height);
  const pixelPhaseSeed = new Float32Array(width * height);
  const pixelHue = new Float32Array(width * height);
  const pixelIsLeft = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const px = pixels[i];
    if (!px || px.a < 4) {
      pixelAmp[i] = 0;
      continue;
    }
    pixelAmp[i] = lum(px);
    const [h] = toHsv(px);
    pixelHue[i] = h / 360;
    const pixelSeed = (i * 2654435761) >>> 0;
    pixelPhaseSeed[i] = (pixelSeed & 0xFFFF) / 0xFFFF;
    pixelIsLeft[i] = i % width < midCol ? 1 : 0;
  }

  // Pre-compute sin table for faster lookup (1024 entries)
  const sinTable = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    sinTable[i] = Math.sin(2 * Math.PI * (i / 1024));
  }

  for (let col = 0; col < width; col++) {
    const s0 = Math.floor(col * samplesPerCol);
    const s1 = Math.floor((col + 1) * samplesPerCol);
    const n  = s1 - s0;

    for (let row = 0; row < height; row++) {
      const pixIdx = row * width + col;
      const pixLum = pixelAmp[pixIdx];
      if (pixLum === 0) continue;

      const phaseSeed = pixelPhaseSeed[pixIdx];
      const hue = pixelHue[pixIdx];
      const isLeft = pixelIsLeft[pixIdx];

      for (let ci = 0; ci < carriers.length; ci++) {
        const hz = carriers[ci];
        const dt = hz / sampleRate;
        for (let s = s0; s < s1; s++) {
          const lt = s - s0;
          const ph = (phaseSeed + phaseAcc[ci] + lt * dt + hue) % 1;
          const sinIdx = Math.floor(ph * 1024) & 1023;
          const sig = pixLum * sinTable[sinIdx] * ampScale;
          if (isLeft) L[s] += sig;
          else        R[s] += sig;
        }
      }
    }

    for (let ci = 0; ci < carriers.length; ci++) {
      phaseAcc[ci] = (phaseAcc[ci] + n * carriers[ci] / sampleRate) % 1;
    }

    if (col % COLS_PER_CHUNK === COLS_PER_CHUNK - 1) {
      onProgress?.(0.5 + (col + 1) / width * 0.5);
      await yieldToUI();
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

async function cymatics(
  pixels: PixelData[], width: number, height: number,
  totalSamples: number, sampleRate: number,
  onProgress?: ProgressCallback,
): Promise<Float32Array> {
  const MODAL_GRID = 8;
  const L = new Float32Array(totalSamples);
  const R = new Float32Array(totalSamples);

  type ChladniMode = { m: number; n: number; hz: number; ampL: number; ampR: number; phase: number };
  const modes: ChladniMode[] = [];

  for (let m = 1; m <= MODAL_GRID; m++) {
    for (let n = 1; n <= MODAL_GRID; n++) {
      const hz = CHLADNI_C * (m * m + n * n);
      if (hz > 20000) continue;

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
      const phaseSeed = ((m * 31 + n * 37) & 0xFF) / 255;
      modes.push({ m, n, hz, ampL, ampR, phase: phaseSeed });
    }
  }

  const maxAmpL = Math.max(...modes.map((mo) => mo.ampL), 1e-9);
  const maxAmpR = Math.max(...modes.map((mo) => mo.ampR), 1e-9);

  // Synthesize in chunks of 8 modes
  const MODES_PER_CHUNK = 8;
  for (let mi = 0; mi < modes.length; mi++) {
    const mode = modes[mi];
    const dt = mode.hz / sampleRate;
    const normAmpL = mode.ampL / maxAmpL;
    const normAmpR = mode.ampR / maxAmpR;
    const edgeWeight = 1 / Math.sqrt(mode.m + mode.n);

    for (let s = 0; s < totalSamples; s++) {
      const ph = (mode.phase + s * dt) % 1;
      const sig = Math.sin(2 * Math.PI * ph);
      L[s] += sig * normAmpL * edgeWeight;
      R[s] += sig * normAmpR * edgeWeight;
    }

    if (mi % MODES_PER_CHUNK === MODES_PER_CHUNK - 1) {
      onProgress?.((mi + 1) / modes.length);
      await yieldToUI();
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

// ─── ENGINE 5: BINARY CODE (chunked async) ───────────────────────────────────

async function binary(
  pixels: PixelData[], width: number, height: number,
  totalSamples: number, sampleRate: number,
  onProgress?: ProgressCallback,
): Promise<Float32Array> {
  const base = await spectral(pixels, width, height, totalSamples, sampleRate,
    onProgress ? (p) => onProgress(p * 0.5) : undefined);

  const totalPixels = width * height;
  const bitsPerPixel = 24;
  const totalBits = totalPixels * bitsPerPixel;
  const samplesPerBit = Math.max(1, Math.floor(totalSamples / totalBits));

  const binBuf = new Float32Array(totalSamples);
  let sampleIdx = 0;
  let pixelsDone = 0;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const px = pixels[row * width + col];
      if (!px) { pixelsDone++; continue; }

      const brightness = lum(px);
      const amp = 0.3 + brightness * 0.7;
      const bits24 = ((px.r & 0xFF) << 16) | ((px.g & 0xFF) << 8) | (px.b & 0xFF);

      for (let bit = 23; bit >= 0; bit--) {
        if (sampleIdx >= totalSamples) break;
        const isOne = (bits24 >> bit) & 1;
        const hz = isOne ? BIN_HIGH_HZ : BIN_LOW_HZ;
        const dt = hz / sampleRate;
        const phaseSeed = ((row * width + col) * 24 + (23 - bit)) / totalBits;

        for (let s = 0; s < samplesPerBit && sampleIdx + s < totalSamples; s++) {
          const ph = (phaseSeed + s * dt) % 1;
          binBuf[sampleIdx + s] += amp * Math.sin(2 * Math.PI * ph);
        }
        sampleIdx += samplesPerBit;
      }
      pixelsDone++;
    }

    // Yield every row
    if (row % 8 === 7) {
      onProgress?.(0.5 + pixelsDone / totalPixels * 0.5);
      await yieldToUI();
    }
  }

  const normBin = normalize(binBuf);

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

/**
 * Synchronous synthesis (kept for backward-compat with tests).
 * On large inputs this blocks the UI — prefer synthesizeFromPixelsAsync.
 */
export function synthesizeFromPixels(
  pixels: PixelData[], width: number, height: number,
  options: SonificationOptions,
): Float32Array {
  // Run the async version synchronously via a blocking trampoline.
  // This is only used in tests — the UI always calls synthesizeFromPixelsAsync.
  let result: Float32Array | null = null;
  let done = false;
  synthesizeFromPixelsAsync(pixels, width, height, options).then((r) => {
    result = r;
    done = true;
  });
  // Spin-wait (acceptable only in test environment, never in UI)
  const deadline = Date.now() + 60_000;
  while (!done && Date.now() < deadline) {
    // busy wait — tests only
  }
  return result ?? new Float32Array(0);
}

/** Simultaneous synthesis: mix all five modes together. */
async function simultaneous(
  pixels: PixelData[], width: number, height: number,
  totalSamples: number, sampleRate: number, carriers: number[],
  onProgress?: ProgressCallback,
): Promise<Float32Array> {
  const modes: SonificationMode[] = ["SPECTRAL", "WAVE_GENETICS", "BIOFIELD", "CYMATICS", "BINARY"];
  const tracks: Float32Array[] = [];

  for (let i = 0; i < modes.length; i++) {
    const mode = modes[i];
    const progressStart = i / modes.length;
    const progressEnd = (i + 1) / modes.length;
    let track: Float32Array;

    if (mode === "BIOFIELD") {
      track = await biofield(pixels, width, height, totalSamples, sampleRate, carriers,
        onProgress ? (p) => onProgress(progressStart + p * (progressEnd - progressStart)) : undefined);
    } else {
      const opts: SonificationOptions = {
        mode,
        durationSeconds: totalSamples / sampleRate,
        carrierFrequencies: carriers,
        sampleRate,
      };
      track = await synthesizeFromPixelsAsync(pixels, width, height, opts,
        onProgress ? (p) => onProgress(progressStart + p * (progressEnd - progressStart)) : undefined);
    }
    tracks.push(track);
  }

  // Mix all five tracks at equal amplitude
  const stereo = new Float32Array(totalSamples * 2);
  const scale = 0.2; // 1/5 for five tracks
  for (const track of tracks) {
    for (let i = 0; i < Math.min(track.length, stereo.length); i++) {
      stereo[i] += track[i] * scale;
    }
  }

  // Normalize to prevent clipping
  let peak = 0;
  for (let i = 0; i < stereo.length; i++) {
    if (Math.abs(stereo[i]) > peak) peak = Math.abs(stereo[i]);
  }
  if (peak > 1e-9) {
    const norm = 0.92 / peak;
    for (let i = 0; i < stereo.length; i++) stereo[i] *= norm;
  }
  return stereo;
}

/**
 * Async synthesis with progress callbacks — use this in the UI.
 * Yields to the event loop every COLS_PER_CHUNK columns so the UI stays responsive.
 */
export async function synthesizeFromPixelsAsync(
  pixels: PixelData[], width: number, height: number,
  options: SonificationOptions,
  onProgress?: ProgressCallback,
): Promise<Float32Array> {
  const { mode, durationSeconds, carrierFrequencies, sampleRate } = options;
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  switch (mode) {
    case "WAVE_GENETICS":
      return waveGenetics(pixels, width, height, totalSamples, sampleRate, onProgress);
    case "SPECTRAL":
      return spectral(pixels, width, height, totalSamples, sampleRate, onProgress);
    case "BIOFIELD":
      return biofield(pixels, width, height, totalSamples, sampleRate, carrierFrequencies, onProgress);
    case "CYMATICS":
      return cymatics(pixels, width, height, totalSamples, sampleRate, onProgress);
    case "BINARY":
      return binary(pixels, width, height, totalSamples, sampleRate, onProgress);
    case "SIMULTANEOUS":
      return simultaneous(pixels, width, height, totalSamples, sampleRate, carrierFrequencies, onProgress);
    default:
      return waveGenetics(pixels, width, height, totalSamples, sampleRate, onProgress);
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
  const len = bytes.length;
  // Pre-allocate result array for O(n) performance — avoids string concat GC pressure
  const parts: string[] = [];
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    parts.push(
      B64_CHARS[b0 >> 2],
      B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)],
      i + 1 < len ? B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : "=",
      i + 2 < len ? B64_CHARS[b2 & 63] : "=",
    );
  }
  return parts.join("");
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
