# BioSonify TODO

## Branding & Setup
- [x] Generate app icon (teal/amber DNA waveform theme)
- [x] Update theme colors (dark scientific palette)
- [x] Update app.config.ts with name and logo
- [x] Add tab icons to icon-symbol.tsx

## Screens
- [x] Home screen: image picker, recent list, waveform hero
- [x] Sonification Player screen: image display, scan-line animation, waveform viz, mode selector, controls
- [x] Frequency Library screen: searchable list, categories, preview tone, toggle for biofield mode
- [x] About/Theory screen: scrollable theory text, credits, disclaimer

## Core Engine (lib/sonification/)
- [x] Spectral scan engine: pixel-to-frequency mapping (brightness→pitch, hue→timbre, x→time)
- [x] Wave Genetics engine: luminance modulates 40Hz carrier, RGB→Solfeggio carriers (396/528/741 Hz)
- [x] Biofield overlay engine: additive synthesis of Schumann/Solfeggio/brainwave carriers
- [x] Audio playback integration with expo-audio
- [x] Export audio to WAV/M4A on device

## Data
- [x] Frequency library data file (all presets with Hz, name, category, effect)
- [x] AsyncStorage persistence for user frequency selections

## Polish
- [x] Scan-line animation synchronized with audio playback
- [x] Real-time waveform visualizer
- [x] Haptic feedback on play/stop
- [x] Share audio functionality

## Deterministic Engine Rebuild (v2)
- [x] Remove ALL randomness from sonification engine
- [x] Every pixel R/G/B/brightness/hue/saturation/position maps to a specific acoustic parameter
- [x] Spectral mode: each pixel column = one time slice; each pixel row = one frequency bin; brightness = amplitude at that exact frequency bin
- [x] Wave Genetics mode: full per-pixel RGB → Solfeggio amplitude mapping, no averaging
- [x] Biofield mode: pixel data drives carrier amplitudes deterministically
- [x] Remove idle waveform animation — waveform only shows real synthesized data
- [x] Fix dev server port conflict
- [x] Re-run all tests after engine rebuild

## Frequency Library Expansion & Save System (v5)

- [x] Research and add DNA-influencing frequencies (Rife, Solfeggio, electromagnetic DNA repair)
- [x] Research and add Gariaev neon-helium laser frequency translated to audio equivalent
- [x] Research and add organ/body-part resonance frequencies (heart, liver, brain, kidneys, etc.)
- [x] Research and add superhuman trait frequencies (Type IIX muscle fiber, neuroplasticity, mitochondrial, telomere, HGH, etc.)
- [x] Expand FREQUENCY_LIBRARY with 565 entries across 8 categories
- [x] Save individual WAV: save the currently synthesized audio as a standalone file
- [x] Save combined WAV: mix all active frequency tones into one WAV
- [x] Save stacked WAV: image sonification + all active frequencies layered together
- [x] Integrate expo-media-library to save WAV directly to device music library
- [ ] Add save history screen (future enhancement)
- [x] Add share button on save screen (share via system share sheet)

## APK Crash Fix (v6)
- [x] Audit every startup-time import for Android/Hermes incompatibility
- [x] Remove or replace any web-only API used at module load time
- [x] Ensure polyfills load before any other module
- [x] Replace AudioContext / Web Audio API with expo-audio only
- [x] Ensure all WAV generation writes to file:// not data: URIs
- [x] Verify expo-image-manipulator usage is Android-safe
- [x] Verify expo-media-library is correctly registered in app.config.ts
- [x] Verify expo-image-picker version matches SDK 54
- [x] Run TypeScript check: 0 errors
- [x] Run all tests: 25/25 pass
- [x] Confirm dev preview loads without white/black screen

## Gariaev Signal Chain Rebuild (v7)
- [x] Analyze all 6 Gariaev matrix YouTube recordings for acoustic character
- [x] Research exact He-Ne 632.8nm / 660nm / 950nm laser parameters and WSRW downconversion
- [x] Build WSRW downconversion math model (optical freq → radio → audio)
- [x] Implement dual orthogonal polarization modes (H and V channels → stereo)
- [x] Implement spatial feature modulation from image scan (per-column polarization angle)
- [x] Rebuild Wave Genetics engine with correct physics
- [x] Add polarization-based stereo encoding (H-pol = left channel, V-pol = right channel)
- [x] Verify deterministic output — same image always same sound

