/**
 * V1 Native Engine — Gariaev-Inspired Horizontal/Vertical Raster Scan
 * 
 * Implements the exact V1 blueprint:
 * - 24,000 Hz stereo PCM_24 (stored as Float32 internally)
 * - BOX pooling: horizontal 256×H, vertical W×256, global 256×256
 * - 1600 samples per scanline, 15 scanlines per second
 * - Serpentine scan (alternating direction each row/column)
 * - Landmark tones: 396, 417, 528, 639, 741, 852 Hz
 * - 4-second global reference + 12-second Fourier closure
 * - Vertical recurrence: 13/37/79 blocks at 0.19/0.12/0.07 mix
 * - History limit: 96 mono blocks
 * 
 * This is the FULL IMAGE INFORMATION scan — every pixel contributes.
 */

import type { PixelData, ProgressCallback } from "./sonification-engine";

// ─── Constants ───────────────────────────────────────────────────────────────

const V1_SAMPLE_RATE = 24000;
const SCANLINE_SAMPLES = 1600; // samples per scanline
const SCANLINES_PER_SEC = 15;
const GLOBAL_REF_SECONDS = 4;
const FOURIER_CLOSURE_SECONDS = 12;
const LANDMARK_TONES = [396, 417, 528, 639, 741, 852]; // Hz
const RECURRENCE_DELAYS = [13, 37, 79]; // scanline blocks
const RECURRENCE_GAINS = [0.19, 0.12, 0.07];
const HISTORY_LIMIT = 96; // mono blocks max

// Pre-computed sin table for speed
const SIN_TABLE_SIZE = 65536;
const SIN_TABLE = new Float32Array(SIN_TABLE_SIZE);
for (let i = 0; i < SIN_TABLE_SIZE; i++) {
  SIN_TABLE[i] = Math.sin((2 * Math.PI * i) / SIN_TABLE_SIZE);
}
function fastSin(phase: number): number {
  const idx = ((phase % 1.0 + 1.0) % 1.0) * SIN_TABLE_SIZE;
  return SIN_TABLE[idx | 0];
}

// ─── BOX Pooling ─────────────────────────────────────────────────────────────

function boxPool(
  pixels: PixelData[],
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Float32Array {
  // Returns RGB normalized to [0,1] as flat array [r,g,b, r,g,b, ...]
  const out = new Float32Array(dstW * dstH * 3);
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    const sy0 = Math.floor(dy * scaleY);
    const sy1 = Math.min(Math.ceil((dy + 1) * scaleY), srcH);
    for (let dx = 0; dx < dstW; dx++) {
      const sx0 = Math.floor(dx * scaleX);
      const sx1 = Math.min(Math.ceil((dx + 1) * scaleX), srcW);

      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const px = pixels[sy * srcW + sx];
          if (px) {
            rSum += px.r;
            gSum += px.g;
            bSum += px.b;
            count++;
          }
        }
      }

      const idx = (dy * dstW + dx) * 3;
      if (count > 0) {
        out[idx] = rSum / (count * 255);
        out[idx + 1] = gSum / (count * 255);
        out[idx + 2] = bSum / (count * 255);
      }
    }
  }
  return out;
}

// ─── Visual Feature Extraction ───────────────────────────────────────────────

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function localContrast(pool: Float32Array, x: number, y: number, w: number, h: number): number {
  const idx = (y * w + x) * 3;
  const lum = luminance(pool[idx], pool[idx + 1], pool[idx + 2]);
  let sum = 0, count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && (dx !== 0 || dy !== 0)) {
        const ni = (ny * w + nx) * 3;
        sum += luminance(pool[ni], pool[ni + 1], pool[ni + 2]);
        count++;
      }
    }
  }
  return count > 0 ? Math.abs(lum - sum / count) : 0;
}

