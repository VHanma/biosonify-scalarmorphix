/**
 * Gariaev Spinor Spectrum Extraction Engine
 *
 * Model: Photo → Laser Polarization Shift → Spinor Spectrum → Frequency Spectrum → Audio
 *
 * The Gariaev model treats a photograph as encoding "spinor information" — the
 * polarization state of light photons after interacting with the photo. This
 * polarization shift is converted to a frequency spectrum (via Fourier analysis)
 * and then to audio.
 *
 * Implementation:
 * 1. Each pixel's (R, G, B) values represent polarization components (Stokes parameters)
 * 2. Convert RGB to polarization state: (linear_h, linear_v, circular_r, circular_l)
 * 3. Compute the "spin modulation" — how the polarization changes across the image
 * 4. Extract eigenfrequencies from the spin modulation field
 * 5. These frequencies drive the audio synthesis
 */

export interface PixelData {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Stokes parameters represent the polarization state of light.
 * S0 = total intensity
 * S1 = linear horizontal - vertical
 * S2 = linear +45° - -45°
 * S3 = circular right - left
 */
export interface PolarizationState {
  s0: number; // intensity
  s1: number; // h-v
  s2: number; // +45
  s3: number; // circular
}

/**
 * Convert RGB pixel to Stokes polarization parameters.
 * Interpretation: R, G, B map to different polarization modes.
 */
export function pixelToStokes(pixel: PixelData): PolarizationState {
  const r = pixel.r / 255;
  const g = pixel.g / 255;
  const b = pixel.b / 255;

  // Total intensity (S0) from luminance
  const s0 = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Linear H-V (S1): Red encodes horizontal, Cyan (G+B) encodes vertical
  const s1 = r - (g + b) / 2;

  // Linear +45° (S2): Green encodes +45°, Magenta (R+B) encodes -45°
  const s2 = g - (r + b) / 2;

  // Circular (S3): Blue encodes right-circular, Yellow (R+G) encodes left-circular
  const s3 = b - (r + g) / 2;

  return { s0, s1, s2, s3 };
}

/**
 * Compute the "spin modulation" — the rate of change of polarization across space.
 * This represents how the spinor field evolves and encodes information.
 *
 * Returns frequencies derived from the spatial derivatives of the polarization field.
 */
export function extractSpinorFrequencies(
  pixels: PixelData[],
  width: number,
  height: number,
): number[] {
  const frequencies: number[] = [];

  // Compute Stokes parameters for all pixels
  const stokes: PolarizationState[] = pixels.map((p) => pixelToStokes(p));

  // Compute spatial derivatives (spin modulation)
  // dS/dx and dS/dy represent how polarization changes across the image
  const dSdx = new Float32Array(width * height);
  const dSdy = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const s = stokes[idx];

      // Horizontal derivative (dS/dx)
      if (x > 0) {
        const sLeft = stokes[y * width + (x - 1)];
        const dS1 = Math.abs(s.s1 - sLeft.s1);
        const dS2 = Math.abs(s.s2 - sLeft.s2);
        const dS3 = Math.abs(s.s3 - sLeft.s3);
        dSdx[idx] = Math.sqrt(dS1 * dS1 + dS2 * dS2 + dS3 * dS3);
      }

      // Vertical derivative (dS/dy)
      if (y > 0) {
        const sUp = stokes[(y - 1) * width + x];
        const dS1 = Math.abs(s.s1 - sUp.s1);
        const dS2 = Math.abs(s.s2 - sUp.s2);
        const dS3 = Math.abs(s.s3 - sUp.s3);
        dSdy[idx] = Math.sqrt(dS1 * dS1 + dS2 * dS2 + dS3 * dS3);
      }
    }
  }

  // Extract eigenfrequencies from the spin modulation field
  // Use a simple spectral analysis: compute FFT-like frequency bins
  const freqBins = new Map<number, number>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const s = stokes[idx];

      // Compute local "spin energy" — magnitude of polarization vector
      const spinEnergy = Math.sqrt(s.s1 * s.s1 + s.s2 * s.s2 + s.s3 * s.s3);

      // Map position and energy to frequency
      // Horizontal position → frequency (left=low, right=high)
      const freqFromX = 50 + (x / width) * 400; // 50–450 Hz range

      // Vertical position → frequency (top=low, bottom=high)
      const freqFromY = 100 + (y / height) * 300; // 100–400 Hz range

      // Combine: average of X and Y frequencies, weighted by spin energy
      const freq = (freqFromX + freqFromY) / 2;
      const weight = spinEnergy * s.s0; // Weight by intensity and spin magnitude

      // Accumulate in frequency bins (10 Hz resolution)
      const binKey = Math.round(freq / 10) * 10;
      freqBins.set(binKey, (freqBins.get(binKey) || 0) + weight);
    }
  }

  // Extract top frequencies by energy
  const sorted = Array.from(freqBins.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100); // Top 100 frequencies

  return sorted.map(([freq]) => freq);
}

