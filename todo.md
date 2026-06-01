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
- [ ] Analyze all 6 Gariaev matrix YouTube recordings for acoustic character
- [ ] Research exact He-Ne 632.8nm / 660nm / 950nm laser parameters and WSRW downconversion
- [ ] Build WSRW downconversion math model (optical freq → radio → audio)
- [ ] Implement dual orthogonal polarization modes (H and V channels → stereo)
- [ ] Implement spatial feature modulation from image scan (per-column polarization angle)
- [ ] Rebuild Wave Genetics engine with correct physics
- [ ] Add polarization-based stereo encoding (H-pol = left channel, V-pol = right channel)
- [ ] Verify deterministic output — same image always same sound

## THz / GHz / Ultrasonic Biofrequency Integration (v7 continued)
- [ ] Research THz window frequencies that affect DNA hydrogen bonding and protein folding
- [ ] Research GHz millimeter-wave frequencies affecting membrane permeability and cellular signaling
- [ ] Research therapeutic ultrasound frequencies (20kHz–3MHz) for mechanotransduction, bone repair, neurogenesis, BDNF
- [ ] Research infrasound and low-frequency acoustic bioeffects
- [ ] Add all new entries to FREQUENCY_LIBRARY with correct downconversion to audible equivalents
- [ ] Add THz, GHz, Ultrasonic categories to frequency library screen