function sobelEdge(pool: Float32Array, x: number, y: number, w: number, h: number): number {
  if (x <= 0 || x >= w - 1 || y <= 0 || y >= h - 1) return 0;
  const getLum = (px: number, py: number) => {
    const i = (py * w + px) * 3;
    return luminance(pool[i], pool[i + 1], pool[i + 2]);
  };
  const gx = -getLum(x - 1, y - 1) - 2 * getLum(x - 1, y) - getLum(x - 1, y + 1)
    + getLum(x + 1, y - 1) + 2 * getLum(x + 1, y) + getLum(x + 1, y + 1);
  const gy = -getLum(x - 1, y - 1) - 2 * getLum(x, y - 1) - getLum(x + 1, y - 1)
    + getLum(x - 1, y + 1) + 2 * getLum(x, y + 1) + getLum(x + 1, y + 1);
  return Math.sqrt(gx * gx + gy * gy);
}

// ─── Scanline Synthesis ──────────────────────────────────────────────────────

function synthesizeScanline(
  pool: Float32Array,
  cellX: number,
  cellY: number,
  poolW: number,
  poolH: number,
  sampleOffset: number,
  L: Float32Array,
  R: Float32Array,
): void {
  const idx = (cellY * poolW + cellX) * 3;
  const r = pool[idx], g = pool[idx + 1], b = pool[idx + 2];
  const lum = luminance(r, g, b);
  const contrast = localContrast(pool, cellX, cellY, poolW, poolH);
  const edge = sobelEdge(pool, cellX, cellY, poolW, poolH);

  // Red/blue/earth emphasis
  const redEmph = Math.max(0, r - 0.5 * (g + b));
  const blueEmph = Math.max(0, b - 0.5 * (r + g));
  const earthEmph = Math.min(r, g) * (1 - b);

  // Map to frequencies
  const basePitch = 120 + lum * 1800; // 120-1920 Hz based on luminance
  const contrastMod = contrast * 4; // Modulation depth from contrast
  const edgeGrain = edge * 0.3; // Granular texture from edges

  // Harmonic family from color
  const harmRatio = 1 + redEmph * 0.5; // Red shifts harmonics up
  const stereoPos = blueEmph - redEmph; // Blue=left, Red=right
  const earthWarmth = earthEmph * 0.4; // Earth adds warmth (sub-harmonics)

  // Orientation → phase offset
  const orientation = Math.atan2(blueEmph - redEmph, lum + 0.001);
  const phaseOffset = orientation / (2 * Math.PI);

  for (let s = 0; s < SCANLINE_SAMPLES; s++) {
    const t = (sampleOffset + s) / V1_SAMPLE_RATE;
    const phase = t * basePitch;

    // Main carrier with harmonics
    let sig = lum * 0.5 * fastSin(phase + phaseOffset);
    sig += lum * 0.25 * fastSin(phase * harmRatio + phaseOffset);
    sig += earthWarmth * fastSin(phase * 0.5 + phaseOffset);

    // Contrast modulation
    sig *= 1 + contrastMod * fastSin(t * 8.3);

    // Edge granularity
    sig += edgeGrain * fastSin(phase * 3.17 + phaseOffset * 2);

    // Landmark tone gates (image-gated)
    for (let li = 0; li < LANDMARK_TONES.length; li++) {
      const lmFreq = LANDMARK_TONES[li];
      const gate = (li === 0 ? lum : li === 1 ? r : li === 2 ? g :
        li === 3 ? b : li === 4 ? contrast : edge) * 0.04;
      sig += gate * fastSin(t * lmFreq);
    }

    // Stereo placement
    const leftGain = 0.5 + 0.5 * Math.max(-1, Math.min(1, -stereoPos));
    const rightGain = 0.5 + 0.5 * Math.max(-1, Math.min(1, stereoPos));

    L[sampleOffset + s] += sig * leftGain;
    R[sampleOffset + s] += sig * rightGain;
  }
}

// ─── Global Reference ────────────────────────────────────────────────────────

