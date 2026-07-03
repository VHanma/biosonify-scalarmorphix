/**
 * Fire Letter Engine - Converts image data to 144 Fire Letter Sequences
 * Based on Voyagers Vol II scalar wave architecture
 * 
 * Fire Letters are fixed points of consolidated frequency.
 * 144 Fire Letters = 12 dimensions × 12 Fire Letters per dimension
 * Each Fire Letter encodes specific information from the image.
 */

export interface FireLetterSequence {
  dimension: number; // 1-12 (D-1 through D-12, D-15 handled separately)
  letters: number[]; // 12 Fire Letters per dimension, each 0-255
  frequency: number; // Base frequency for this dimension
  harmonics: number[]; // Harmonic overtones for this Fire Letter Sequence
}

export interface FireLetterPattern {
  sequences: FireLetterSequence[]; // 12 sequences (one per dimension)
  merkabRatio: { top: number; bottom: number }; // 34:21 natural or custom
  holographicFrequency: number; // Master frequency encoding the entire pattern
  coherence: number; // 0-1, strength of Fire Letter pattern
}

/**
 * Base frequencies for each dimensional band (Hz)
 * D-1 through D-12 mapped to audible frequency range
 */
const DIMENSIONAL_BASE_FREQUENCIES = [
  20,      // D-1: Base dimension
  40,      // D-2: Overtone of D-1
  80,      // D-3: Base tone HU-2
  160,     // D-4: Overtone of D-3
  320,     // D-5: Base tone HU-3
  640,     // D-6: Overtone of D-5
  1280,    // D-7: Base tone HU-4
  2560,    // D-8: Overtone of D-7
  5120,    // D-9: Base tone HU-5
  10240,   // D-10: Overtone of D-9
  20480,   // D-11: Base tone (ultrasonic)
  40960,   // D-12: Overtone (ultrasonic)
];

/**
 * Convert image pixel data to Fire Letter Sequence
 * Each pixel contributes to the Fire Letter pattern
 */
