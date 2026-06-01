/**
 * BioSonify Deterministic Sonification Engine v4
 *
 * ANDROID COMPATIBILITY:
 * - NO btoa/atob — uses self-contained base64 encoder
 * - All synthesis is pure JS arithmetic — no browser globals
 * - Exports ArrayBuffer for file writing, never data: URIs
 *
 * CORE PRINCIPLE: Every audio sample is a mathematically exact, deterministic
 * function of the image's pixel data. Zero randomness. Same image = same audio.
 *
 * ── MODE 1: GARIAEV WAVE GENETICS (correct physics) ──────────────────────────
 *
 *  Based on Peter Gariaev's He-Ne laser (632.8 nm) signal chain:
 *
 *  STEP 1 — Optical frequency of 632.8 nm He-Ne laser:
 *    f_optical = c / λ = 299,792,458 / 632.8e-9 ≈ 473.7 THz
 *
 *  STEP 2 — WSRW downconversion (wide-spectrum radio waves):
 *    The backscatter inside the laser cavity converts optical → radio.
 *    The modulation patterns are preserved; only the carrier frequency changes.
 *    Gariaev documented radio output around 600 kHz (600,000 Hz).
 *    Downconversion ratio K = 473.7e12 / 600e3 ≈ 789,500,000
 *    This ratio is used to map image spatial frequencies to audio.
 *
 *  STEP 3 — Acoustic downconversion (radio → audio):
 *    Final audio range: 20 Hz – 20,000 Hz
 *    Secondary ratio from 600 kHz radio to audio:
 *    K2 = 600,000 / 20,000 = 30 (maps radio band to audio band)
 *    Combined: f_audio = f_spatial_hz / (K * K2) — but in practice we use
 *    octave reduction: f_audio = f_optical / 2^n where n ≈ 54 maps 473.7 THz
 *    to ~26.5 Hz (the base), and the image spatial frequencies modulate
 *    upward from this base.
 *
 *  STEP 4 — Dual orthogonal polarization modes:
 *    H-pol (horizontal): modulated by horizontal brightness gradient (∂L/∂x)
 *    V-pol (vertical):   modulated by vertical brightness gradient (∂L/∂y)
 *    H-pol → LEFT stereo channel
 *    V-pol → RIGHT stereo channel
 *    Polarization angle θ = atan2(V_grad, H_grad) → phase offset between channels
 *
 *  STEP 5 — Spatial frequency content drives audio frequency content:
 *    2D spatial frequency of image patch → audio frequency band
 *    Low spatial freq (smooth areas) → low audio frequencies (80–400 Hz)
 *    High spatial freq (edges/detail) → high audio frequencies (400–8000 Hz)
 *    Implemented via local contrast (Laplacian approximation) per pixel column
 *
 *  STEP 6 — Gariaev acoustic texture (from matrix audio analysis):
 *    - Mid-range dominance: 400–4000 Hz
 *    - AM pulsing at 4–8 Hz (driven by pixel column's average luminance gradient)
 *    - Formant sweeps: 3 bandpass filters whose center frequencies are driven
 *      by R, G, B channel averages of each column (mimics vocal formants)
 *    - Broadband noise component: driven by local pixel entropy (color variance)
 *    - No sub-bass (< 100 Hz) in the main carrier; only biofield carriers go low
 *
 * ── MODE 2: SPECTRAL SCAN ────────────────────────────────────────────────────
 *   X axis     → time   (each pixel column = one time slice)
 *   Y axis     → frequency bin (each pixel row = one exact frequency, log scale)
 *   Brightness → amplitude of that frequency bin at that moment
 *   Hue        → waveform shape (sine / triangle / sawtooth blend)
 *   Saturation → harmonic richness (adds 2nd and 3rd harmonics)
 *   Alpha      → gates the pixel (transparent pixels = silence)
 *   STEREO: left channel = top half of image, right channel = bottom half
 *
 * ── MODE 3: BIOFIELD OVERLAY ─────────────────────────────────────────────────
 *   Spectral base + user-selected biofield carriers.
 *   Each carrier amplitude = column luminance (pixel-driven, not fixed).
 *   Each carrier phase = column hue (color → phase domain).
 *   STEREO: image left half → left channel, right half → right channel.
 */

export type SonificationMode = "WAVE_GENETICS" | "SPECTRAL" | "BIOFIELD";

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

/** Speed of light in m/s */
const C = 299_792_458;

/** He-Ne laser wavelength in meters (632.8 nm) */
const HENE_LAMBDA = 632.8e-9;