function synthesizeGlobalReference(
  globalPool: Float32Array,
  L: Float32Array,
  R: Float32Array,
): void {
  const refSamples = GLOBAL_REF_SECONDS * V1_SAMPLE_RATE;

  // Compute global statistics from 256×256 pool
  let avgLum = 0, avgR = 0, avgG = 0, avgB = 0;
  const totalCells = 256 * 256;
  for (let i = 0; i < totalCells; i++) {
    avgR += globalPool[i * 3];
    avgG += globalPool[i * 3 + 1];
    avgB += globalPool[i * 3 + 2];
    avgLum += luminance(globalPool[i * 3], globalPool[i * 3 + 1], globalPool[i * 3 + 2]);
  }
  avgR /= totalCells; avgG /= totalCells; avgB /= totalCells; avgLum /= totalCells;

  for (let s = 0; s < refSamples; s++) {
    const t = s / V1_SAMPLE_RATE;
    let sig = 0;

    // Solfeggio landmark tones gated by global color
    sig += avgLum * 0.15 * fastSin(t * 396);
    sig += avgR * 0.12 * fastSin(t * 417);
    sig += avgG * 0.12 * fastSin(t * 528);
    sig += avgB * 0.12 * fastSin(t * 639);
    sig += (avgR + avgG) * 0.5 * 0.10 * fastSin(t * 741);
    sig += (avgG + avgB) * 0.5 * 0.10 * fastSin(t * 852);

    // Slow envelope
    const env = 0.5 * (1 - Math.cos(2 * Math.PI * t / GLOBAL_REF_SECONDS));
    L[s] = sig * env * 0.7;
    R[s] = sig * env * 0.7;
  }
}

// ─── Fourier Closure ─────────────────────────────────────────────────────────

function synthesizeFourierClosure(
  globalPool: Float32Array,
  startSample: number,
  L: Float32Array,
  R: Float32Array,
): void {
  const closureSamples = FOURIER_CLOSURE_SECONDS * V1_SAMPLE_RATE;

  // 2D Fourier of the global 256×256 image → top frequency components
  // Simplified: extract dominant spatial frequencies
  const freqs: { hz: number; amp: number; phase: number; stereo: number }[] = [];

  for (let ky = 0; ky < 16; ky++) {
    for (let kx = 0; kx < 16; kx++) {
      if (kx === 0 && ky === 0) continue;
      let cosSum = 0, sinSum = 0;
      for (let y = 0; y < 256; y += 4) {
        for (let x = 0; x < 256; x += 4) {
          const idx = (y * 256 + x) * 3;
          const lum = luminance(globalPool[idx], globalPool[idx + 1], globalPool[idx + 2]);
          const angle = 2 * Math.PI * (kx * x / 256 + ky * y / 256);
          cosSum += lum * Math.cos(angle);
          sinSum += lum * Math.sin(angle);
        }
      }
      const amp = Math.sqrt(cosSum * cosSum + sinSum * sinSum) / (64 * 64);
      const phase = Math.atan2(sinSum, cosSum);
      const hz = 80 + Math.sqrt(kx * kx + ky * ky) * 120;
      const stereo = Math.atan2(ky, kx + 0.001) / Math.PI;
      freqs.push({ hz, amp, phase, stereo });
    }
  }

  // Sort by amplitude, take top 48
  freqs.sort((a, b) => b.amp - a.amp);
  const topFreqs = freqs.slice(0, 48);

  for (let s = 0; s < closureSamples; s++) {
    const t = s / V1_SAMPLE_RATE;
    const env = 0.5 * (1 - Math.cos(2 * Math.PI * t / FOURIER_CLOSURE_SECONDS));
    let lSig = 0, rSig = 0;

    for (const f of topFreqs) {
      const sig = f.amp * 0.3 * fastSin(t * f.hz + f.phase / (2 * Math.PI));
      const lGain = 0.5 + 0.5 * Math.max(-1, Math.min(1, -f.stereo));
      const rGain = 0.5 + 0.5 * Math.max(-1, Math.min(1, f.stereo));
      lSig += sig * lGain;
      rSig += sig * rGain;
    }

    L[startSample + s] += lSig * env;
    R[startSample + s] += rSig * env;
  }
}

// ─── Main V1 Synthesis ───────────────────────────────────────────────────────