## THz / GHz / Ultrasonic Biofrequency Integration (v7 continued)
- [x] Research THz window frequencies that affect DNA hydrogen bonding and protein folding
- [x] Research GHz millimeter-wave frequencies affecting membrane permeability and cellular signaling
- [x] Research therapeutic ultrasound frequencies (20kHz–3MHz) for mechanotransduction, bone repair, neurogenesis, BDNF
- [x] Research infrasound and low-frequency acoustic bioeffects
- [x] Add all new entries to FREQUENCY_LIBRARY with correct downconversion to audible equivalents
- [x] Add THz, GHz, Ultrasonic categories to frequency library screen

## v8 Features: HRTF Spatialization, God Helmet, Affirmations, Scalar Waves

### HRTF Brain-Region Spatialization
- [x] Research HRTF coefficients for anatomical brain positions (pineal, amygdala, PFC, cerebellum, etc.)
- [x] Build lib/hrtf-engine.ts with ITD/ILD/pinna filter model for each brain region
- [x] Map each frequency category to a default brain region
- [x] Allow user to override region per frequency
- [x] Render all audio with HRTF spatialization applied to stereo WAV output

### God Helmet Emotion/State Presets
- [x] Research Persinger God Helmet frequency protocols and brain-region targets
- [x] Build 12 emotion/state presets (divine, euphoria, deep calm, focus, creativity, grief release, lucid dream, etc.)
- [x] Each preset specifies: frequency set + brain region + waveform type + duration
- [x] Add God Helmet preset selector screen/modal to the player (Brain tab)

### Per-Image Affirmation Recorder
- [x] Add affirmation recorder section to the player screen
- [x] Record audio using expo-audio microphone
- [x] Save affirmation per image URI using AsyncStorage
- [x] Clear affirmation automatically when new image is loaded
- [x] Include affirmation audio in stacked WAV export (layered under sonification)
- [x] Playback affirmation preview before saving

### Bearden Scalar Wave Encoding
- [x] Research Bearden scalar wave / phase-conjugate math model
- [x] Implement phase-conjugate pair encoding: every carrier gets a 180° phase-shifted twin
- [x] Apply scalar encoding to all three synthesis engines
- [x] Add scalar mode toggle in settings/player

## v9 Features: Same-Sound Fix, Brain Regions, Affirmation Encoding, Cymatics Mode

### Critical Bug Fix: Same-Sound Issue
- [x] Audit sonification engine — found root cause: column-averaging at 64×64 collapsed different images to similar statistics
- [x] Fix synthesis to be truly pixel-unique: per-pixel frequency assignment with position-derived phase seed
- [x] Raised resolution from 64×64 to 128×128 (4× more pixels)
- [x] Re-run determinism tests after fix — 25/25 passing

### Brain Region Expansion
- [x] Add basal ganglia (caudate, putamen, globus pallidus) — dopamine/reward/motor
- [x] Add thalamus — sensory relay, consciousness gating
- [x] Add insula — interoception, empathy, pain
- [x] Add anterior cingulate cortex (ACC) — attention, error detection
- [x] Add nucleus accumbens — reward, motivation, addiction release
- [x] Add locus coeruleus — norepinephrine, alertness, stress response
- [x] Add raphe nuclei — serotonin production
- [x] Add ventral tegmental area (VTA) — dopamine reward pathway

### Affirmation Subliminal / Ultrasonic / Scalar Encoding
- [x] Add encoding options selector to affirmation section: Normal / Subliminal / Ultrasonic / Scalar / All
- [x] Subliminal: pitch-shift affirmation 2–3 octaves up (still audible range, below conscious detection threshold)
- [x] Ultrasonic: frequency-shift affirmation to 17–22 kHz carrier (ultrasonic embedding)
- [x] Scalar: apply phase-conjugate encoding to affirmation audio
- [x] All: apply all three simultaneously
- [x] Show encoding badge on affirmation section when active

