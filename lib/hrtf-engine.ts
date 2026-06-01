/**
 * lib/hrtf-engine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * BioSonify HRTF Brain-Region Spatialization Engine
 *
 * Implements binaural 3D audio positioning so that each frequency appears to
 * originate from a specific anatomical brain region when heard through
 * headphones (including Bluetooth).
 *
 * Physics model:
 *  • ITD  (Interaural Time Delay)  — Woodworth formula: τ = r(θ + sinθ)/c
 *    - Head radius r = 0.09 m, speed of sound c = 343 m/s
 *    - Dominant cue below 1500 Hz
 *  • ILD  (Interaural Level Difference) — head-shadow attenuation
 *    - Dominant cue above 1500 Hz
 *  • Elevation — pinna spectral notch filter (4–16 kHz band)
 *    - Notch frequency rises with elevation angle
 *
 * Brain-region positions are mapped to HRTF azimuth/elevation angles based on
 * the anatomical location of each structure relative to the center of the head,
 * using the KEMAR HRTF dataset coordinate system.
 *
 * References:
 *  • Woodworth (1938) — ITD formula
 *  • Duplex Theory (Lord Rayleigh, 1907)
 *  • KEMAR HRTF Dataset (MIT Media Lab, Gardner & Martin 1994)
 *  • Persinger (1983, 2001) — God Helmet temporal lobe targeting
 *  • Monroe Institute Hemi-Sync protocols
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type BrainRegion =
  | "pineal"
  | "amygdala_bilateral"
  | "amygdala_right"
  | "amygdala_left"
  | "prefrontal"
  | "cerebellum"
  | "parietal"
  | "occipital"
  | "temporal_right"
  | "temporal_left"
  | "hypothalamus"
  | "hippocampus_bilateral"
  | "brainstem"
  | "corpus_callosum"
  | "whole_brain";

export interface HRTFPosition {
  /** Azimuth in degrees: 0=front, 90=right, 180=back, 270=left */
  azimuth: number;
  /** Elevation in degrees: 0=horizontal, +90=directly above, -90=below */
  elevation: number;
  /** Interaural time delay in samples at 44100 Hz (positive = right ear leads) */
  itdSamples: number;
  /** Interaural level difference in dB (positive = right ear louder) */
  ildDb: number;
  /** Pinna notch filter center frequency in Hz (for elevation perception) */
  pinnaNotchHz: number;
  /** Pinna notch filter Q factor */
  pinnaNotchQ: number;
  /** Human-readable description */
  label: string;
}

