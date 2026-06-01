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