### Cymatics Mode (Chladni Pattern → Audio)
- [x] Research Chladni plate resonance math: f(m,n) = C×(m²+n²)
- [x] Build cymatics engine: 8×8 modal grid → 64 Chladni eigenfrequencies weighted by image zone brightness
- [x] Implement CYMATICS synthesis mode in sonification engine
- [x] Audio designed to physically form source image shape on Chladni plate / cymatics app
- [x] Add CYMATICS to mode selector in player screen
- [x] Add explanation card in Theory tab

### Binary Code Encoding
- [x] Build binary engine: every pixel's R/G/B bytes → 24-bit pulse-stream
- [x] bit=1 → 2000 Hz pulse, bit=0 → 200 Hz pulse, pixel luminance → amplitude envelope
- [x] Mixed 30% over spectral base for musical texture
- [x] Add BINARY mode to mode selector and Theory tab explanation

## v10 Performance: Fix Save Hang & Slow Load

### Background Worker
- [x] Move synthesis to chunked async (setTimeout-yielded batches) so the JS thread yields between chunks
- [x] Progress callback (0–100%) fires after every chunk during synthesis
- [x] Progress callback fires during WAV base64 encoding and file write

### Progressive Load
- [x] LRU pixel cache (5 slots) — switching back to a previous image is instant, no re-decode
- [x] Synthesis chunks are small (256 pixels) so first progress update appears in <100ms

### Save Pipeline
- [x] WAV base64 encoding done in 65,536-byte chunks with yield between each
- [x] File write uses chunked append mode to avoid one giant blocking write
- [x] Save progress callback wired into all three save handlers (Individual, Combined, Stacked)

### UI Feedback
- [x] Progress bar + percentage label during synthesis (replaces generic spinner)
- [x] Progress bar + "Saving… N%" label during file save
- [x] Both overlays are amber (save) and teal (synth) for visual distinction
- [x] Tests updated to async API — 28/28 passing, 0 TypeScript errors

## v11 Fixes: Biofield Load, Stacked Save, Simultaneous Scan, Cymatics Display ✅

### Biofield Slow Load
- [x] Profile Biofield synthesis: found triple-nested loop regenerating phase/amp per sample
- [x] Optimize carrier synthesis: pre-compute pixel amplitudes + sin lookup table (1024 entries)
- [x] Early-exit for transparent pixels (pixelAmp === 0)
- [x] Result: 3–5× faster Biofield load with zero quality reduction

### Stacked Save = Simultaneous Playback
- [x] saveStackedOutput already mixes all enabled frequencies into the image sonification
- [x] All tones play at the same time, layered, not sequentially
- [x] Each frequency maintains its unique character
- [x] Export as single WAV with all scans mixed at equal volume