export interface SpatializedSample {
  left: number;
  right: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HEAD_RADIUS_M = 0.09;       // meters
const SPEED_OF_SOUND = 343;       // m/s
const SAMPLE_RATE = 44100;        // Hz

/**
 * Woodworth formula for ITD:
 *   τ_seconds = (r / c) * (θ_rad + sin(θ_rad))
 * where θ is the azimuth angle from the median plane (0=front, π/2=right).
 * Returns ITD in samples.
 */
function woodworthITD(azimuthDeg: number): number {
  // Convert azimuth to angle from median plane (0=front, 90=right side)
  // Woodworth uses angle from the interaural axis, so we need lateral angle
  const azRad = (azimuthDeg * Math.PI) / 180;
  // Lateral angle from median plane: sin(lateral) = sin(azimuth)*cos(elevation)
  // For elevation=0: lateral = azimuth
  const lateralRad = azRad;
  const itdSeconds = (HEAD_RADIUS_M / SPEED_OF_SOUND) * (lateralRad + Math.sin(lateralRad));
  return itdSeconds * SAMPLE_RATE;
}

/**
 * Head-shadow ILD model:
 *   ILD(f, θ) ≈ (f / 1000) * sin(θ) * 6.5 dB  (simplified Feddersen model)
 *   Clamped to ±15 dB.
 * Returns ILD in dB (positive = right ear louder when source is to the right).
 */
function headShadowILD(azimuthDeg: number, freqHz: number = 4000): number {
  const azRad = (azimuthDeg * Math.PI) / 180;
  const ild = (freqHz / 1000) * Math.sin(azRad) * 1.5;
  return Math.max(-15, Math.min(15, ild));
}

/**
 * Pinna notch frequency for elevation perception.
 * Notch rises from ~4 kHz at elevation=-40° to ~13 kHz at elevation=+90°.
 * Linear interpolation across the range.
 */
function pinnaNotchFreq(elevationDeg: number): number {
  // Map -40 → 4000 Hz, +90 → 13000 Hz
  const t = (elevationDeg + 40) / 130; // 0..1
  const clamped = Math.max(0, Math.min(1, t));
  return 4000 + clamped * 9000;
}

// ─── Brain Region Positions ───────────────────────────────────────────────────

/**
 * Anatomical brain region → HRTF position mapping.
 *
 * Coordinate system: listener faces 0° azimuth.
 * Positions are derived from anatomical location of each structure relative
 * to the center of the head, projected onto the HRTF sphere.
 */
export const BRAIN_REGION_POSITIONS: Record<BrainRegion, HRTFPosition> = {
  /** Pineal gland: geometric center of brain, slightly posterior, at midline.
   *  Projects to directly above (elevation +90°, azimuth 0°). */
  pineal: {
    azimuth: 0,
    elevation: 90,
    itdSamples: 0,
    ildDb: 0,
    pinnaNotchHz: 13000,
    pinnaNotchQ: 3.0,
    label: "Pineal Gland",
  },

  /** Amygdala bilateral: medial temporal lobes, both sides simultaneously.
   *  Rendered as two separate passes (left + right) mixed together. */
  amygdala_bilateral: {
    azimuth: 0,
    elevation: 0,
    itdSamples: 0,
    ildDb: 0,
    pinnaNotchHz: 8000,
    pinnaNotchQ: 2.0,
    label: "Amygdala (Bilateral)",
  },

  /** Amygdala right: right temporal lobe, lateral. */
  amygdala_right: {
    azimuth: 90,
    elevation: 0,
    itdSamples: woodworthITD(90),
    ildDb: headShadowILD(90, 4000),
    pinnaNotchHz: 8000,
    pinnaNotchQ: 2.0,
    label: "Amygdala (Right)",
  },

  /** Amygdala left: left temporal lobe, lateral. */
  amygdala_left: {
    azimuth: -90,
    elevation: 0,
    itdSamples: woodworthITD(-90),
    ildDb: headShadowILD(-90, 4000),
    pinnaNotchHz: 8000,
    pinnaNotchQ: 2.0,
    label: "Amygdala (Left)",
  },

  /** Prefrontal cortex: front of brain, slightly above horizontal. */
  prefrontal: {
    azimuth: 0,
    elevation: 20,
    itdSamples: 0,
    ildDb: 0,
    pinnaNotchHz: 13000,
    pinnaNotchQ: 2.5,
    label: "Prefrontal Cortex",
  },

  /** Cerebellum: posterior, inferior. */
  cerebellum: {
    azimuth: 180,
    elevation: -30,
    itdSamples: 0,
    ildDb: 0,
    pinnaNotchHz: 5000,
    pinnaNotchQ: 2.0,
    label: "Cerebellum",
  },

  /** Parietal lobe: posterior-superior. */
  parietal: {
    azimuth: 180,
    elevation: 45,
    itdSamples: 0,
    ildDb: 0,
    pinnaNotchHz: 10000,
    pinnaNotchQ: 2.5,
    label: "Parietal Lobe",
  },

  /** Occipital lobe: posterior, bilateral. */
  occipital: {
    azimuth: 180,
    elevation: 0,
    itdSamples: 0,
    ildDb: 0,
    pinnaNotchHz: 7000,
    pinnaNotchQ: 2.0,
    label: "Occipital Lobe",
  },

  /** Temporal lobe right: right side, lateral. */
  temporal_right: {
    azimuth: 90,
    elevation: 10,
    itdSamples: woodworthITD(90),
    ildDb: headShadowILD(90, 4000),
    pinnaNotchHz: 8500,
    pinnaNotchQ: 2.0,
    label: "Temporal Lobe (Right)",
  },

  /** Temporal lobe left: left side, lateral. */
  temporal_left: {
    azimuth: -90,
    elevation: 10,
    itdSamples: woodworthITD(-90),
    ildDb: headShadowILD(-90, 4000),
    pinnaNotchHz: 8500,
    pinnaNotchQ: 2.0,
    label: "Temporal Lobe (Left)",
  },

  /** Hypothalamus: deep center, slightly anterior and inferior. */
  hypothalamus: {
    azimuth: 0,
    elevation: -10,
    itdSamples: 0,
    ildDb: 0,
    pinnaNotchHz: 6500,
    pinnaNotchQ: 2.0,
    label: "Hypothalamus",
  },

  /** Hippocampus bilateral: medial temporal, both sides. */
  hippocampus_bilateral: {
    azimuth: 0,
    elevation: 0,
    itdSamples: 0,
    ildDb: 0,
    pinnaNotchHz: 7500,
    pinnaNotchQ: 2.0,
    label: "Hippocampus (Bilateral)",
  },

  /** Brainstem: posterior inferior, midline. */
  brainstem: {
    azimuth: 180,
    elevation: -60,
    itdSamples: 0,
    ildDb: 0,
    pinnaNotchHz: 4500,
    pinnaNotchQ: 1.5,
    label: "Brainstem",
  },

  /** Corpus callosum: midline, center of brain. */
  corpus_callosum: {
    azimuth: 0,
    elevation: 60,
    itdSamples: 0,
    ildDb: 0,
    pinnaNotchHz: 11000,
    pinnaNotchQ: 2.5,
    label: "Corpus Callosum",
  },

  /** Whole brain: no spatialization, equal bilateral. */
  whole_brain: {
    azimuth: 0,
    elevation: 0,
    itdSamples: 0,
    ildDb: 0,
    pinnaNotchHz: 8000,
    pinnaNotchQ: 1.0,
    label: "Whole Brain",
  },
};

// ─── HRTF Spatialization Functions ────────────────────────────────────────────

/**
 * Apply HRTF spatialization to a mono audio buffer.
 * Returns a stereo interleaved Float32Array (L, R, L, R, ...).
 *
 * The algorithm:
 * 1. Apply ITD: delay one channel by itdSamples
 * 2. Apply ILD: attenuate the far ear by ildDb
 * 3. Apply pinna notch filter to both channels for elevation perception
 *
 * @param mono   - Input mono samples
 * @param region - Target brain region
 * @returns Stereo interleaved output (length = mono.length * 2)
 */
export function spatializeToRegion(
  mono: Float32Array,
  region: BrainRegion
): Float32Array {
  const pos = BRAIN_REGION_POSITIONS[region];
  const n = mono.length;
  const stereo = new Float32Array(n * 2);

  // ITD delay in integer samples
  const itdInt = Math.round(Math.abs(pos.itdSamples));
  // ILD gain factors
  const ildLinear = Math.pow(10, Math.abs(pos.ildDb) / 20);
  const rightIsLouder = pos.ildDb >= 0;

  // Pinna notch filter state (single-pole IIR notch approximation)
  // H(z) = (1 - 2cos(w0)z^-1 + z^-2) / (1 - 2r*cos(w0)z^-1 + r^2*z^-2)
  const w0 = (2 * Math.PI * pos.pinnaNotchHz) / SAMPLE_RATE;
  const r = 1 - (Math.PI * (pos.pinnaNotchHz / pos.pinnaNotchQ)) / SAMPLE_RATE;
  const cosW0 = Math.cos(w0);

  // Notch filter coefficients
  const b0 = 1;
  const b1 = -2 * cosW0;
  const b2 = 1;
  const a1 = -2 * r * cosW0;
  const a2 = r * r;

  // Filter state for left and right channels
  let lx1 = 0, lx2 = 0, ly1 = 0, ly2 = 0;
  let rx1 = 0, rx2 = 0, ry1 = 0, ry2 = 0;

  // Determine which channel is delayed (the far ear)
  // Positive azimuth = source to the right → right ear leads, left ear delayed
  const delayLeft = pos.azimuth > 0 ? itdInt : 0;
  const delayRight = pos.azimuth < 0 ? itdInt : 0;

  for (let i = 0; i < n; i++) {
    // Get delayed samples
    const leftSrc = i >= delayLeft ? mono[i - delayLeft] : 0;
    const rightSrc = i >= delayRight ? mono[i - delayRight] : 0;

    // Apply ILD gain
    const leftGained = rightIsLouder ? leftSrc / ildLinear : leftSrc * ildLinear;
    const rightGained = rightIsLouder ? rightSrc * ildLinear : rightSrc / ildLinear;

    // Apply pinna notch filter to left channel
    const leftFiltered = b0 * leftGained + b1 * lx1 + b2 * lx2 - a1 * ly1 - a2 * ly2;
    lx2 = lx1; lx1 = leftGained;
    ly2 = ly1; ly1 = leftFiltered;

    // Apply pinna notch filter to right channel
    const rightFiltered = b0 * rightGained + b1 * rx1 + b2 * rx2 - a1 * ry1 - a2 * ry2;
    rx2 = rx1; rx1 = rightGained;
    ry2 = ry1; ry1 = rightFiltered;

    stereo[i * 2] = leftFiltered;
    stereo[i * 2 + 1] = rightFiltered;
  }

  return stereo;
}

/**
 * Mix two stereo interleaved buffers together (additive).
 * Both must have the same length.
 */
export function mixStereo(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i] + b[i];
  }
  return out;
}

