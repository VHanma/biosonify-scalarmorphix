# BioSonify v13 — APK Build Guide

## Prerequisites

- **Node.js** 18+ and **pnpm** 9+
- **Java** 11+ (OpenJDK or Oracle JDK)
- **Android SDK** (API level 24+, build tools 34+)
- **Android NDK** (optional, for native modules)

## Option 1: Build Locally (Recommended for Development)

### 1. Install Android SDK

**On macOS (Homebrew):**
```bash
brew install android-sdk
export ANDROID_HOME=/usr/local/share/android-sdk
```

**On Linux (Ubuntu/Debian):**
```bash
sudo apt-get install android-sdk
export ANDROID_HOME=/usr/lib/android-sdk
```

**On Windows:**
Download from https://developer.android.com/studio and install Android Studio, which includes the SDK.

### 2. Install Dependencies

```bash
cd /path/to/image_sonification_biofield_app
pnpm install
```

### 3. Generate Native Android Project

```bash
pnpm dlx expo prebuild --platform android --clean
```

This creates the `android/` directory with the native project structure.

### 4. Build APK

```bash
cd android
./gradlew assembleRelease
```

The APK will be generated at:
```
android/app/build/outputs/apk/release/app-release.apk
```

### 5. Install on Device or Emulator

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

Or use Android Studio's emulator to test.

---

## Option 2: Build via Expo Cloud (Easiest)

### 1. Create Expo Account

Go to https://expo.dev and create a free account.

### 2. Authenticate Locally

```bash
pnpm dlx eas-cli login
```

### 3. Configure EAS Build

```bash
pnpm dlx eas-cli build:configure --platform android
```

This creates `eas.json` in the project root.

### 4. Submit Build

```bash
pnpm dlx eas-cli build --platform android --wait
```

The build runs on Expo's servers. Once complete, you'll get a download link for the APK.

### 5. Download and Install

```bash
adb install ~/Downloads/BioSonify-v13.apk
```

---

## Option 3: GitHub Actions (CI/CD)

Create `.github/workflows/build.yml`:

```yaml
name: Build APK

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install -g pnpm
      - run: pnpm install
      - run: pnpm dlx eas-cli build --platform android --non-interactive
        env:
          EAS_TOKEN: ${{ secrets.EAS_TOKEN }}
```

---

## Troubleshooting

### "ANDROID_HOME not set"
```bash
export ANDROID_HOME=/path/to/android/sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

### "Gradle build failed"
```bash
cd android
./gradlew clean
./gradlew assembleRelease
```

### "Java version mismatch"
Ensure Java 11+ is installed:
```bash
java -version
```

### "Out of memory during build"
Increase Gradle heap:
```bash
export GRADLE_OPTS="-Xmx4g"
```

---

## Build Output

The final APK includes:
- ✅ All six sonification modes (Virtual Spinor, Wave Genetics, Spectral, Biofield, Cymatics, Binary)
- ✅ Gariaev spinor spectrum extraction (He-Ne laser model)
- ✅ HRTF brain-region spatialization (23 regions)
- ✅ Affirmation recorder with encoding options (subliminal/ultrasonic/scalar)
- ✅ Cymatics visualizer with real-time Chladni patterns
- ✅ God Helmet presets (12 emotion/state modes)
- ✅ Simultaneous scan mode (all modes mixed)
- ✅ Chunked async synthesis with progress bars
- ✅ LRU pixel cache for instant image switching
- ✅ Per-image frequency library and biofield carriers

---

## Release Checklist

- [ ] TypeScript check: `pnpm check` (0 errors)
- [ ] Tests pass: `pnpm test` (28/28)
- [ ] App name updated in `app.config.ts`
- [ ] App icon set in `assets/images/icon.png`
- [ ] Version bumped in `app.config.ts` and `package.json`
- [ ] Build tested on Android 12+ device
- [ ] All synthesis modes tested with sample images
- [ ] Affirmation recorder tested
- [ ] Stacked save tested
- [ ] Simultaneous mode tested

---

## Support

For issues, see:
- Expo docs: https://docs.expo.dev
- EAS Build docs: https://docs.expo.dev/build/introduction/
- React Native docs: https://reactnative.dev