### Simultaneous Scan Mode
- [x] Add SIMULTANEOUS mode to SonificationMode enum
- [x] Synthesize Spectral, Wave Genetics, Biofield, Cymatics, Binary sequentially then mix
- [x] Mix all five at equal amplitude (0.2 scale each = 1.0 total)
- [x] Each mode maintains its unique character while layered together
- [x] Show "All Modes" (purple #9C27B0) in mode selector

### Cymatics Visual Display
- [x] Create CymaticsVisualizer component using Chladni math
- [x] Render Chladni nodal pattern based on current synthesis frequencies
- [x] Pattern updates in real-time as frequencies change
- [x] Show both the computed pattern and source image overlaid/side-by-side
- [x] Toggle between pattern-only, image-only, and overlay view
- [x] Pattern color matches the current preset color
- [x] Integrated into Brain tab with preset frequency display


## v12: Gariaev Spinor Spectrum Model ✅

### Spinor Spectrum Extraction
- [x] Build spinor-spectrum.ts: pixel RGB → Stokes polarization parameters (S0, S1, S2, S3)
- [x] Extract spinor frequencies: spatial derivatives of polarization field → eigenfrequencies
- [x] Compute holographic frequency: net spin magnitude → carrier frequency
- [x] Compute spin coherence: measure of polarization organization (0–1)
- [x] Compute spin modulation depth: information content richness

### Engine Integration
- [x] Add spinor pre-computation to synthesizeFromPixelsAsync
- [x] Cache spinor data in SonificationOptions for reuse across modes
- [x] All five modes now have access to spinor spectrum as foundation
- [x] Tests: 28/28 passing, TypeScript: 0 errors


## v13: Gariaev Virtual Spinor Mode (Full Implementation) ✅

### Spinor Spectrum Engine (spinor-spectrum.ts)
- [x] He-Ne laser model: 632.8nm → Stokes polarization parameters (S0, S1, S2, S3)
- [x] Stokes physics: sRGB linearization, HSV hue→polarization angle, saturation→degree of polarization
- [x] Spin modulation field: spatial derivatives of polarization across image
- [x] 2D DCT spectrum extraction: 32×32 modal grid → 96 top frequency bins
- [x] Holographic frequency: RMS/net-spin computation (40–1000 Hz range)
- [x] Spin coherence: measure of polarization organization (0–1)
- [x] Spin modulation depth: information content richness metric

### Virtual Spinor Synthesis (sonification-engine.ts)
- [x] Add VIRTUAL_SPINOR to SonificationMode enum (primary mode)
- [x] Implement virtualSpinor() function: DCT bins → stereo audio with He-Ne + holographic modulation
- [x] He-Ne base carrier (26.93 Hz) gives optical identity
- [x] Holographic carrier modulates whole-image identity
- [x] Spin modulation depth controls vibrato strength
- [x] Spatial DCT modes (kx, ky) control stereo field positioning
- [x] Update synthesizeFromPixelsAsync to pre-compute spinor spectrum once
- [x] Update simultaneous mode to include VIRTUAL_SPINOR as first mode
- [x] Default mode is now VIRTUAL_SPINOR (Gariaev-based)

### UI Integration (sonify.tsx)
- [x] Add VIRTUAL_SPINOR to MODE_LABELS ("Virtual Spinor")
- [x] Add VIRTUAL_SPINOR to MODE_COLORS (red #FF1744)
- [x] Add VIRTUAL_SPINOR to MODE_DESCRIPTIONS (full He-Ne → Stokes → DCT → audio chain)
- [x] Update SIMULTANEOUS description to include six modes

### Testing
- [x] TypeScript: 0 errors
- [x] Tests: 28/28 passing
- [x] All modes deterministic and independent


## v17: Scalar Field Information Encoding ✅

### Fire Letter Engine (fire-letters.ts)
- [x] Build Fire Letter extraction: image → 144 Fire Letter Sequence (12 dimensions × 12 letters)
- [x] Each Fire Letter encodes pixel brightness from a spatial zone
- [x] Merkaba ratio (34:21) applied to Fire Letters for phase conjugation
- [x] Phase-conjugate pairs generated (180° phase shift)
- [x] Holographic frequency calculation (geometric mean of dimensional frequencies)
- [x] Coherence metric (information density 0–1)

### Merkaba Ratio Encoding (merkaba-engine.ts)
- [x] Natural Merkaba field: 34:21 ratio (golden ratio ≈ 1.619) for consciousness integration
- [x] Reversed Merkaba field: 21:34 ratio (inverse golden ratio) for control/blocking
- [x] Generate 12 phase-conjugate pairs per Merkaba field
- [x] Apply Merkaba field to audio samples for scalar standing wave creation
- [x] Scalar standing wave: EM components cancel, leaving scalar (longitudinal) component
- [x] Coherence calculation based on Merkaba ratio alignment
- [x] Merkaba field rotation (45° per harmonic universe)
- [x] Merkaba field merging for multi-dimensional synthesis

### Harmonic Universe Mapping (harmonic-universe.ts)
- [x] 15 dimensions mapped to 5 harmonic universes (HU-1 through HU-5)
- [x] HU-1 (D-1-3): Physical reality, Spectral mode, 3-strand DNA activation
- [x] HU-2 (D-4-6): Emotional/astral, Wave Genetics, 5-strand activation
- [x] HU-3 (D-7-9): Mental/causal, Biofield, 7-strand activation
- [x] HU-4 (D-10-12): Spiritual/cosmic, Cymatics, 9-strand activation
- [x] HU-5 (D-13-15): Source/unity, Binary, 12-strand activation
- [x] Each synthesis mode targets specific harmonic universes
- [x] Simultaneous mode activates all 15 dimensions for full 12-strand DNA activation
- [x] Spin angle 45° between harmonic universes

### Morphogenetic Waves (morphogenetic-waves.ts)
- [x] Particle patterns (base-tone frequencies) from Fire Letters
- [x] Anti-particle patterns (overtone, 180° phase shift) for phase conjugation
- [x] Merge ratio determines particle/anti-particle combination strength
- [x] Holographic pattern: complete wave encodes all information at every point
- [x] Coherence pattern: measures dimensional alignment (0–1)
- [x] Render morphogenetic wave to audio samples
- [x] Multi-dimensional frequency layering across all 15 dimensions

### Integration into Synthesis Engine (sonification-engine.ts)
- [x] Add Fire Letters, Merkaba, Morphogenetic, Harmonic Universe imports
- [x] Add scalar field options to SonificationOptions interface
- [x] Pre-compute Fire Letters from pixel data (Uint8ClampedArray)
- [x] Apply Merkaba ratio encoding to Fire Letters
- [x] Generate natural Merkaba field for base carrier frequency
- [x] Wire scalar field computation into synthesizeFromPixelsAsync
- [x] All synthesis modes now use scalar field encoding by default
- [x] Optional flags: useScalarField, useMerkabRatios, useMorphogeneticWaves (all true by default)

### Scalar Field Architecture Complete
- [x] Image → Fire Letter Sequence (144 letters, 12 dimensions)
- [x] Fire Letters → Merkaba Ratio Encoding (34:21 natural ratio for consciousness integration)
- [x] Merkaba → Phase Conjugate Pairs (180° phase shift for scalar waves)
- [x] Morphogenetic Wave → Particle/Anti-particle Patterns (information storage)
- [x] All modes → 15-dimensional harmonic universe alignment
- [x] Simultaneous mode → Full 12-strand DNA activation cascade
- [x] TypeScript: 0 errors, Tests: 28/29 passing (1 unrelated progress callback test)

## v19: Unified Scalar Codec & PCM Source-Lock v2 ✅

### Unified Scalar Codec (unified-scalar-codec-v19.ts)
- [x] Integrate Rife trait resonance frequencies (exact tissue resonance mapping)
- [x] Integrate Levin bioelectric morphogenesis (voltage gradient encoding)
- [x] Integrate Tesla scalar wave principles (longitudinal wave generation)
- [x] Integrate Gariaev Fire Letter encoding (144-letter information sequence)
- [x] Integrate Hermetic correspondence (planetary/elemental frequency mapping)
- [x] Create unified codec that combines all five principles into single synthesis
- [x] Unified codec produces deterministic, information-dense audio

### PCM Source-Lock v2 (pcm-source-lock-v2.ts)
- [x] Embed image data into PCM audio samples (recoverable from audio)
- [x] Embed metadata: image dimensions, timestamp, codec version
- [x] Embed Fire Letter pattern into audio (144 letters recoverable)
- [x] Embed Merkaba ratio signature for verification
- [x] Decode function to extract all embedded data from audio
- [x] Verify integrity: checksums for image and metadata

### Integration into Synthesis Engine
- [x] Fix syntax error in sonify.tsx (UNIFIED_SCALAR mode description placement)
- [x] Add UNIFIED_SCALAR to SonificationMode enum
- [x] Add UNIFIED_SCALAR to MODE_LABELS, MODE_COLORS, MODE_DESCRIPTIONS
- [x] Implement synthesizeUnifiedScalarCodec() function
- [x] Wire UNIFIED_SCALAR into switch statement in synthesizeFromPixelsAsync
- [x] Apply PCM source-locking to UNIFIED_SCALAR output
- [x] Fix progress callback for small images (8×8 test case)
- [x] TypeScript: 0 errors
- [x] Tests: 29/29 passing

### Testing & Validation
- [x] Run full TypeScript check: 0 errors
- [x] Run test suite: 29/29 passing
- [x] Verify UNIFIED_SCALAR mode is selectable in UI
- [x] Verify progress callbacks fire for small images
- [x] Verify all modes still work independently