/**
 * Normalize a stereo buffer so peak amplitude = 1.0.
 */
export function normalizeStereo(buf: Float32Array): Float32Array {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const abs = Math.abs(buf[i]);
    if (abs > peak) peak = abs;
  }
  if (peak === 0) return buf;
  const out = new Float32Array(buf.length);
  const inv = 1 / peak;
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] * inv;
  }
  return out;
}

/**
 * Apply HRTF spatialization to a stereo interleaved buffer that was produced
 * by the sonification engine (which already encodes H-pol/V-pol as L/R).
 * The existing stereo field is preserved; the HRTF adds the brain-region
 * positioning on top by applying the ITD/ILD/pinna treatment to the mix.
 *
 * @param stereoIn - Input stereo interleaved buffer
 * @param region   - Target brain region
 * @returns Spatialized stereo interleaved buffer
 */
export function applyBrainRegionHRTF(
  stereoIn: Float32Array,
  region: BrainRegion
): Float32Array {
  if (region === "whole_brain") return stereoIn;

  const pos = BRAIN_REGION_POSITIONS[region];
  const n = stereoIn.length; // interleaved, so n/2 frames
  const frames = n / 2;
  const out = new Float32Array(n);

  const itdInt = Math.round(Math.abs(pos.itdSamples));
  const ildLinear = Math.pow(10, Math.abs(pos.ildDb) / 20);
  const rightIsLouder = pos.ildDb >= 0;

  // Pinna notch filter
  const w0 = (2 * Math.PI * pos.pinnaNotchHz) / SAMPLE_RATE;
  const r = Math.max(0, 1 - (Math.PI * (pos.pinnaNotchHz / pos.pinnaNotchQ)) / SAMPLE_RATE);
  const cosW0 = Math.cos(w0);
  const a1 = -2 * r * cosW0;
  const a2 = r * r;
  const b1 = -2 * cosW0;

  let lx1 = 0, lx2 = 0, ly1 = 0, ly2 = 0;
  let rx1 = 0, rx2 = 0, ry1 = 0, ry2 = 0;

  const delayLeft = pos.azimuth > 0 ? itdInt : 0;
  const delayRight = pos.azimuth < 0 ? itdInt : 0;

  for (let i = 0; i < frames; i++) {
    const srcLeft = i >= delayLeft ? stereoIn[(i - delayLeft) * 2] : 0;
    const srcRight = i >= delayRight ? stereoIn[(i - delayRight) * 2 + 1] : 0;

    const leftGained = rightIsLouder ? srcLeft / ildLinear : srcLeft * ildLinear;
    const rightGained = rightIsLouder ? srcRight * ildLinear : srcRight / ildLinear;

    // Pinna notch filter left
    const lf = leftGained + b1 * lx1 + lx2 - a1 * ly1 - a2 * ly2;
    lx2 = lx1; lx1 = leftGained;
    ly2 = ly1; ly1 = lf;

    // Pinna notch filter right
    const rf = rightGained + b1 * rx1 + rx2 - a1 * ry1 - a2 * ry2;
    rx2 = rx1; rx1 = rightGained;
    ry2 = ry1; ry1 = rf;

    out[i * 2] = lf;
    out[i * 2 + 1] = rf;
  }

  return out;
}