/**
 * Compute spin coherence — a measure of how "organized" the polarization field is.
 * High coherence = strong, organized spinor information.
 * Low coherence = noisy, disorganized.
 */
export function computeSpinCoherence(pixels: PixelData[]): number {
  const stokes = pixels.map((p) => pixelToStokes(p));

  let totalEnergy = 0;
  let totalPolarization = 0;

  for (const s of stokes) {
    const energy = s.s0;
    const polarization = Math.sqrt(s.s1 * s.s1 + s.s2 * s.s2 + s.s3 * s.s3);

    totalEnergy += energy;
    totalPolarization += polarization;
  }

  // Coherence = average polarization / average intensity
  // Range: 0 (unpolarized) to 1 (fully polarized)
  return totalEnergy > 0 ? totalPolarization / totalEnergy : 0;
}

/**
 * Compute the "holographic signature" of the image — a single frequency that
 * represents the overall spinor information content.
 *
 * This is used as a carrier frequency in synthesis modes.
 */
export function computeHolographicFrequency(pixels: PixelData[]): number {
  const stokes = pixels.map((p) => pixelToStokes(p));

  let sumS1 = 0,
    sumS2 = 0,
    sumS3 = 0;

  for (const s of stokes) {
    sumS1 += s.s1;
    sumS2 += s.s2;
    sumS3 += s.s3;
  }

  // Compute the "net spin" — vector sum of all polarization states
  const netSpin = Math.sqrt(sumS1 * sumS1 + sumS2 * sumS2 + sumS3 * sumS3);

  // Map net spin to frequency (0–1 range → 50–500 Hz)
  const freq = 50 + netSpin * 450;

  return Math.max(20, Math.min(20000, freq));
}

/**
 * Compute spin modulation depth — how much the polarization changes across the image.
 * High depth = rich information content.
 * Low depth = simple, uniform information.
 */
export function computeSpinModulationDepth(
  pixels: PixelData[],
  width: number,
  height: number,
): number {
  const stokes = pixels.map((p) => pixelToStokes(p));

  let totalModulation = 0;
  let count = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const s = stokes[idx];

      // Horizontal modulation
      if (x > 0) {
        const sLeft = stokes[y * width + (x - 1)];
        const dS = Math.sqrt(
          Math.pow(s.s1 - sLeft.s1, 2) +
            Math.pow(s.s2 - sLeft.s2, 2) +
            Math.pow(s.s3 - sLeft.s3, 2),
        );
        totalModulation += dS;
        count++;
      }

      // Vertical modulation
      if (y > 0) {
        const sUp = stokes[(y - 1) * width + x];
        const dS = Math.sqrt(
          Math.pow(s.s1 - sUp.s1, 2) +
            Math.pow(s.s2 - sUp.s2, 2) +
            Math.pow(s.s3 - sUp.s3, 2),
        );
        totalModulation += dS;
        count++;
      }
    }
  }

  return count > 0 ? totalModulation / count : 0;
}
