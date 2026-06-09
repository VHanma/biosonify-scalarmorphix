/**
 * Gariaev Virtual Spinor Spectrum Extraction Engine
 *
 * Android-only Virtual Gariaev Spinor Spectrum Model
 *
 * Chain:
 * Photo → Virtual 632.8nm He-Ne illumination → Stokes polarization field
 * → spin modulation field → 2D DCT spectrum → audible frequency bins
 */

export interface PixelData {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface PolarizationState {
  s0: number;
  s1: number;
  s2: number;
  s3: number;
}

export interface SpinorBin {
  hz: number;
  energy: number;
  phase: number;
  kx: number;
  ky: number;
}

export interface SpinorSpectrum {
  bins: SpinorBin[];
  holographicFrequency: number;
  coherence: number;
  modulationDepth: number;
  carrierHz: number;
}

// ─── Physical Constants ───────────────────────────────────────────────────────

const C_LIGHT = 299_792_458;
const HENE_WAVELENGTH_NM = 632.8;
const HENE_WAVELENGTH_M = HENE_WAVELENGTH_NM * 1e-9;
const HENE_OPTICAL_HZ = C_LIGHT / HENE_WAVELENGTH_M;

// 632.8nm folded down by 44 octaves ≈ 26.93 Hz
const OPTICAL_OCTAVE_SHIFT = 44;
export const HENE_AUDIO_BASE_HZ = HENE_OPTICAL_HZ / Math.pow(2, OPTICAL_OCTAVE_SHIFT);

// ─── Utility Functions ────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function srgbToLinear(v: number): number {
  const x = clamp01(v / 255);
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function rgbToHsv01(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d > 1e-9) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  const s = max <= 1e-9 ? 0 : d / max;
  return [h, s, max];
}

// ─── Stokes Polarization Model ────────────────────────────────────────────────

/**
 * Virtual He-Ne/Stokes model.
 *
 * s0 = transmitted laser intensity through photo
 * s1/s2 = linear polarization axes
 * s3 = circular/elliptical component
 *
 * The vector is normalized so: sqrt(s1²+s2²+s3²) <= s0
 */
export function pixelToStokes(pixel: PixelData): PolarizationState {
  const a = pixel.a / 255;

  const r = srgbToLinear(pixel.r);
  const g = srgbToLinear(pixel.g);
  const b = srgbToLinear(pixel.b);

  const [hue, sat, value] = rgbToHsv01(r, g, b);

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Virtual 632.8nm red laser interacts mostly with red-channel transmittance,
  // but luminance preserves full-photo structure.
  const redTransmittance = r;
  const s0 = a * clamp01(0.65 * luminance + 0.35 * redTransmittance);

  if (s0 < 1e-9) {
    return { s0: 0, s1: 0, s2: 0, s3: 0 };
  }

  // Hue becomes polarization angle.
  const theta = hue * Math.PI;

  // Saturation becomes degree of polarization.
  const degree = clamp01(0.15 + 0.85 * sat);

  // Blue/red imbalance becomes virtual retardance/circularity.
  const circularBias = clamp01(Math.abs(b - r));
  const ellipticity = (b - r) * circularBias;

  let s1 = s0 * degree * Math.cos(2 * theta);
  let s2 = s0 * degree * Math.sin(2 * theta);
  let s3 = s0 * degree * ellipticity;

  const mag = Math.sqrt(s1 * s1 + s2 * s2 + s3 * s3);
  if (mag > s0 && mag > 1e-9) {
    const scale = s0 / mag;
    s1 *= scale;
    s2 *= scale;
    s3 *= scale;
  }

  return { s0, s1, s2, s3 };
}

// ─── Spin Modulation Field ────────────────────────────────────────────────────

/**
 * Build the spin modulation field: spatial derivatives of the polarization field.
 * This represents how the spinor information is encoded across the image.
 */
export function buildSpinModulationField(
  pixels: PixelData[],
  width: number,
  height: number,
): Float32Array {
  const stokes = pixels.map(pixelToStokes);
  const field = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const s = stokes[idx];

      let dx = 0;
      let dy = 0;

      if (x > 0) {
        const l = stokes[y * width + (x - 1)];
        dx = Math.sqrt(
          Math.pow(s.s1 - l.s1, 2) +
            Math.pow(s.s2 - l.s2, 2) +
            Math.pow(s.s3 - l.s3, 2),
        );
      }

      if (y > 0) {
        const u = stokes[(y - 1) * width + x];
        dy = Math.sqrt(
          Math.pow(s.s1 - u.s1, 2) +
            Math.pow(s.s2 - u.s2, 2) +
            Math.pow(s.s3 - u.s3, 2),
        );
      }

      const spinGradient = Math.sqrt(dx * dx + dy * dy);
      field[idx] = spinGradient * s.s0;
    }
  }

  return field;
}

// ─── DCT Spectrum Extraction ──────────────────────────────────────────────────