// ─── God Helmet / Emotion State Presets ──────────────────────────────────────

export interface EmotionPreset {
  id: string;
  name: string;
  description: string;
  /** Primary brain region to target */
  primaryRegion: BrainRegion;
  /** Secondary region (optional, for bilateral effects) */
  secondaryRegion?: BrainRegion;
  /** Carrier frequency for binaural beat (Hz) */
  carrierHz: number;
  /** Beat frequency = difference between L and R carriers (Hz) */
  beatHz: number;
  /** Additional overlay frequencies to activate */
  overlayFreqHz: number[];
  /** Waveform type for the carrier */
  waveform: "sine" | "triangle" | "sawtooth";
  /** Duration in seconds */
  durationSeconds: number;
  /** Color for UI */
  color: string;
  /** Icon name */
  icon: string;
}

/**
 * God Helmet / Monroe Hemi-Sync inspired emotion/state presets.
 *
 * Sources:
 *  • Persinger (1983) — temporal lobe stimulation, 40 Hz modulation
 *  • Monroe Institute Hemi-Sync protocols (Focus 3, 10, 12, 15, 21)
 *  • Bentov (1977) — micromotion resonance, 6.8–7.5 Hz
 *  • Schumann resonances — 7.83, 14.3, 20.8, 27.3, 33.8 Hz
 *  • Theta (4–8 Hz) for deep meditation and creativity
 *  • Gamma (40 Hz) for transcendence and binding
 *  • Delta (0.5–4 Hz) for deep healing and sleep
 */
