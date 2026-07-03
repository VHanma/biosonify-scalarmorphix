/**
 * Harmonic Universe Engine - Maps synthesis modes to 15-dimensional frequency bands
 * Based on Voyagers Vol II: 5 Harmonic Universes × 3 dimensions each = 15 total dimensions
 * 
 * HU-1: D-1, D-2, D-3 (our current reality)
 * HU-2: D-4, D-5, D-6
 * HU-3: D-7, D-8, D-9
 * HU-4: D-10, D-11, D-12
 * HU-5: D-13, D-14, D-15
 */

export interface DimensionBand {
  dimension: number; // 1-15
  harmonicUniverse: number; // 1-5
  isBandTone: boolean; // true = base tone, false = overtone
  baseFrequency: number; // Hz
  overtoneFrequency: number; // Hz
  merkabRatio: { top: number; bottom: number };
  spinAngle: number; // 45° increments between universes
}

export interface HarmonicUniverseMap {
  dimensions: DimensionBand[];
  synthesisModeMappings: SynthesisModeMapping[];
}

export interface SynthesisModeMapping {
  mode: string; // SPECTRAL, WAVE_GENETICS, BIOFIELD, CYMATICS, BINARY, VIRTUAL_SPINOR
  targetDimensions: number[]; // Which dimensions this mode activates
  frequencyRange: { min: number; max: number };
  merkabRatio: { top: number; bottom: number };
  dnaStrandActivation: number; // 1-12 strands activated
}

/**
 * Dimension frequency mapping
 * Each dimension has a base tone and overtone frequency
 */
const DIMENSION_FREQUENCIES: DimensionBand[] = [
  // Harmonic Universe 1 (D-1, D-2, D-3) - Physical reality
  {
    dimension: 1,
    harmonicUniverse: 1,
    isBandTone: true,
    baseFrequency: 20,
    overtoneFrequency: 40,
    merkabRatio: { top: 34, bottom: 21 },
    spinAngle: 0,
  },
  {
    dimension: 2,
    harmonicUniverse: 1,
    isBandTone: false,
    baseFrequency: 40,
    overtoneFrequency: 80,
    merkabRatio: { top: 34, bottom: 21 },
    spinAngle: 0,
  },
  {
    dimension: 3,
    harmonicUniverse: 1,
    isBandTone: true,
    baseFrequency: 80,
    overtoneFrequency: 160,
    merkabRatio: { top: 34, bottom: 21 },
    spinAngle: 0,
  },
  
  // Harmonic Universe 2 (D-4, D-5, D-6) - Emotional/astral
  {
    dimension: 4,
    harmonicUniverse: 2,
    isBandTone: false,
    baseFrequency: 160,
    overtoneFrequency: 320,
    merkabRatio: { top: 34, bottom: 21 },
    spinAngle: 45,
  },
  {
    dimension: 5,
    harmonicUniverse: 2,
    isBandTone: true,
    baseFrequency: 320,
    overtoneFrequency: 640,
    merkabRatio: { top: 34, bottom: 21 },
    spinAngle: 45,
  },
  {
    dimension: 6,
    harmonicUniverse: 2,
    isBandTone: false,
    baseFrequency: 640,
    overtoneFrequency: 1280,
    merkabRatio: { top: 34, bottom: 21 },
    spinAngle: 45,
  },
  
  // Harmonic Universe 3 (D-7, D-8, D-9) - Mental/causal
  {
    dimension: 7,
    harmonicUniverse: 3,
    isBandTone: true,
    baseFrequency: 1280,
    overtoneFrequency: 2560,
    merkabRatio: { top: 34, bottom: 21 },
    spinAngle: 90,
  },
  {
    dimension: 8,
    harmonicUniverse: 3,
    isBandTone: false,
    baseFrequency: 2560,
    overtoneFrequency: 5120,
    merkabRatio: { top: 34, bottom: 21 },
    spinAngle: 90,
  },
  {
    dimension: 9,
    harmonicUniverse: 3,
    isBandTone: true,
    baseFrequency: 5120,
    overtoneFrequency: 10240,
    merkabRatio: { top: 34, bottom: 21 },
    spinAngle: 90,
  },
  
  // Harmonic Universe 4 (D-10, D-11, D-12) - Spiritual/cosmic
  {
    dimension: 10,
    harmonicUniverse: 4,
    isBandTone: false,
    baseFrequency: 10240,
    overtoneFrequency: 20480,
    merkabRatio: { top: 34, bottom: 21 },
    spinAngle: 135,
  },
  {
    dimension: 11,
    harmonicUniverse: 4,
    isBandTone: true,
    baseFrequency: 20480,
    overtoneFrequency: 40960,
    merkabRatio: { top: 34, bottom: 21 },
    spinAngle: 135,
  },
  {
    dimension: 12,
    harmonicUniverse: 4,
    isBandTone: false,
    baseFrequency: 40960,
    overtoneFrequency: 81920,
    merkabRatio: { top: 34, bottom: 21 },
    spinAngle: 135,
  },
  
  // Harmonic Universe 5 (D-13, D-14, D-15) - Source/unity
  {
    dimension: 13,
    harmonicUniverse: 5,
    isBandTone: true,
    baseFrequency: 81920,
    overtoneFrequency: 163840,
    merkabRatio: { top: 34, bottom: 21 },
    spinAngle: 180,
  },
  {
    dimension: 14,
    harmonicUniverse: 5,
    isBandTone: false,
    baseFrequency: 163840,
    overtoneFrequency: 327680,
    merkabRatio: { top: 34, bottom: 21 },
    spinAngle: 180,
  },
  {
    dimension: 15,
    harmonicUniverse: 5,
    isBandTone: true,
    baseFrequency: 327680,
    overtoneFrequency: 655360,
    merkabRatio: { top: 34, bottom: 21 },
    spinAngle: 180,
  },
];

