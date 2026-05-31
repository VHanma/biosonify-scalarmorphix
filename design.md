# BioSonify — Mobile App Design Document

## Concept Summary

BioSonify converts any image into a multi-layered sound experience using three complementary sonification engines:

1. **Spectral Scan** — classical pixel-to-frequency mapping (brightness → pitch, color → timbre, x-position → time)
2. **Wave Genetics Mode** — inspired by Gariaev's HeNe laser DNA reading: image luminance is treated as a biophoton emission map, modulated into audio using coherent-wave principles
3. **Biofield Frequency Mode** — overlays biologically significant carrier frequencies (Schumann resonances, Solfeggio tones, brainwave entrainment beats) onto the sonified image stream

## Color Palette

| Token | Light | Dark | Rationale |
|---|---|---|---|
| `primary` | `#1A6B5A` | `#2ECC9A` | Deep teal — life, DNA helix, coherence |
| `background` | `#0D1117` | `#0D1117` | Near-black — scientific instrument feel |
| `surface` | `#161B22` | `#161B22` | Dark card surface |
| `foreground` | `#E6EDF3` | `#E6EDF3` | Soft white text |
| `muted` | `#7D8590` | `#7D8590` | Secondary labels |
| `accent` | `#F0A500` | `#F0A500` | Amber — frequency highlight, active state |
| `border` | `#30363D` | `#30363D` | Subtle separator |
| `success` | `#3FB950` | `#3FB950` | Coherence achieved |
| `error` | `#F85149` | `#F85149` | Incoherence / error |

## Screen List

### 1. Home / Image Picker (`/`)
- Hero title "BioSonify" with animated waveform
- Two primary actions: **Pick Image from Library** and **Take Photo**
- Recent sonifications list (last 5 images with waveform thumbnail)
- Bottom tab: Home, Frequencies, About

### 2. Sonification Player (`/sonify`)
- Full-screen image display with scan-line overlay animating left→right
- Waveform visualizer (real-time amplitude bars)
- Mode selector: Spectral | Wave Genetics | Biofield
- Play / Pause / Stop controls
- Frequency overlay panel (collapsible): shows active carrier frequencies
- Export audio button (saves WAV to device)
- Share button

### 3. Frequency Library (`/frequencies`)
- Searchable list of all built-in frequency presets
- Categories: Solfeggio, Schumann, Brainwave, Rife, DNA/Biofield
- Each entry: name, Hz value, theoretical effect, source attribution
- Tap to preview tone
- Toggle to include in Biofield mode overlay

### 4. About / Theory (`/about`)
- Scrollable theory document: explains all three engines
- Credits: Gariaev, Rife, Lakhovsky, Bentov, Monroe, Sheldrake
- Disclaimer section

## Key User Flows

### Primary Flow — Sonify an Image
1. User opens app → Home screen
2. Taps "Pick Image" → system image picker opens
3. Image selected → navigates to Sonification Player
4. Player auto-starts in Spectral mode
5. User can switch mode, adjust settings, play/pause
6. User taps Export → audio saved to device

### Secondary Flow — Biofield Overlay
1. On Player screen, user taps "Biofield" mode
2. Frequency overlay panel expands showing active carriers
3. User taps "Frequencies" tab to customize which carriers are active
4. Returns to Player — sound now includes carrier overlays

### Tertiary Flow — Frequency Library Preview
1. User taps Frequencies tab
2. Scrolls list, taps a frequency entry
3. Pure tone plays for 3 seconds
4. User toggles it ON for Biofield mode

## Sonification Engine Design

### Engine 1: Spectral Scan
- Image is scanned column by column (left → right = time)
- Each column's pixels are analyzed top → bottom
- Vertical position → frequency (top = high, bottom = low)
- Brightness → amplitude
- Hue → timbre (sine/triangle/sawtooth blend ratio)
- Frequency range: 200 Hz – 4000 Hz (audible, musical)
- Scan speed: configurable 1–30 seconds total duration

### Engine 2: Wave Genetics Mode
- Inspired by Gariaev HeNe 632.8 nm laser DNA reading
- Image luminance map treated as biophoton emission intensity
- Luminance values modulate a 40 Hz carrier (gamma brainwave / coherence frequency)
- Color channels (R, G, B) modulate three sub-carriers:
  - R → 396 Hz (Solfeggio UT — liberation from fear)
  - G → 528 Hz (Solfeggio MI — DNA repair / transformation)
  - B → 741 Hz (Solfeggio SOL — awakening intuition)
- Amplitude modulation depth proportional to pixel brightness
- Output: rich harmonic texture encoding the full image color field

### Engine 3: Biofield Frequency Mode
- Spectral scan base + additive synthesis of carrier tones
- Default carrier set:
  - 7.83 Hz (Schumann fundamental — Earth resonance)
  - 14.1 Hz (Schumann 2nd harmonic)
  - 40 Hz (Gamma / coherence)
  - 528 Hz (DNA repair Solfeggio)
  - 432 Hz (Natural tuning A)
  - 10 Hz (Alpha brainwave center)
- User can add/remove carriers from Frequency Library
- Each carrier is a pure sine tone mixed at low amplitude (-20 dB relative to image signal)

## Navigation Structure
```
(tabs)/
  index.tsx       ← Home / Image Picker
  frequencies.tsx ← Frequency Library
  about.tsx       ← Theory & Credits
app/
  sonify.tsx      ← Sonification Player (modal/stack)
```