/** Optical frequency of He-Ne laser in Hz */
const F_OPTICAL = C / HENE_LAMBDA; // ≈ 473.7e12 Hz

/** Gariaev documented radio output: ~600 kHz */
const F_RADIO = 600_000;

/** Number of octaves to shift F_OPTICAL down to audio base (~26.5 Hz) */
// 2^54 = 18,014,398,509,481,984 — F_OPTICAL / 2^54 ≈ 26.3 Hz
const OPTICAL_OCTAVE_SHIFT = 54;

/** Base audio frequency derived from He-Ne optical frequency via octave reduction */
const F_BASE_AUDIO = F_OPTICAL / Math.pow(2, OPTICAL_OCTAVE_SHIFT); // ≈ 26.3 Hz

/** Gariaev 40 Hz coherence carrier (gamma brain rhythm) */
const GARIAEV_GAMMA = 40;

/** Solfeggio carriers (R=UT, G=MI, B=SOL) */
const SOL_UT  = 396;
const SOL_MI  = 528;
const SOL_SOL = 741;

/** Gariaev AM pulsing rate range (Hz) — driven by pixel data */
const AM_MIN = 4;
const AM_MAX = 8;

/** Formant center frequencies for the three bandpass filters (Hz) */
const FORMANT_BASE = [700, 1200, 2500];

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