/**
 * Synthesis mode to harmonic universe mapping
 * Each mode activates specific dimensions and DNA strands
 */
const SYNTHESIS_MODE_MAPPINGS: SynthesisModeMapping[] = [
  {
    mode: 'SPECTRAL',
    targetDimensions: [1, 2, 3],
    frequencyRange: { min: 20, max: 160 },
    merkabRatio: { top: 34, bottom: 21 },
    dnaStrandActivation: 3, // Activates strands 1-3
  },
  {
    mode: 'WAVE_GENETICS',
    targetDimensions: [4, 5, 6],
    frequencyRange: { min: 160, max: 1280 },
    merkabRatio: { top: 34, bottom: 21 },
    dnaStrandActivation: 5, // Activates strands 3-5
  },
  {
    mode: 'BIOFIELD',
    targetDimensions: [7, 8, 9],
    frequencyRange: { min: 1280, max: 10240 },
    merkabRatio: { top: 34, bottom: 21 },
    dnaStrandActivation: 7, // Activates strands 5-7
  },
  {
    mode: 'CYMATICS',
    targetDimensions: [10, 11, 12],
    frequencyRange: { min: 10240, max: 81920 },
    merkabRatio: { top: 34, bottom: 21 },
    dnaStrandActivation: 9, // Activates strands 7-9
  },
  {
    mode: 'BINARY',
    targetDimensions: [13, 14, 15],
    frequencyRange: { min: 81920, max: 655360 },
    merkabRatio: { top: 34, bottom: 21 },
    dnaStrandActivation: 12, // Activates strands 9-12
  },
  {
    mode: 'VIRTUAL_SPINOR',
    targetDimensions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    frequencyRange: { min: 20, max: 655360 },
    merkabRatio: { top: 34, bottom: 21 },
    dnaStrandActivation: 12, // Activates all 12 strands
  },
  {
    mode: 'SIMULTANEOUS',
    targetDimensions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    frequencyRange: { min: 20, max: 655360 },
    merkabRatio: { top: 34, bottom: 21 },
    dnaStrandActivation: 12, // Full activation across all universes
  },
];

/**
 * Get the harmonic universe map
 */
export function getHarmonicUniverseMap(): HarmonicUniverseMap {
  return {
    dimensions: DIMENSION_FREQUENCIES,
    synthesisModeMappings: SYNTHESIS_MODE_MAPPINGS,
  };
}

/**
 * Get dimension band by dimension number
 */
export function getDimensionBand(dimension: number): DimensionBand | null {
  return DIMENSION_FREQUENCIES.find((d) => d.dimension === dimension) || null;
}

/**
 * Get all dimensions in a harmonic universe
 */
export function getHarmonicUniverseDimensions(hu: number): DimensionBand[] {
  return DIMENSION_FREQUENCIES.filter((d) => d.harmonicUniverse === hu);
}

/**
 * Get synthesis mode mapping
 */
export function getSynthesisModeMapping(mode: string): SynthesisModeMapping | null {
  return SYNTHESIS_MODE_MAPPINGS.find((m) => m.mode === mode) || null;
}

/**
 * Calculate frequency for a given dimension and harmonic
 */
export function calculateDimensionFrequency(dimension: number, harmonic: number = 1): number {
  const band = getDimensionBand(dimension);
  if (!band) return 0;
  
  const baseFreq = band.isBandTone ? band.baseFrequency : band.overtoneFrequency;
  return baseFreq * harmonic;
}

/**
 * Get all frequencies for a synthesis mode
 */
export function getSynthesisModeFrequencies(mode: string): number[] {
  const mapping = getSynthesisModeMapping(mode);
  if (!mapping) return [];
  
  const frequencies: number[] = [];
  
  for (const dim of mapping.targetDimensions) {
    const band = getDimensionBand(dim);
    if (band) {
      frequencies.push(band.baseFrequency);
      frequencies.push(band.overtoneFrequency);
    }
  }
  
  return frequencies;
}

/**
 * Get DNA strand activation level for a mode
 */
export function getDnaStrandActivation(mode: string): number {
  const mapping = getSynthesisModeMapping(mode);
  return mapping?.dnaStrandActivation || 0;
}

/**
 * Get harmonic universe description
 */
export function getHarmonicUniverseDescription(hu: number): string {
  const descriptions: { [key: number]: string } = {
    1: 'Physical Reality (D-1, D-2, D-3)',
    2: 'Emotional/Astral (D-4, D-5, D-6)',
    3: 'Mental/Causal (D-7, D-8, D-9)',
    4: 'Spiritual/Cosmic (D-10, D-11, D-12)',
    5: 'Source/Unity (D-13, D-14, D-15)',
  };
  
  return descriptions[hu] || 'Unknown';
}

/**
 * Get synthesis mode description with DNA activation
 */
export function getSynthesisModeDescription(mode: string): string {
  const mapping = getSynthesisModeMapping(mode);
  if (!mapping) return 'Unknown mode';
  
  const huRange = `HU-${mapping.targetDimensions[0] <= 3 ? 1 : Math.ceil(mapping.targetDimensions[0] / 3)}`;
  const dnaInfo = `activates ${mapping.dnaStrandActivation}-strand DNA`;
  
  return `${mode} - ${huRange} - ${dnaInfo}`;
}
