/**
 * Merkaba Engine - Implements Merkaba spin ratios and phase conjugation
 * Based on Voyagers Vol II: 34:21 natural ratio, 21:34 reversed
 * 
 * Merkaba Fields govern circulation and ratios of particle/anti-particle energy
 * Phase conjugation creates scalar standing waves for information embedding
 */

export interface MerkabField {
  topRatio: number; // Magnetic counter-clockwise (34 natural)
  bottomRatio: number; // Electrical clockwise (21 natural)
  spinAngle: number; // 45° between harmonic universes
  phaseConjugatePairs: PhaseConjugatePair[];
  coherenceLevel: number; // 0-1, strength of Merkaba field
}

export interface PhaseConjugatePair {
  carrier: number; // Primary frequency
  conjugate: number; // 180° phase-shifted twin
  amplitude: number; // Amplitude of the pair
  phase: number; // Phase offset (0-360°)
}

/**
 * Natural Merkaba ratio (34:21) - Golden ratio approximation
 * This is the ratio that allows full consciousness integration
 */
const NATURAL_MERKABA_RATIO = 34 / 21; // ≈ 1.619 (golden ratio)

/**
 * Reversed Merkaba ratio (21:34) - Blocks higher consciousness
 * Used by control systems to prevent DNA activation
 */
const REVERSED_MERKABA_RATIO = 21 / 34; // ≈ 0.618 (inverse golden ratio)

/**
 * Generate natural Merkaba field for a given base frequency
 * This creates the optimal field for consciousness integration
 */
export function generateNaturalMerkabField(baseFrequency: number): MerkabField {
  const phaseConjugatePairs: PhaseConjugatePair[] = [];
  
  // Generate 12 phase-conjugate pairs (one per Fire Letter)
  for (let i = 0; i < 12; i++) {
    const harmonic = i + 1;
    const carrier = baseFrequency * harmonic;
    
    // Conjugate is 180° out of phase
    const conjugate = -carrier; // Negative indicates 180° phase shift
    
    // Amplitude decreases with harmonic number (natural decay)
    const amplitude = 1 / harmonic;
    
    // Phase offset based on Merkaba ratio
    const phase = (i * NATURAL_MERKABA_RATIO * 30) % 360; // 30° increments
    
    phaseConjugatePairs.push({
      carrier,
      conjugate,
      amplitude,
      phase,
    });
  }
  
  return {
    topRatio: 34,
    bottomRatio: 21,
    spinAngle: 45, // 45° shift between harmonic universes
    phaseConjugatePairs,
    coherenceLevel: 1.0, // Maximum coherence for natural ratio
  };
}

/**
 * Generate reversed Merkaba field (control/blocking)
 * This is what prevents higher DNA strand activation
 */
export function generateReversedMerkabField(baseFrequency: number): MerkabField {
  const phaseConjugatePairs: PhaseConjugatePair[] = [];
  
  // Generate 12 phase-conjugate pairs with reversed ratio
  for (let i = 0; i < 12; i++) {
    const harmonic = i + 1;
    const carrier = baseFrequency * harmonic;
    const conjugate = -carrier;
    
    // Amplitude inverted (blocks energy flow)
    const amplitude = -1 / harmonic;
    
    // Phase offset based on reversed ratio
    const phase = (i * REVERSED_MERKABA_RATIO * 30) % 360;
    
    phaseConjugatePairs.push({
      carrier,
      conjugate,
      amplitude,
      phase,
    });
  }
  
  return {
    topRatio: 21,
    bottomRatio: 34,
    spinAngle: -45, // Reversed spin angle
    phaseConjugatePairs,
    coherenceLevel: 0.0, // No coherence for reversed ratio
  };
}

/**
 * Apply Merkaba field to audio samples
 * This encodes the phase conjugation into the waveform
 */
export function applyMerkabFieldToSamples(
  samples: Float32Array,
  sampleRate: number,
  merkabField: MerkabField,
  baseFrequency: number
): Float32Array {
  const output = new Float32Array(samples.length);
  
  for (let i = 0; i < samples.length; i++) {
    let sample = samples[i];
    const time = i / sampleRate;
    
    // Apply each phase-conjugate pair
    for (const pair of merkabField.phaseConjugatePairs) {
      // Primary carrier
      const carrierPhase = 2 * Math.PI * pair.carrier * time + (pair.phase * Math.PI / 180);
      const carrierWave = Math.sin(carrierPhase);
      
      // Conjugate (180° out of phase)
      const conjugatePhase = carrierPhase + Math.PI; // 180° shift
      const conjugateWave = Math.sin(conjugatePhase);
      
      // Mix carrier and conjugate at specified amplitude
      const mixed = (carrierWave * pair.amplitude + conjugateWave * pair.amplitude) / 2;
      
      // Apply to sample
      sample += mixed * 0.1; // Scale to prevent clipping
    }
    
    output[i] = Math.max(-1, Math.min(1, sample)); // Clamp to [-1, 1]
  }
  
  return output;
}

