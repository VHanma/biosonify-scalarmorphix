#!/bin/bash
set -e

echo "🔨 BioSonify v13 APK Builder"
echo "================================"

# Check prerequisites
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

echo "✅ Prerequisites OK"
echo ""

# Install dependencies
echo "📥 Installing dependencies..."
pnpm install

# TypeScript check
echo "🔍 TypeScript check..."
pnpm check

# Run tests
echo "🧪 Running tests..."
pnpm test

echo ""
echo "✅ All checks passed!"
echo ""
echo "Choose build method:"
echo "1) Expo Cloud Build (recommended, no local Android SDK needed)"
echo "2) Local build (requires Android SDK)"
echo ""
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    echo ""
    echo "🌐 Building via Expo Cloud..."
    echo "This will upload your project to Expo and build it remotely."
    echo ""
    pnpm dlx eas-cli login || true
    pnpm dlx eas-cli build --platform android --wait
    echo ""
    echo "✅ APK ready! Check your Expo dashboard for download link."
    
elif [ "$choice" = "2" ]; then
    echo ""
    echo "🔨 Building locally..."
    
    if [ -z "$ANDROID_HOME" ]; then
        echo "❌ ANDROID_HOME not set"
        echo "Set it with: export ANDROID_HOME=/path/to/android/sdk"
        exit 1
    fi
    
    echo "📦 Generating native Android project..."
    pnpm dlx expo prebuild --platform android --clean
    
    echo "🏗️ Building APK with Gradle..."
    cd android
    ./gradlew assembleRelease
    cd ..
    
    APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
    if [ -f "$APK_PATH" ]; then
        echo ""
        echo "✅ APK built successfully!"
        echo "📍 Location: $APK_PATH"
        echo ""
        echo "To install on device:"
        echo "  adb install $APK_PATH"
    else
        echo "❌ APK build failed"
        exit 1
    fi
else
    echo "Invalid choice"
    exit 1
fi