export function imageToFireLetters(pixels: Uint8ClampedArray, width: number, height: number): FireLetterPattern {
  const sequences: FireLetterSequence[] = [];
  
  // Process each dimensional band
  for (let dim = 0; dim < 12; dim++) {
    const letters = new Array(12).fill(0);
    
    // Divide image into 12 zones (one Fire Letter per zone)
    const zoneWidth = Math.ceil(width / 4);
    const zoneHeight = Math.ceil(height / 3);
    
    for (let letterIdx = 0; letterIdx < 12; letterIdx++) {
      const zoneX = (letterIdx % 4) * zoneWidth;
      const zoneY = Math.floor(letterIdx / 4) * zoneHeight;
      
      // Extract brightness from this zone
      let sum = 0;
      let count = 0;
      
      for (let y = zoneY; y < Math.min(zoneY + zoneHeight, height); y++) {
        for (let x = zoneX; x < Math.min(zoneX + zoneWidth, width); x++) {
          const idx = (y * width + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          const a = pixels[idx + 3];
          
          // Brightness weighted by alpha
          const brightness = ((r + g + b) / 3) * (a / 255);
          sum += brightness;
          count++;
        }
      }
      
      // Normalize to 0-255 and apply dimensional modulation
      const avgBrightness = count > 0 ? Math.round(sum / count) : 0;
      const dimensionalShift = (dim * 21) % 256; // Merkaba ratio 21 component
      letters[letterIdx] = (avgBrightness + dimensionalShift) % 256;
    }
    
    // Generate harmonics for this Fire Letter Sequence
    const baseFreq = DIMENSIONAL_BASE_FREQUENCIES[dim];
    const harmonics = generateHarmonics(baseFreq, letters);
    
    sequences.push({
      dimension: dim + 1,
      letters,
      frequency: baseFreq,
      harmonics,
    });
  }
  
  // Calculate holographic frequency (master encoding)
  const holographicFrequency = calculateHolographicFrequency(sequences);
  
  // Calculate coherence (how "pure" the Fire Letter pattern is)
  const coherence = calculateCoherence(sequences);
  
  return {
    sequences,
    merkabRatio: { top: 34, bottom: 21 }, // Natural Merkaba ratio
    holographicFrequency,
    coherence,
  };
}

/**
 * Generate harmonic overtones for a Fire Letter Sequence
 * Harmonics encode the information across multiple frequency bands
 */
function generateHarmonics(baseFreq: number, letters: number[]): number[] {
  const harmonics: number[] = [];
  
  // Generate 12 harmonics (one per Fire Letter)
  for (let i = 0; i < 12; i++) {
    // Harmonic ratio based on Fire Letter value
    const letterValue = letters[i];
    const harmonic = baseFreq * (1 + letterValue / 256); // Frequency shift by Fire Letter
    harmonics.push(harmonic);
  }
  
  return harmonics;
}

/**
 * Calculate holographic frequency
 * Master frequency that encodes the entire Fire Letter pattern
 * This is the frequency that, when played, activates all Fire Letters simultaneously
 */
function calculateHolographicFrequency(sequences: FireLetterSequence[]): number {
  // Holographic frequency is the geometric mean of all dimensional frequencies
  let product = 1;
  for (const seq of sequences) {
    product *= seq.frequency;
  }
  
  const holographicFreq = Math.pow(product, 1 / sequences.length);
  return holographicFreq;
}

/**
 * Calculate coherence of the Fire Letter pattern
 * Measures how "information-rich" the pattern is
 * 0 = uniform/empty, 1 = maximum information density
 */
function calculateCoherence(sequences: FireLetterSequence[]): number {
  let variance = 0;
  let count = 0;
  
  for (const seq of sequences) {
    for (const letter of seq.letters) {
      variance += Math.pow(letter - 127.5, 2);
      count++;
    }
  }
  
  const normalizedVariance = variance / (count * Math.pow(127.5, 2));
  return Math.min(1, normalizedVariance); // Clamp to 0-1
}

/**
 * Apply Merkaba ratio encoding to Fire Letters
 * This creates phase conjugation that allows information access
 */
export function applyMerkabRatioEncoding(
  pattern: FireLetterPattern,
  customRatio?: { top: number; bottom: number }
): FireLetterPattern {
  const ratio = customRatio || pattern.merkabRatio;
  const ratioFactor = ratio.top / ratio.bottom; // 34/21 = 1.619 (golden ratio)
  
  // Apply ratio to each Fire Letter
  const modifiedSequences = pattern.sequences.map((seq) => ({
    ...seq,
    letters: seq.letters.map((letter) => {
      // Modulate Fire Letter by Merkaba ratio
      const modulated = (letter * ratioFactor) % 256;
      return Math.round(modulated);
    }),
    harmonics: seq.harmonics.map((harmonic) => harmonic * ratioFactor),
  }));
  
  return {
    ...pattern,
    sequences: modifiedSequences,
    merkabRatio: ratio,
  };
}

/**
 * Generate phase-conjugate pair for scalar field embedding
 * Each Fire Letter gets a 180° phase-shifted twin
 */
export function generatePhaseConjugatePair(pattern: FireLetterPattern): {
  primary: FireLetterPattern;
  conjugate: FireLetterPattern;
} {
  const conjugate: FireLetterPattern = {
    ...pattern,
    sequences: pattern.sequences.map((seq) => ({
      ...seq,
      // Phase conjugate: invert the Fire Letters (180° phase shift)
      letters: seq.letters.map((letter) => 255 - letter),
      harmonics: seq.harmonics.map((harmonic) => {
        // Phase conjugate in frequency domain
        return harmonic * -1; // Negative frequency represents 180° phase shift
      }),
    })),
  };
  
  return { primary: pattern, conjugate };
}

/**
 * Extract Fire Letter information for display/debugging
 */
export function getFireLetterInfo(pattern: FireLetterPattern): {
  dimensionCount: number;
  totalLetters: number;
  holographicFrequency: number;
  coherence: number;
  merkabRatio: string;
  fireLetterSummary: string;
} {
  const totalLetters = pattern.sequences.reduce((sum, seq) => sum + seq.letters.length, 0);
  
  // Create a summary of Fire Letters (first 3 from each dimension)
  const summary = pattern.sequences
    .map((seq) => seq.letters.slice(0, 3).join(','))
    .join(' | ');
  
  return {
    dimensionCount: pattern.sequences.length,
    totalLetters,
    holographicFrequency: Math.round(pattern.holographicFrequency),
    coherence: Math.round(pattern.coherence * 100) / 100,
    merkabRatio: `${pattern.merkabRatio.top}:${pattern.merkabRatio.bottom}`,
    fireLetterSummary: summary,
  };
}