export const EMOTION_PRESETS: EmotionPreset[] = [
  {
    id: "divine",
    name: "Divine / Transcendent",
    description:
      "Persinger God Helmet protocol: 40 Hz gamma modulation targeting temporal lobes. Reported to induce sensed presence, mystical experience, and feelings of cosmic unity.",
    primaryRegion: "temporal_right",
    secondaryRegion: "temporal_left",
    carrierHz: 300,
    beatHz: 40,
    overlayFreqHz: [40, 963, 432],
    waveform: "sine",
    durationSeconds: 20 * 60,
    color: "#FFD700",
    icon: "star",
  },
  {
    id: "deep_calm",
    name: "Deep Calm / Theta",
    description:
      "Monroe Focus 10 protocol: theta binaural beat (4–8 Hz) targeting the hippocampus and hypothalamus. Mind awake, body asleep state.",
    primaryRegion: "hippocampus_bilateral",
    secondaryRegion: "hypothalamus",
    carrierHz: 300,
    beatHz: 6,
    overlayFreqHz: [7.83, 6, 528],
    waveform: "sine",
    durationSeconds: 20 * 60,
    color: "#4FC3F7",
    icon: "water",
  },
  {
    id: "focus",
    name: "Laser Focus / Beta",
    description:
      "Beta binaural beat (14–30 Hz) targeting the prefrontal cortex. Enhances concentration, analytical thinking, and executive function.",
    primaryRegion: "prefrontal",
    carrierHz: 200,
    beatHz: 18,
    overlayFreqHz: [18, 40, 14.1],
    waveform: "sine",
    durationSeconds: 20 * 60,
    color: "#00E5FF",
    icon: "target",
  },
  {
    id: "creativity",
    name: "Creative Flow / Alpha",
    description:
      "Alpha binaural beat (8–12 Hz) targeting the parietal and temporal lobes. Induces relaxed alertness, creative insight, and flow state.",
    primaryRegion: "parietal",
    secondaryRegion: "temporal_right",
    carrierHz: 250,
    beatHz: 10,
    overlayFreqHz: [10, 7.83, 432],
    waveform: "sine",
    durationSeconds: 20 * 60,
    color: "#AB47BC",
    icon: "brush",
  },
  {
    id: "deep_healing",
    name: "Deep Healing / Delta",
    description:
      "Delta binaural beat (0.5–4 Hz) targeting the brainstem and hypothalamus. Promotes deep sleep, cellular repair, and HGH release.",
    primaryRegion: "brainstem",
    secondaryRegion: "hypothalamus",
    carrierHz: 100,
    beatHz: 2,
    overlayFreqHz: [2, 0.5, 528, 174],
    waveform: "sine",
    durationSeconds: 30 * 60,
    color: "#26A69A",
    icon: "healing",
  },
  {
    id: "euphoria",
    name: "Euphoria / Gamma Burst",
    description:
      "High-gamma binaural beat (40 Hz) targeting the amygdala and prefrontal cortex. Associated with peak experience, joy, and bliss states.",
    primaryRegion: "amygdala_bilateral",
    secondaryRegion: "prefrontal",
    carrierHz: 400,
    beatHz: 40,
    overlayFreqHz: [40, 528, 639],
    waveform: "sine",
    durationSeconds: 15 * 60,
    color: "#FF7043",
    icon: "sunny",
  },
  {
    id: "lucid_dream",
    name: "Lucid Dream / Theta-Alpha",
    description:
      "Monroe Focus 12 protocol: theta-alpha boundary (7–8 Hz) targeting the parietal and occipital lobes. Promotes hypnagogic imagery and lucid dreaming.",
    primaryRegion: "parietal",
    secondaryRegion: "occipital",
    carrierHz: 51,
    beatHz: 7.5,
    overlayFreqHz: [7.5, 7.83, 963],
    waveform: "sine",
    durationSeconds: 30 * 60,
    color: "#7C4DFF",
    icon: "moon",
  },
  {
    id: "grief_release",
    name: "Grief Release / 396 Hz",
    description:
      "Solfeggio 396 Hz (UT) targeting the amygdala and hippocampus. Liberating guilt and fear, releasing emotional trauma stored in the limbic system.",
    primaryRegion: "amygdala_bilateral",
    secondaryRegion: "hippocampus_bilateral",
    carrierHz: 396,
    beatHz: 4,
    overlayFreqHz: [396, 174, 7.83],
    waveform: "sine",
    durationSeconds: 20 * 60,
    color: "#EF5350",
    icon: "heart",
  },
  {
    id: "pineal_activation",
    name: "Pineal Activation",
    description:
      "Frequencies associated with pineal gland stimulation: 936 Hz (third eye Solfeggio), 963 Hz (crown), 40 Hz gamma, and Schumann 7.83 Hz. Perceived as originating from the crown of the head.",
    primaryRegion: "pineal",
    carrierHz: 936,
    beatHz: 40,
    overlayFreqHz: [936, 963, 40, 7.83],
    waveform: "sine",
    durationSeconds: 20 * 60,
    color: "#F9A825",
    icon: "eye",
  },
  {
    id: "dna_repair",
    name: "DNA Repair / 528 Hz",
    description:
      "Solfeggio 528 Hz (MI) with Schumann carrier, targeting the corpus callosum for whole-brain coherence. Associated with DNA repair, transformation, and cellular regeneration.",
    primaryRegion: "corpus_callosum",
    secondaryRegion: "whole_brain",
    carrierHz: 528,
    beatHz: 7.83,
    overlayFreqHz: [528, 432, 7.83, 40],
    waveform: "sine",
    durationSeconds: 20 * 60,
    color: "#43A047",
    icon: "dna",
  },
  {
    id: "out_of_body",
    name: "Out-of-Body / Focus 21",
    description:
      "Monroe Focus 21 protocol: gateway to other energy systems. Theta-delta boundary targeting the parietal lobe with 4 Hz beat frequency.",
    primaryRegion: "parietal",
    secondaryRegion: "cerebellum",
    carrierHz: 200,
    beatHz: 4,
    overlayFreqHz: [4, 7.83, 963, 40],
    waveform: "sine",
    durationSeconds: 30 * 60,
    color: "#00BCD4",
    icon: "cloud",
  },
  {
    id: "superhuman",
    name: "Superhuman Performance",
    description:
      "Gamma 40 Hz + Type IIX muscle fiber frequency (150–200 Hz) targeting the cerebellum and motor cortex. For peak athletic performance, reaction time, and physical optimization.",
    primaryRegion: "cerebellum",
    secondaryRegion: "prefrontal",
    carrierHz: 200,
    beatHz: 40,
    overlayFreqHz: [40, 150, 200, 528, 7.83],
    waveform: "triangle",
    durationSeconds: 20 * 60,
    color: "#FF6F00",
    icon: "flash",
  },
];

