/**
 * Morphogenetic Wave Engine - Generates multi-dimensional frequency patterns
 * Based on Voyagers Vol II: Morphogenetic fields are tapestries of inter-woven energy particles
 * 
 * A morphogenetic wave projects particle and anti-particle patterns across dimensional bands
 * This creates the holographic information storage that encodes the image
 */

export interface MorphogeneticWave {
  baseFrequency: number;
  dimensions: MorphogeneticDimension[];
  holographicPattern: number[]; // Complete wave pattern
  coherencePattern: number[]; // Coherence across dimensions
}

export interface MorphogeneticDimension {
  dimension: number; // 1-15
  particlePattern: number[]; // Base-tone particles
  antiParticlePattern: number[]; // Overtone particles (anti-particles)
  mergeRatio: number; // How much particles merge with anti-particles
  phaseOffset: number; // Phase relationship between dimensions
}

/**
 * Generate morphogenetic wave from Fire Letter pattern
 * Each Fire Letter becomes a particle/anti-particle pair
 */
export function generateMorphogeneticWave(
  fireLetters: number[],
  baseFrequency: number,
  dimensions: number[] // Which dimensions to include
): MorphogeneticWave {
  const morphoDimensions: MorphogeneticDimension[] = [];
  
  for (let i = 0; i < dimensions.length; i++) {
    const dim = dimensions[i];
    const fireLetterIndex = i % fireLetters.length;
    const fireLetterValue = fireLetters[fireLetterIndex];
    
    // Generate particle pattern (base-tone)
    const particlePattern = generateParticlePattern(fireLetterValue, baseFrequency, dim);
    
    // Generate anti-particle pattern (overtone, 180° phase shift)
    const antiParticlePattern = generateAntiParticlePattern(fireLetterValue, baseFrequency, dim);
    
    // Merge ratio determines how much particles and anti-particles combine
    // This is the "morphogenetic wave" - where they merge across dimensional bands
    const mergeRatio = calculateMergeRatio(dim, dimensions.length);
    
    // Phase offset between dimensions (45° per harmonic universe)
    const phaseOffset = (Math.floor((dim - 1) / 3) * 45) % 360;
    
    morphoDimensions.push({
      dimension: dim,
      particlePattern,
      antiParticlePattern,
      mergeRatio,
      phaseOffset,
    });
  }
  
  // Generate holographic pattern (complete wave across all dimensions)
  const holographicPattern = generateHolographicPattern(morphoDimensions, baseFrequency);
  
  // Generate coherence pattern (how well dimensions are aligned)
  const coherencePattern = generateCoherencePattern(morphoDimensions);
  
  return {
    baseFrequency,
    dimensions: morphoDimensions,
    holographicPattern,
    coherencePattern,
  };
}

/**
 * Generate particle pattern for a dimension
 * Particles are base-tone frequencies
 */
function generateParticlePattern(fireLetterValue: number, baseFrequency: number, dimension: number): number[] {
  const pattern: number[] = [];
  const frequency = baseFrequency * (1 + (dimension - 1) * 0.5); // Frequency increases per dimension
  
  // Generate 12 samples (one per Fire Letter)
  for (let i = 0; i < 12; i++) {
    // Particle amplitude modulated by Fire Letter value
    const amplitude = fireLetterValue / 255;
    
    // Frequency modulated by position
    const freq = frequency * (1 + (i / 12) * 0.1);
    
    // Phase based on dimension
    const phase = (dimension * 30 * Math.PI / 180) + (i * Math.PI / 6);
    
    // Particle wave
    const wave = amplitude * Math.sin(phase);
    pattern.push(wave);
  }
  
  return pattern;
}

/**
 * Generate anti-particle pattern (180° phase shift)
 * Anti-particles are overtone frequencies
 */
function generateAntiParticlePattern(fireLetterValue: number, baseFrequency: number, dimension: number): number[] {
  const pattern: number[] = [];
  const frequency = baseFrequency * (1 + (dimension - 1) * 0.5) * 2; // 2× frequency (overtone)
  
  for (let i = 0; i < 12; i++) {
    const amplitude = fireLetterValue / 255;
    const freq = frequency * (1 + (i / 12) * 0.1);
    
    // 180° phase shift (π radians)
    const phase = (dimension * 30 * Math.PI / 180) + (i * Math.PI / 6) + Math.PI;
    
    // Anti-particle wave (inverted)
    const wave = -amplitude * Math.sin(phase);
    pattern.push(wave);
  }
  
  return pattern;
}

/**
 * Calculate merge ratio for morphogenetic wave
 * This determines how much particles merge with anti-particles
 * Higher merge ratio = stronger morphogenetic wave
 */