export async function synthesizeV1Native(
  pixels: PixelData[],
  width: number,
  height: number,
  onProgress?: ProgressCallback,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  // BOX pool to three scales
  const horizontalPool = boxPool(pixels, width, height, 256, height);
  const verticalPool = boxPool(pixels, width, height, width, 256);
  const globalPool = boxPool(pixels, width, height, 256, 256);

  // Calculate total duration
  const hScanlines = height;
  const vScanlines = width;
  const totalScanlines = hScanlines + vScanlines;
  const scanDuration = totalScanlines * SCANLINE_SAMPLES;
  const totalSamples = GLOBAL_REF_SECONDS * V1_SAMPLE_RATE + scanDuration +
    FOURIER_CLOSURE_SECONDS * V1_SAMPLE_RATE;

  const L = new Float32Array(totalSamples);
  const R = new Float32Array(totalSamples);

  // 1. Global reference (4 seconds)
  synthesizeGlobalReference(globalPool, L, R);
  onProgress?.(0.05);

  // 2. Horizontal raster (serpentine scan)
  let sampleOffset = GLOBAL_REF_SECONDS * V1_SAMPLE_RATE;
  const hHistory: Float32Array[] = []; // Recurrence history

  for (let row = 0; row < height; row++) {
    const direction = row % 2 === 0 ? 1 : -1; // Serpentine
    for (let i = 0; i < 256; i++) {
      const col = direction === 1 ? i : 255 - i;
      synthesizeScanline(horizontalPool, col, row, 256, height, sampleOffset, L, R);
      sampleOffset += SCANLINE_SAMPLES;
    }

    if (row % Math.max(1, Math.floor(height / 20)) === 0) {
      onProgress?.(0.05 + 0.4 * (row / height));
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // 3. Vertical raster with recurrence (serpentine scan)
  const blockHistory: Float32Array[] = [];

  for (let col = 0; col < width; col++) {
    const direction = col % 2 === 0 ? 1 : -1;

    // Current block
    const blockStart = sampleOffset;

    for (let i = 0; i < 256; i++) {
      const row = direction === 1 ? i : 255 - i;
      synthesizeScanline(verticalPool, col, row, width, 256, sampleOffset, L, R);
      sampleOffset += SCANLINE_SAMPLES;
    }

    // Store block for recurrence
    const blockLen = sampleOffset - blockStart;
    const block = new Float32Array(blockLen);
    for (let s = 0; s < blockLen; s++) {
      block[s] = (L[blockStart + s] + R[blockStart + s]) * 0.5;
    }
    blockHistory.push(block);
    if (blockHistory.length > HISTORY_LIMIT) blockHistory.shift();

    // Apply recurrence from history
    for (let ri = 0; ri < RECURRENCE_DELAYS.length; ri++) {
      const delay = RECURRENCE_DELAYS[ri];
      const gain = RECURRENCE_GAINS[ri];
      const histIdx = blockHistory.length - 1 - delay;
      if (histIdx >= 0 && histIdx < blockHistory.length) {
        const hist = blockHistory[histIdx];
        const mixLen = Math.min(hist.length, blockLen);
        for (let s = 0; s < mixLen; s++) {
          L[blockStart + s] += hist[s] * gain;
          R[blockStart + s] += hist[s] * gain * 0.8; // Slight stereo offset
        }
      }
    }

    if (col % Math.max(1, Math.floor(width / 20)) === 0) {
      onProgress?.(0.45 + 0.4 * (col / width));
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // 4. Fourier closure (12 seconds)
  synthesizeFourierClosure(globalPool, sampleOffset, L, R);
  onProgress?.(0.95);

  // Normalize
  let maxVal = 0;
  for (let i = 0; i < totalSamples; i++) {
    maxVal = Math.max(maxVal, Math.abs(L[i]), Math.abs(R[i]));
  }
  if (maxVal > 0) {
    const scale = 0.92 / maxVal;
    for (let i = 0; i < totalSamples; i++) {
      L[i] *= scale;
      R[i] *= scale;
    }
  }

  // Interleave stereo
  const stereo = new Float32Array(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    stereo[i * 2] = L[i];
    stereo[i * 2 + 1] = R[i];
  }

  onProgress?.(1.0);
  return { samples: stereo, sampleRate: V1_SAMPLE_RATE };
}

export const V1_SAMPLE_RATE_EXPORT = V1_SAMPLE_RATE;