/**
 * Create scalar standing wave from phase-conjugate pairs
 * Scalar waves are the electromagnetic components canceling out,
 * leaving only the scalar (longitudinal) component
 */
export function createScalarStandingWave(
  samples: Float32Array,
  sampleRate: number,
  merkabField: MerkabField
): Float32Array {
  const output = new Float32Array(samples.length);
  
  for (let i = 0; i < samples.length; i++) {
    let scalarComponent = 0;
    const time = i / sampleRate;
    
    // For each phase-conjugate pair, the EM components cancel
    // leaving only the scalar (longitudinal) component
    for (const pair of merkabField.phaseConjugatePairs) {
      const carrierPhase = 2 * Math.PI * pair.carrier * time + (pair.phase * Math.PI / 180);
      
      // Scalar component: amplitude modulation of the carrier
      // This is the "information" part of the wave
      const scalarEnvelope = Math.cos(carrierPhase) * pair.amplitude;
      scalarComponent += scalarEnvelope;
    }
    
    // Normalize and apply to sample
    output[i] = samples[i] + scalarComponent * 0.2;
  }
  
  return output;
}

/**
 * Calculate Merkaba coherence
 * Measures how well the field is aligned with natural ratios
 */
export function calculateMerkabCoherence(
  topRatio: number,
  bottomRatio: number
): number {
  const naturalRatio = NATURAL_MERKABA_RATIO;
  const currentRatio = topRatio / bottomRatio;
  
  // Coherence is 1.0 when ratio matches natural (34:21)
  // Decreases as ratio deviates from natural
  const deviation = Math.abs(currentRatio - naturalRatio) / naturalRatio;
  const coherence = Math.max(0, 1 - deviation);
  
  return coherence;
}

/**
 * Rotate Merkaba field by spin angle
 * This is how consciousness moves between harmonic universes
 * Each universe requires a 45° rotation
 */
export function rotateMerkabField(
  merkabField: MerkabField,
  rotationAngle: number
): MerkabField {
  const rotatedPairs = merkabField.phaseConjugatePairs.map((pair) => ({
    ...pair,
    phase: (pair.phase + rotationAngle) % 360,
  }));
  
  return {
    ...merkabField,
    spinAngle: (merkabField.spinAngle + rotationAngle) % 360,
    phaseConjugatePairs: rotatedPairs,
  };
}

/**
 * Merge two Merkaba fields (for multi-dimensional synthesis)
 * This creates coherent interference patterns
 */
export function mergeMerkabFields(
  field1: MerkabField,
  field2: MerkabField,
  blendRatio: number = 0.5
): MerkabField {
  const mergedPairs: PhaseConjugatePair[] = [];
  
  // Blend pairs from both fields
  const maxPairs = Math.max(field1.phaseConjugatePairs.length, field2.phaseConjugatePairs.length);
  
  for (let i = 0; i < maxPairs; i++) {
    const pair1 = field1.phaseConjugatePairs[i % field1.phaseConjugatePairs.length];
    const pair2 = field2.phaseConjugatePairs[i % field2.phaseConjugatePairs.length];
    
    mergedPairs.push({
      carrier: pair1.carrier * blendRatio + pair2.carrier * (1 - blendRatio),
      conjugate: pair1.conjugate * blendRatio + pair2.conjugate * (1 - blendRatio),
      amplitude: pair1.amplitude * blendRatio + pair2.amplitude * (1 - blendRatio),
      phase: (pair1.phase * blendRatio + pair2.phase * (1 - blendRatio)) % 360,
    });
  }
  
  return {
    topRatio: field1.topRatio * blendRatio + field2.topRatio * (1 - blendRatio),
    bottomRatio: field1.bottomRatio * blendRatio + field2.bottomRatio * (1 - blendRatio),
    spinAngle: (field1.spinAngle * blendRatio + field2.spinAngle * (1 - blendRatio)) % 360,
    phaseConjugatePairs: mergedPairs,
    coherenceLevel: field1.coherenceLevel * blendRatio + field2.coherenceLevel * (1 - blendRatio),
  };
}

/**
 * Get Merkaba field information for display
 */
export function getMerkabFieldInfo(field: MerkabField): {
  ratio: string;
  coherence: number;
  spinAngle: number;
  pairCount: number;
  isNatural: boolean;
} {
  const coherence = calculateMerkabCoherence(field.topRatio, field.bottomRatio);
  const isNatural = Math.abs(field.topRatio - 34) < 0.1 && Math.abs(field.bottomRatio - 21) < 0.1;
  
  return {
    ratio: `${Math.round(field.topRatio)}:${Math.round(field.bottomRatio)}`,
    coherence: Math.round(coherence * 100) / 100,
    spinAngle: field.spinAngle,
    pairCount: field.phaseConjugatePairs.length,
    isNatural,
  };
}