/**
 * Extract spinor spectrum via 2D DCT of the spin modulation field.
 * Returns top frequency bins sorted by energy.
 */
export function extractSpinorSpectrum(
  pixels: PixelData[],
  width: number,
  height: number,
  maxBins = 96,
): SpinorBin[] {
  const field = buildSpinModulationField(pixels, width, height);
  const bins: SpinorBin[] = [];

  // 32×32 DCT grid is enough for Android performance.
  const K = 32;

  for (let ky = 0; ky < K; ky++) {
    for (let kx = 0; kx < K; kx++) {
      if (kx === 0 && ky === 0) continue;

      let re = 0;

      for (let y = 0; y < height; y++) {
        const cy = Math.cos((Math.PI * (y + 0.5) * ky) / height);

        for (let x = 0; x < width; x++) {
          const cx = Math.cos((Math.PI * (x + 0.5) * kx) / width);
          re += field[y * width + x] * cx * cy;
        }
      }

      const spatial = Math.sqrt(kx * kx + ky * ky);
      const t = spatial / Math.sqrt(2 * K * K);

      // Auditory spectrum range: 40 Hz to 20 kHz
      const hz = 40 * Math.pow(20_000 / 40, t);

      bins.push({
        hz,
        energy: Math.abs(re),
        phase: re >= 0 ? 0 : Math.PI,
        kx,
        ky,
      });
    }
  }

  const peak = Math.max(...bins.map((b) => b.energy), 1e-9);

  return bins
    .map((b) => ({ ...b, energy: b.energy / peak }))
    .filter((b) => b.energy > 0.01)
    .sort((a, b) => b.energy - a.energy)
    .slice(0, maxBins);
}

// ─── Holographic Frequency ────────────────────────────────────────────────────

/**
 * Compute holographic frequency: RMS/net-spin version.
 * This prevents saturation and keeps different images distinct.
 */
export function computeHolographicFrequency(pixels: PixelData[]): number {
  let sumSpin2 = 0;
  let sumS02 = 0;

  let sumS1 = 0;
  let sumS2 = 0;
  let sumS3 = 0;

  for (const pixel of pixels) {
    const s = pixelToStokes(pixel);

    const spin2 = s.s1 * s.s1 + s.s2 * s.s2 + s.s3 * s.s3;

    sumSpin2 += spin2;
    sumS02 += s.s0 * s.s0;

    sumS1 += s.s1;
    sumS2 += s.s2;
    sumS3 += s.s3;
  }

  const n = Math.max(1, pixels.length);

  const spinRms = Math.sqrt(sumSpin2 / n);
  const intensityRms = Math.sqrt(sumS02 / n);

  const netS1 = sumS1 / n;
  const netS2 = sumS2 / n;
  const netS3 = sumS3 / n;

  const netSpin = Math.sqrt(netS1 * netS1 + netS2 * netS2 + netS3 * netS3);

  const spinEnergy = intensityRms > 1e-9 ? spinRms / intensityRms : 0;
  const spinBias = spinRms > 1e-9 ? netSpin / spinRms : 0;

  const normalized = clamp01(0.75 * spinEnergy + 0.25 * spinBias);

  return 40 + normalized * 960;
}

// ─── Coherence Metrics ────────────────────────────────────────────────────────

/**
 * Compute spin coherence: measure of polarization organization (0–1).
 */
export function computeSpinCoherence(pixels: PixelData[]): number {
  let sumS0 = 0;
  let sumPol = 0;

  for (const pixel of pixels) {
    const s = pixelToStokes(pixel);
    const pol = Math.sqrt(s.s1 * s.s1 + s.s2 * s.s2 + s.s3 * s.s3);

    sumS0 += s.s0;
    sumPol += pol;
  }

  return sumS0 > 1e-9 ? clamp01(sumPol / sumS0) : 0;
}

/**
 * Compute spin modulation depth: information content richness.
 */
export function computeSpinModulationDepth(
  pixels: PixelData[],
  width: number,
  height: number,
): number {
  const field = buildSpinModulationField(pixels, width, height);

  let sum = 0;
  let sum2 = 0;

  for (const v of field) {
    sum += v;
    sum2 += v * v;
  }

  const n = Math.max(1, field.length);
  const mean = sum / n;
  const rms = Math.sqrt(sum2 / n);

  return mean > 1e-9 ? clamp01(rms / (mean + rms)) : 0;
}

// ─── Full Analysis ────────────────────────────────────────────────────────────

/**
 * Analyze the complete spinor spectrum of an image.
 */
export function analyzeSpinorSpectrum(
  pixels: PixelData[],
  width: number,
  height: number,
): SpinorSpectrum {
  const bins = extractSpinorSpectrum(pixels, width, height, 96);

  return {
    bins,
    holographicFrequency: computeHolographicFrequency(pixels),
    coherence: computeSpinCoherence(pixels),
    modulationDepth: computeSpinModulationDepth(pixels, width, height),
    carrierHz: HENE_AUDIO_BASE_HZ,
  };
}