function rowToHz(row: number, totalRows: number): number {
  const t = 1 - row / Math.max(totalRows - 1, 1);
  const logMin = Math.log2(80);
  const logMax = Math.log2(8000);
  return Math.pow(2, logMin + t * (logMax - logMin));
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

/** Deterministic pseudo-noise from pixel color variance — no Math.random */
function pixelEntropy(r: number, g: number, b: number): number {
  const mean = (r + g + b) / 3;
  const variance = ((r - mean) ** 2 + (g - mean) ** 2 + (b - mean) ** 2) / 3;
  return Math.sqrt(variance) / 127.5; // 0–1
}

/** Bandpass filter (biquad) applied to a sample buffer — in-place */
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

// ─── ENGINE 1: GARIAEV WAVE GENETICS (correct physics) ───────────────────────
//
// Implements the full Gariaev signal chain:
// image pixels → spatial frequency analysis → WSRW downconversion →
// dual polarization stereo → Gariaev acoustic texture (AM pulsing + formants)
//
// Returns STEREO interleaved samples [L0, R0, L1, R1, ...]

function waveGenetics(
  pixels: PixelData[], width: number, height: number,
  totalSamples: number, sampleRate: number,
): Float32Array {
  const L = new Float32Array(totalSamples);
  const R = new Float32Array(totalSamples);
  const samplesPerCol = totalSamples / width;

  // Phase accumulators for the three Solfeggio carriers and gamma coherence
  let phUT = 0, phMI = 0, phSOL = 0, phGamma = 0;
  const dtUT    = SOL_UT    / sampleRate;
  const dtMI    = SOL_MI    / sampleRate;
  const dtSOL   = SOL_SOL   / sampleRate;
  const dtGamma = GARIAEV_GAMMA / sampleRate;

  // He-Ne base audio frequency phase accumulator
  let phBase = 0;
  const dtBase = F_BASE_AUDIO / sampleRate;

  for (let col = 0; col < width; col++) {
    const s0 = Math.floor(col * samplesPerCol);
    const s1 = Math.floor((col + 1) * samplesPerCol);
    const n  = s1 - s0;
    if (n <= 0) continue;

    // ── Collect per-column pixel statistics ────────────────────────────────
    let sumR = 0, sumG = 0, sumB = 0, sumLum = 0;
    let prevColLum = 0;
    let hGrad = 0, vGrad = 0; // horizontal and vertical luminance gradients
    let sumEntropy = 0;
    let count = 0;

    for (let row = 0; row < height; row++) {
      const px = pixels[row * width + col];
      if (!px || px.a < 4) continue;
      const l = lum(px);
      sumR += px.r; sumG += px.g; sumB += px.b;
      sumLum += l;

      // Horizontal gradient: compare to previous column
      if (col > 0) {
        const prevPx = pixels[row * width + (col - 1)];
        if (prevPx && prevPx.a >= 4) {
          hGrad += Math.abs(l - lum(prevPx));
        }
      }
      // Vertical gradient: compare to previous row
      if (row > 0) {
        const prevRow = pixels[(row - 1) * width + col];
        if (prevRow && prevRow.a >= 4) {
          vGrad += Math.abs(l - lum(prevRow));
        }
      }
      sumEntropy += pixelEntropy(px.r, px.g, px.b);
      count++;
    }

    if (count === 0) {
      phUT    = (phUT    + n * dtUT)    % 1;
      phMI    = (phMI    + n * dtMI)    % 1;
      phSOL   = (phSOL   + n * dtSOL)   % 1;
      phGamma = (phGamma + n * dtGamma) % 1;
      phBase  = (phBase  + n * dtBase)  % 1;
      continue;
    }

    const colLum     = sumLum / count;
    const colR       = sumR / count / 255;
    const colG       = sumG / count / 255;
    const colB       = sumB / count / 255;
    const colHGrad   = hGrad / count;  // 0–1, drives H-pol modulation
    const colVGrad   = vGrad / count;  // 0–1, drives V-pol modulation
    const colEntropy = sumEntropy / count; // 0–1, drives noise component

    // Polarization angle θ from H and V gradients → phase offset between channels
    const polAngle = Math.atan2(colVGrad + 1e-9, colHGrad + 1e-9); // 0–π/2
    const polPhaseOffset = polAngle / (Math.PI / 2); // 0–1

    // AM pulsing rate: driven by column luminance (brighter = faster pulse)
    // Range: AM_MIN to AM_MAX Hz
    const amRate = AM_MIN + colLum * (AM_MAX - AM_MIN);
    const dtAM   = amRate / sampleRate;
    let phAM     = col / width; // deterministic AM phase from column position

    // Spatial frequency → audio frequency mapping (WSRW downconversion model)
    // Local contrast (Laplacian approx) = (hGrad + vGrad) / 2
    // Maps to audio frequency: low contrast → near F_BASE_AUDIO, high contrast → up to 4000 Hz
    const localContrast = (colHGrad + colVGrad) / 2;
    const spatialAudioHz = F_BASE_AUDIO + localContrast * (4000 - F_BASE_AUDIO);

    // Formant center frequencies driven by R, G, B channels
    // F1 driven by R: 400–900 Hz
    // F2 driven by G: 900–2000 Hz
    // F3 driven by B: 2000–4000 Hz
    const f1 = 400  + colR * 500;
    const f2 = 900  + colG * 1100;
    const f3 = 2000 + colB * 2000;

    // ── Generate per-sample audio ──────────────────────────────────────────
    const colBuf = new Float32Array(n);

    for (let s = 0; s < n; s++) {
      const absS = s0 + s;

      // He-Ne base carrier (WSRW downconverted optical frequency)
      const basePhase = (phBase + s * dtBase) % 1;
      const baseSig   = Math.sin(2 * Math.PI * basePhase) * colLum * 0.15;

      // Solfeggio carriers (R→UT, G→MI, B→SOL) — Gariaev's RGB mapping
      const pUT  = (phUT  + s * dtUT)  % 1;
      const pMI  = (phMI  + s * dtMI)  % 1;
      const pSOL = (phSOL + s * dtSOL) % 1;

      // Gamma coherence carrier (40 Hz) — AM envelope
      const pGamma = (phGamma + s * dtGamma) % 1;
      const gammaEnv = 0.5 + 0.5 * Math.sin(2 * Math.PI * pGamma);

      // AM pulsing envelope (4–8 Hz, driven by column luminance)
      const amPhase = (phAM + s * dtAM) % 1;
      const amEnv   = 0.5 + 0.5 * Math.sin(2 * Math.PI * amPhase);

      // Spatial frequency carrier (WSRW model)
      const dtSpatial = spatialAudioHz / sampleRate;
      const spatialPhase = (col / width + s * dtSpatial) % 1;
      const spatialSig   = Math.sin(2 * Math.PI * spatialPhase);

      // Combined signal before formant filtering
      const raw =
        gammaEnv * amEnv * (
          colR * Math.sin(2 * Math.PI * pUT)  * 0.25 +
          colG * Math.sin(2 * Math.PI * pMI)  * 0.25 +
          colB * Math.sin(2 * Math.PI * pSOL) * 0.25 +
          spatialSig * localContrast * 0.20 +
          baseSig
        );

      colBuf[s] = raw;
    }

    // Apply three formant bandpass filters (Gariaev acoustic texture)
    const f1Buf = applyBandpass(colBuf, f1, 8, sampleRate);
    const f2Buf = applyBandpass(colBuf, f2, 7, sampleRate);
    const f3Buf = applyBandpass(colBuf, f3, 6, sampleRate);

    // Noise component driven by pixel entropy (color variance)
    // Deterministic noise: use a simple hash of (col, sample) position
    const noiseBuf = new Float32Array(n);
    for (let s = 0; s < n; s++) {
      // Deterministic hash noise — no Math.random
      const h = ((col * 1000003 + s * 999983) & 0x7FFFFFFF) / 0x7FFFFFFF;
      noiseBuf[s] = (h * 2 - 1) * colEntropy * 0.08;
    }

    // Mix formants + noise → final column signal
    for (let s = 0; s < n; s++) {
      const mixed =
        f1Buf[s] * 0.35 +
        f2Buf[s] * 0.35 +
        f3Buf[s] * 0.20 +
        noiseBuf[s];

      // H-pol → LEFT channel (horizontal gradient drives amplitude)
      L[s0 + s] += mixed * (0.5 + colHGrad * 0.5);

      // V-pol → RIGHT channel (vertical gradient drives amplitude)
      // Phase offset between channels = polarization angle
      const rPhase = (s / n + polPhaseOffset) % 1;
      const rMod   = 0.5 + 0.5 * Math.sin(2 * Math.PI * rPhase);
      R[s0 + s] += mixed * (0.5 + colVGrad * 0.5) * rMod;
    }

    // Advance phase accumulators
    phUT    = (phUT    + n * dtUT)    % 1;
    phMI    = (phMI    + n * dtMI)    % 1;
    phSOL   = (phSOL   + n * dtSOL)   % 1;
    phGamma = (phGamma + n * dtGamma) % 1;
    phBase  = (phBase  + n * dtBase)  % 1;
  }

  normalizeStereo(L, R);

  // Interleave L and R into a single stereo buffer
  const stereo = new Float32Array(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    stereo[i * 2]     = L[i];
    stereo[i * 2 + 1] = R[i];
  }
  return stereo;
}

// ─── ENGINE 2: SPECTRAL SCAN (stereo: top half = L, bottom half = R) ─────────

function spectral(
  pixels: PixelData[], width: number, height: number,
  totalSamples: number, sampleRate: number,
): Float32Array {
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

    // Top half → left channel
    for (let row = 0; row < midRow; row++) {
      const px = pixels[row * width + col];
      const hz = rowToHz(row, height);
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
      const hz  = rowToHz(row, height);
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

// ─── ENGINE 3: BIOFIELD OVERLAY (stereo: left half = L, right half = R) ──────

function biofield(
  pixels: PixelData[], width: number, height: number,
  totalSamples: number, sampleRate: number, carriers: number[],
): Float32Array {
  // Get the spectral base (stereo)
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

    const colLum = sumLum / count;
    const colHue = sumHue / (count * 360);
    const isLeft = col < midCol;

    for (let ci = 0; ci < carriers.length; ci++) {
      const hz = carriers[ci];
      const dt = hz / sampleRate;
      for (let s = s0; s < s1; s++) {
        const lt = s - s0;
        const ph = (phaseAcc[ci] + lt * dt + colHue) % 1;
        const sig = colLum * Math.sin(2 * Math.PI * ph) / carriers.length;
        if (isLeft) L[s] += sig;
        else        R[s] += sig;
      }
      phaseAcc[ci] = (phaseAcc[ci] + n * dt) % 1;
    }
  }

  // Mix base spectral + biofield overlay
  const stereo = new Float32Array(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    const baseL = base[i * 2];
    const baseR = base[i * 2 + 1];
    stereo[i * 2]     = baseL * 0.6 + L[i] * 0.4;
    stereo[i * 2 + 1] = baseR * 0.6 + R[i] * 0.4;
  }

  // Normalize the final stereo mix
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
    default:              return waveGenetics(pixels, width, height, totalSamples, sampleRate);
  }
}

// ─── WAV Encoding (stereo 16-bit PCM) ────────────────────────────────────────

export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  // Detect stereo: if samples.length is even and > sampleRate, treat as stereo interleaved
  const channels = 2;
  const numFrames = Math.floor(samples.length / channels);
  const dataSize  = numFrames * channels * 2; // 16-bit = 2 bytes per sample
  const buf = new ArrayBuffer(44 + dataSize);
  const v   = new DataView(buf);
  const ws  = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  ws(0, "RIFF"); v.setUint32(4, 36 + dataSize, true);
  ws(8, "WAVE"); ws(12, "fmt ");
  v.setUint32(16, 16, true);           // PCM chunk size
  v.setUint16(20, 1, true);            // PCM format
  v.setUint16(22, channels, true);     // stereo
  v.setUint32(24, sampleRate, true);   // sample rate
  v.setUint32(28, sampleRate * channels * 2, true); // byte rate
  v.setUint16(32, channels * 2, true); // block align
  v.setUint16(34, 16, true);           // bits per sample
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
  // For stereo, use only the left channel (even indices)
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