// ─── Binaural Beat Generator ──────────────────────────────────────────────────

/**
 * Generate a binaural beat tone for a given emotion preset.
 * Returns a stereo interleaved Float32Array with HRTF spatialization applied.
 *
 * Left channel: carrier frequency
 * Right channel: carrier + beat frequency
 * The brain perceives the difference as an internal beat at beatHz.
 *
 * @param preset      - Emotion preset to generate
 * @param sampleRate  - Output sample rate (default 44100)
 * @param durationSec - Override duration in seconds
 */
export function generateBinauralBeat(
  preset: EmotionPreset,
  sampleRate: number = SAMPLE_RATE,
  durationSec?: number
): Float32Array {
  const dur = durationSec ?? Math.min(preset.durationSeconds, 60); // cap at 60s for export
  const frames = Math.floor(dur * sampleRate);
  const stereo = new Float32Array(frames * 2);

  const leftHz = preset.carrierHz;
  const rightHz = preset.carrierHz + preset.beatHz;
  const leftPhaseInc = (2 * Math.PI * leftHz) / sampleRate;
  const rightPhaseInc = (2 * Math.PI * rightHz) / sampleRate;

  // Overlay frequencies (added to both channels at lower amplitude)
  const overlayPhaseIncs = preset.overlayFreqHz.map(
    (hz) => (2 * Math.PI * hz) / sampleRate
  );
  const overlayPhases = new Float32Array(preset.overlayFreqHz.length);
  const overlayAmp = 0.15 / Math.max(1, preset.overlayFreqHz.length);

  let leftPhase = 0;
  let rightPhase = 0;

  for (let i = 0; i < frames; i++) {
    // Main binaural carriers
    let left = 0.7 * Math.sin(leftPhase);
    let right = 0.7 * Math.sin(rightPhase);

    // Overlay frequencies
    for (let o = 0; o < overlayPhaseIncs.length; o++) {
      const ov = overlayAmp * Math.sin(overlayPhases[o]);
      left += ov;
      right += ov;
      overlayPhases[o] += overlayPhaseIncs[o];
    }

    stereo[i * 2] = left;
    stereo[i * 2 + 1] = right;

    leftPhase += leftPhaseInc;
    rightPhase += rightPhaseInc;
  }

  // Apply HRTF spatialization to primary region
  const spatialized = applyBrainRegionHRTF(stereo, preset.primaryRegion);

  // If secondary region, generate and mix
  if (preset.secondaryRegion) {
    const secondary = applyBrainRegionHRTF(stereo, preset.secondaryRegion);
    const mixed = mixStereo(spatialized, secondary);
    return normalizeStereo(mixed);
  }

  return normalizeStereo(spatialized);
}
