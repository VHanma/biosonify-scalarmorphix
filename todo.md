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
