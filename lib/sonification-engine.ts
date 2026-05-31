/**
 * BioSonify Sonification Engine
 *
 * Three modes:
 *  1. SPECTRAL  — classical pixel→frequency mapping (brightness→pitch, hue→timbre, x→time)
 *  2. WAVE_GENETICS — Gariaev-inspired: luminance modulates 40 Hz carrier; RGB→Solfeggio (396/528/741 Hz)
 *  3. BIOFIELD  — Spectral base + additive synthesis of user-selected carrier tones
 *
 * All audio synthesis uses the Web Audio API (AudioContext) which is available on
 * both web and React Native via the `expo-audio` / native bridge.
 *
 * On React Native we use a pure JS oscillator approach writing PCM samples to
 * a Float32Array and playing via expo-audio's AudioPlayer with a data URI.
 */

export type SonificationMode = 'SPECTRAL' | 'WAVE_GENETICS' | 'BIOFIELD';

export interface SonificationOptions {
  mode: SonificationMode;
  durationSeconds: number;       // total playback time (1–30 s)
  carrierFrequencies: number[];  // extra carriers for BIOFIELD mode (Hz)
  sampleRate?: number;           // default 44100
}

export interface PixelData {
  r: number; // 0–255
  g: number; // 0–255
  b: number; // 0–255
  a: number; // 0–255
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map a value from [inMin, inMax] → [outMin, outMax] */
function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const clamped = Math.max(inMin, Math.min(inMax, value));
  return outMin + ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/** Convert RGB to HSL (h: 0–360, s: 0–1, l: 0–1) */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h * 360, s, l];
}

/** Simple sine oscillator sample */
function sine(t: number, freq: number, amp: number, phase = 0): number {
  return amp * Math.sin(2 * Math.PI * freq * t + phase);
}

/** Sawtooth oscillator */
function sawtooth(t: number, freq: number, amp: number): number {
  return amp * (2 * ((t * freq) % 1) - 1);
}

/** Triangle oscillator */
function triangle(t: number, freq: number, amp: number): number {
  const p = (t * freq) % 1;
  return amp * (p < 0.5 ? 4 * p - 1 : 3 - 4 * p);
}

// ─── PCM Buffer Generation ────────────────────────────────────────────────────

/**
 * Synthesize a Float32Array of mono PCM samples from image pixel data.
 *
 * @param pixels  Row-major array of pixel data [width × height]
 * @param width   Image width in pixels
 * @param height  Image height in pixels
 * @param opts    Sonification options
 * @returns       Float32Array of PCM samples (mono, normalized –1 to +1)
 */
export function synthesizeFromPixels(
  pixels: PixelData[],
  width: number,
  height: number,
  opts: SonificationOptions,
): Float32Array {
  const sampleRate = opts.sampleRate ?? 44100;
  const totalSamples = Math.floor(sampleRate * opts.durationSeconds);
  const output = new Float32Array(totalSamples);

  const samplesPerColumn = Math.floor(totalSamples / width);

  for (let col = 0; col < width; col++) {
    const tStart = col * samplesPerColumn;
    const tEnd = Math.min(tStart + samplesPerColumn, totalSamples);

    // Collect all pixels in this column
    const colPixels: PixelData[] = [];
    for (let row = 0; row < height; row++) {
      colPixels.push(pixels[row * width + col]);
    }

    for (let s = tStart; s < tEnd; s++) {
      const t = s / sampleRate;
      let sample = 0;

      switch (opts.mode) {
        case 'SPECTRAL':
          sample = spectralSample(t, colPixels, height);
          break;
        case 'WAVE_GENETICS':
          sample = waveGeneticsSample(t, colPixels, height);
          break;
        case 'BIOFIELD':
          sample = spectralSample(t, colPixels, height) * 0.6
            + biofieldCarriers(t, opts.carrierFrequencies) * 0.4;
          break;
      }

      output[s] += sample;
    }
  }

  // Normalize to prevent clipping
  let maxAmp = 0;
  for (let i = 0; i < output.length; i++) {
    if (Math.abs(output[i]) > maxAmp) maxAmp = Math.abs(output[i]);
  }
  if (maxAmp > 0) {
    for (let i = 0; i < output.length; i++) {
      output[i] = output[i] / maxAmp * 0.9;
    }
  }

  return output;
}

// ─── Engine 1: Spectral Scan ──────────────────────────────────────────────────

/**
 * For each pixel in the column, map:
 *   vertical position → frequency (200–4000 Hz, top=high, bottom=low)
 *   brightness        → amplitude
 *   hue               → timbre blend (sine/triangle/sawtooth)
 */