function calculateMergeRatio(dimension: number, totalDimensions: number): number {
  // Merge ratio increases as we go through dimensions
  // This creates a cascading morphogenetic wave
  const ratio = dimension / totalDimensions;
  
  // Apply sigmoid curve for smoother transition
  return 1 / (1 + Math.exp(-10 * (ratio - 0.5)));
}

/**
 * Generate holographic pattern
 * This is the complete wave that encodes all information holographically
 * Every point in the pattern contains the complete image information
 */
function generateHolographicPattern(dimensions: MorphogeneticDimension[], baseFrequency: number): number[] {
  const pattern: number[] = [];
  const sampleCount = 1024; // Holographic pattern resolution
  
  for (let i = 0; i < sampleCount; i++) {
    let sample = 0;
    
    // Combine all dimensional patterns
    for (const dim of dimensions) {
      const particleContribution = dim.particlePattern[i % dim.particlePattern.length];
      const antiParticleContribution = dim.antiParticlePattern[i % dim.antiParticlePattern.length];
      
      // Merge particles and anti-particles
      const merged = (particleContribution + antiParticleContribution) * dim.mergeRatio;
      
      // Apply phase offset
      const phaseShift = Math.cos((dim.phaseOffset * Math.PI / 180) + (i * Math.PI / sampleCount));
      sample += merged * phaseShift;
    }
    
    // Normalize
    pattern.push(sample / dimensions.length);
  }
  
  return pattern;
}

/**
 * Generate coherence pattern
 * Measures how well dimensions are aligned
 */
function generateCoherencePattern(dimensions: MorphogeneticDimension[]): number[] {
  const pattern: number[] = [];
  
  for (let i = 0; i < dimensions.length; i++) {
    const dim = dimensions[i];
    
    // Coherence based on merge ratio and phase alignment
    let coherence = dim.mergeRatio;
    
    // Check alignment with adjacent dimensions
    if (i > 0) {
      const prevDim = dimensions[i - 1];
      const phaseDiff = Math.abs(dim.phaseOffset - prevDim.phaseOffset);
      const alignment = 1 - (phaseDiff / 360);
      coherence *= alignment;
    }
    
    pattern.push(coherence);
  }
  
  return pattern;
}

/**
 * Render morphogenetic wave to audio samples
 * This converts the wave pattern into actual audio
 */
export function renderMorphogeneticWaveToAudio(
  wave: MorphogeneticWave,
  sampleRate: number,
  durationSeconds: number
): Float32Array {
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const output = new Float32Array(totalSamples);
  
  for (let i = 0; i < totalSamples; i++) {
    const time = i / sampleRate;
    let sample = 0;
    
    // Render each dimensional component
    for (const dim of wave.dimensions) {
      // Base frequency for this dimension
      const freq = wave.baseFrequency * (1 + (dim.dimension - 1) * 0.5);
      
      // Phase including dimension offset
      const phase = 2 * Math.PI * freq * time + (dim.phaseOffset * Math.PI / 180);
      
      // Particle contribution
      const particleWave = Math.sin(phase);
      
      // Anti-particle contribution (180° out of phase)
      const antiParticleWave = Math.sin(phase + Math.PI);
      
      // Merge with coherence weighting
      const coherence = wave.coherencePattern[dim.dimension - 1] || 0.5;
      const merged = (particleWave * dim.mergeRatio + antiParticleWave * (1 - dim.mergeRatio)) * coherence;
      
      sample += merged;
    }
    
    // Normalize and apply holographic pattern modulation
    const holographicModulation = wave.holographicPattern[i % wave.holographicPattern.length];
    sample = (sample / wave.dimensions.length) * (1 + holographicModulation * 0.5);
    
    // Clamp to [-1, 1]
    output[i] = Math.max(-1, Math.min(1, sample));
  }
  
  return output;
}

/**
 * Get morphogenetic wave information
 */
export function getMorphogeneticWaveInfo(wave: MorphogeneticWave): {
  dimensionCount: number;
  baseFrequency: number;
  averageCoherence: number;
  holographicPatternSize: number;
  isComplete: boolean;
} {
  const avgCoherence = wave.coherencePattern.reduce((a, b) => a + b, 0) / wave.coherencePattern.length;
  const isComplete = wave.dimensions.length === 15; // Full 15-dimensional wave
  
  return {
    dimensionCount: wave.dimensions.length,
    baseFrequency: Math.round(wave.baseFrequency),
    averageCoherence: Math.round(avgCoherence * 100) / 100,
    holographicPatternSize: wave.holographicPattern.length,
    isComplete,
  };
}