function spectralSample(t: number, colPixels: PixelData[], height: number): number {
  let sample = 0;
  const numPixels = colPixels.length;

  for (let row = 0; row < numPixels; row++) {
    const px = colPixels[row];
    const brightness = (px.r + px.g + px.b) / (3 * 255);
    if (brightness < 0.02) continue; // skip near-black pixels

    // Vertical position → frequency (top row = high freq)
    const freq = mapRange(row, 0, height - 1, 4000, 200);
    const amp = brightness * (0.8 / numPixels);

    const [hue] = rgbToHsl(px.r, px.g, px.b);

    // Hue determines timbre blend
    if (hue < 120) {
      // Red–green: sine dominant
      sample += sine(t, freq, amp) * 0.7 + triangle(t, freq, amp) * 0.3;
    } else if (hue < 240) {
      // Green–blue: triangle dominant
      sample += triangle(t, freq, amp) * 0.7 + sine(t, freq, amp) * 0.3;
    } else {
      // Blue–red: sawtooth dominant
      sample += sawtooth(t, freq, amp) * 0.5 + sine(t, freq, amp) * 0.5;
    }
  }

  return sample;
}

// ─── Engine 2: Wave Genetics ──────────────────────────────────────────────────

/**
 * Gariaev-inspired: treats the image as a biophoton emission map.
 *
 * - Luminance modulates a 40 Hz coherence carrier (gamma brainwave)
 * - R channel → 396 Hz Solfeggio (UT — liberation)
 * - G channel → 528 Hz Solfeggio (MI — DNA repair)
 * - B channel → 741 Hz Solfeggio (SOL — intuition)
 *
 * Each pixel's channel value is the AM depth for its carrier.
 */
function waveGeneticsSample(t: number, colPixels: PixelData[], height: number): number {
  let totalR = 0, totalG = 0, totalB = 0, totalLum = 0;
  const n = colPixels.length;

  for (const px of colPixels) {
    totalR += px.r / 255;
    totalG += px.g / 255;
    totalB += px.b / 255;
    totalLum += (0.299 * px.r + 0.587 * px.g + 0.114 * px.b) / 255;
  }

  const avgR = totalR / n;
  const avgG = totalG / n;
  const avgB = totalB / n;
  const avgLum = totalLum / n;

  // 40 Hz coherence carrier modulated by luminance
  const coherence = sine(t, 40, avgLum * 0.3);

  // Solfeggio carriers AM-modulated by color channels
  const ut  = sine(t, 396, avgR * 0.25);
  const mi  = sine(t, 528, avgG * 0.25);
  const sol = sine(t, 741, avgB * 0.25);

  return coherence + ut + mi + sol;
}

// ─── Engine 3: Biofield Carriers ─────────────────────────────────────────────

/**
 * Additive synthesis of user-selected carrier frequencies.
 * Each carrier is a pure sine at equal amplitude.
 */
function biofieldCarriers(t: number, frequencies: number[]): number {
  if (frequencies.length === 0) return 0;
  const amp = 0.5 / frequencies.length;
  return frequencies.reduce((sum, freq) => sum + sine(t, freq, amp), 0);
}

// ─── WAV Encoding ─────────────────────────────────────────────────────────────

/**
 * Encode a Float32Array of mono PCM samples into a WAV-format ArrayBuffer.
 * Standard 16-bit PCM WAV, mono, 44100 Hz.
 */
export function encodeWav(samples: Float32Array, sampleRate = 44100): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

/**
 * Convert ArrayBuffer to a base64 data URI suitable for expo-audio.
 */
export function arrayBufferToBase64DataUri(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:audio/wav;base64,${base64}`;
}

// ─── Image Pixel Extraction ───────────────────────────────────────────────────

/**
 * Downsample an image to a manageable grid for sonification.
 * Returns a flat array of PixelData in row-major order.
 *
 * On React Native, pass the image URI and use expo-image-manipulator
 * to resize before calling this function.
 *
 * This function works with a pre-decoded pixel array (from canvas or
 * a native image decoder).
 */
export function extractPixelGrid(
  rawPixels: Uint8ClampedArray | Uint8Array,
  srcWidth: number,
  srcHeight: number,
  targetWidth = 64,
  targetHeight = 32,
): { pixels: PixelData[]; width: number; height: number } {
  const pixels: PixelData[] = [];
  const scaleX = srcWidth / targetWidth;
  const scaleY = srcHeight / targetHeight;

  for (let row = 0; row < targetHeight; row++) {
    for (let col = 0; col < targetWidth; col++) {
      const srcRow = Math.floor(row * scaleY);
      const srcCol = Math.floor(col * scaleX);
      const idx = (srcRow * srcWidth + srcCol) * 4;
      pixels.push({
        r: rawPixels[idx],
        g: rawPixels[idx + 1],
        b: rawPixels[idx + 2],
        a: rawPixels[idx + 3],
      });
    }
  }

  return { pixels, width: targetWidth, height: targetHeight };
}

// ─── Waveform Visualization Data ─────────────────────────────────────────────

/**
 * Downsample a PCM buffer into N amplitude values for visualization.
 */
export function extractWaveformBars(samples: Float32Array, barCount = 60): number[] {
  const chunkSize = Math.floor(samples.length / barCount);
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    let maxAmp = 0;
    for (let j = 0; j < chunkSize; j++) {
      const v = Math.abs(samples[i * chunkSize + j] ?? 0);
      if (v > maxAmp) maxAmp = v;
    }
    bars.push(maxAmp);
  }
  return bars;
}
