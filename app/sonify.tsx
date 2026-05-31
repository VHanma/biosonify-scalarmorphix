import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useSonification } from "@/lib/sonification-store";
import { useImagePixels } from "@/lib/use-image-pixels";
import {
  synthesizeFromPixels,
  encodeWav,
  arrayBufferToBase64DataUri,
  extractWaveformBars,
  type SonificationMode,
} from "@/lib/sonification-engine";

const { width: SCREEN_W } = Dimensions.get("window");
const BAR_COUNT = 50;

const MODE_LABELS: Record<SonificationMode, string> = {
  SPECTRAL: "Spectral",
  WAVE_GENETICS: "Wave Genetics",
  BIOFIELD: "Biofield",
};

const MODE_COLORS: Record<SonificationMode, string> = {
  SPECTRAL: "#2ECC9A",
  WAVE_GENETICS: "#F0A500",
  BIOFIELD: "#4A9EFF",
};

const MODE_DESCRIPTIONS: Record<SonificationMode, string> = {
  SPECTRAL:
    "Every pixel: brightness → pitch · hue → timbre · saturation → harmonics · position → time",
  WAVE_GENETICS:
    "Every pixel: R→396 Hz · G→528 Hz · B→741 Hz · luminance→40 Hz coherence · X→phase · Y→detune",
  BIOFIELD:
    "Full spectral scan + pixel-driven biofield carriers (amplitude & phase from image data)",
};

export default function SonifyScreen() {
  const router = useRouter();
  const { state, dispatch, getEnabledHz } = useSonification();
  const { extractPixels, isExtracting } = useImagePixels();
  const [scanPos] = useState(new Animated.Value(0));
  const scanAnim = useRef<Animated.CompositeAnimation | null>(null);
  const player = useAudioPlayer(null);

  // Waveform bar animated values — only updated from real synthesis data
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0))
  ).current;

  // Update bar heights when real waveform data arrives
  useEffect(() => {
    if (state.waveformBars.length > 0) {
      state.waveformBars.forEach((val, i) => {
        if (i < barAnims.length) {
          Animated.timing(barAnims[i], {
            toValue: val,
            duration: 300,
            useNativeDriver: false,
          }).start();
        }
      });
    } else {
      // No data yet — show flat line (all zeros), not random noise
      barAnims.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start();
      });
    }
  }, [state.waveformBars]);

  // Setup audio mode
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => {
      player.release();
    };
  }, []);

  const synthesize = useCallback(async () => {
    if (!state.imageUri) return;
    dispatch({ type: "SET_PROCESSING", processing: true });

    try {
      const { pixels, width, height } = await extractPixels(state.imageUri);
      const enabledHz = getEnabledHz();

      const samples = synthesizeFromPixels(pixels, width, height, {
        mode: state.mode,
        durationSeconds: state.durationSeconds,
        carrierFrequencies: enabledHz,
        sampleRate: 44100,
      });

      const wavBuffer = encodeWav(samples, 44100);
      const dataUri = arrayBufferToBase64DataUri(wavBuffer);
      const bars = extractWaveformBars(samples, BAR_COUNT);

      dispatch({ type: "SET_AUDIO", dataUri, waveformBars: bars });
    } catch (e) {
      dispatch({ type: "SET_PROCESSING", processing: false });
      Alert.alert("Synthesis failed", String(e));
    }
  }, [state.imageUri, state.mode, state.durationSeconds, extractPixels, getEnabledHz, dispatch]);

  const handlePlay = useCallback(async () => {
    if (!state.audioDataUri) {
      await synthesize();
      return;
    }
    try {
      player.replace({ uri: state.audioDataUri });
      player.play();
      dispatch({ type: "SET_PLAYING", playing: true });

      // Scan line tracks playback position
      scanPos.setValue(0);
      scanAnim.current = Animated.timing(scanPos, {
        toValue: 1,
        duration: state.durationSeconds * 1000,
        useNativeDriver: false,
      });
      scanAnim.current.start(({ finished }) => {
        if (finished) {
          dispatch({ type: "SET_PLAYING", playing: false });
          scanPos.setValue(0);
        }
      });
    } catch (e) {
      Alert.alert("Playback error", String(e));
    }
  }, [state.audioDataUri, state.durationSeconds, synthesize, player, dispatch]);

  const handlePause = useCallback(() => {
    player.pause();
    scanAnim.current?.stop();
    dispatch({ type: "SET_PLAYING", playing: false });
  }, [player, dispatch]);

  const handleStop = useCallback(() => {
    player.pause();
    scanAnim.current?.stop();
    scanPos.setValue(0);
    dispatch({ type: "SET_PLAYING", playing: false });
  }, [player, dispatch]);

  const handleExport = useCallback(async () => {
    if (!state.audioDataUri) {
      Alert.alert("No audio", "Synthesize audio first by pressing Play.");
      return;
    }
    try {
      if (Platform.OS === "web") {
        const a = document.createElement("a");
        a.href = state.audioDataUri;
        a.download = "biosonify-output.wav";
        a.click();
      } else {
        const path = FileSystem.cacheDirectory + "biosonify-output.wav";
        const base64 = state.audioDataUri.replace("data:audio/wav;base64,", "");
        await FileSystem.writeAsStringAsync(path, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, { mimeType: "audio/wav" });
        } else {
          Alert.alert("Saved", "Audio saved to: " + path);
        }
      }
    } catch (e) {
      Alert.alert("Export failed", String(e));
    }
  }, [state.audioDataUri]);

  const setMode = useCallback(
    (mode: SonificationMode) => {
      dispatch({ type: "SET_MODE", mode });
    },
    [dispatch]
  );

  const imageAreaW = SCREEN_W - 32;
  const imageAreaH = Math.round(imageAreaW * 0.6);

  return (
    <ScreenContainer containerClassName="bg-background" className="bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={22} color="#7D8590" />
          </Pressable>
          <Text style={styles.headerTitle}>Sonification Player</Text>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            onPress={handleExport}
          >
            <IconSymbol name="square.and.arrow.up" size={20} color="#2ECC9A" />
          </Pressable>
        </View>

        {/* ── Image + scan line ──────────────────────────────────────────── */}
        <View style={[styles.imageBox, { width: imageAreaW, height: imageAreaH }]}>
          {state.imageUri ? (
            <>
              <Image
                source={{ uri: state.imageUri }}
                style={styles.image}
                resizeMode="cover"
              />
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    backgroundColor: MODE_COLORS[state.mode],
                    left: scanPos.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, imageAreaW],
                    }),
                  },
                ]}
              />
              {(state.isProcessing || isExtracting) && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator color="#2ECC9A" size="large" />
                  <Text style={styles.processingText}>
                    Translating image data to sound…
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noImage}>
              <IconSymbol name="photo.fill" size={40} color="#30363D" />
              <Text style={styles.noImageText}>No image selected</Text>
            </View>
          )}
        </View>

        {/* ── Waveform — real data only ──────────────────────────────────── */}
        <View style={styles.waveformRow}>
          {barAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveBar,
                {
                  height: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [2, 54],
                  }),
                  backgroundColor:
                    state.waveformBars.length > 0
                      ? MODE_COLORS[state.mode]
                      : "#30363D",
                  opacity: state.waveformBars.length > 0 ? 1 : 0.4,
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.waveformHint}>
          {state.waveformBars.length > 0
            ? "Waveform — every bar represents real image data"
            : "Waveform will appear after synthesis"}
        </Text>

        {/* ── Mode selector ──────────────────────────────────────────────── */}
        <View style={styles.modeRow}>
          {(["SPECTRAL", "WAVE_GENETICS", "BIOFIELD"] as SonificationMode[]).map((m) => (
            <Pressable
              key={m}
              style={[
                styles.modeBtn,
                state.mode === m && {
                  backgroundColor: MODE_COLORS[m] + "22",
                  borderColor: MODE_COLORS[m],
                },
              ]}
              onPress={() => setMode(m)}
            >
              <Text
                style={[
                  styles.modeBtnText,
                  state.mode === m && { color: MODE_COLORS[m] },
                ]}
              >
                {MODE_LABELS[m]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.modeDesc}>{MODE_DESCRIPTIONS[state.mode]}</Text>

        {/* ── Playback controls ──────────────────────────────────────────── */}
        <View style={styles.controls}>
          <Pressable
            style={({ pressed }) => [styles.sideBtn, pressed && { opacity: 0.7 }]}
            onPress={handleStop}
          >
            <IconSymbol name="stop.fill" size={22} color="#7D8590" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.playBtn,
              { backgroundColor: MODE_COLORS[state.mode] },
              pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
            ]}
            onPress={state.isPlaying ? handlePause : handlePlay}
            disabled={state.isProcessing || isExtracting}
          >
            {state.isProcessing || isExtracting ? (
              <ActivityIndicator color="#0D1117" size="small" />
            ) : (
              <IconSymbol
                name={state.isPlaying ? "pause.fill" : "play.fill"}
                size={30}
                color="#0D1117"
              />
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.sideBtn,
              pressed && { opacity: 0.7 },
              (!state.imageUri || state.isProcessing || isExtracting) && { opacity: 0.3 },
            ]}
            onPress={synthesize}
            disabled={state.isProcessing || isExtracting || !state.imageUri}
          >
            <IconSymbol name="bolt.fill" size={22} color="#F0A500" />
          </Pressable>
        </View>

        <Text style={styles.controlHint}>
          {state.audioDataUri
            ? "Audio ready · Tap ⚡ to re-synthesize with current settings"
            : state.imageUri
            ? "Tap ▶ to synthesize — every pixel will be translated to sound"
            : "Select an image from the home screen first"}
        </Text>

        {/* ── Duration ───────────────────────────────────────────────────── */}
        <View style={styles.durationRow}>
          <Text style={styles.durationLabel}>Duration</Text>
          {[5, 10, 20, 30].map((d) => (
            <Pressable
              key={d}
              style={[
                styles.durationBtn,
                state.durationSeconds === d && styles.durationBtnActive,
              ]}
              onPress={() => dispatch({ type: "SET_DURATION", seconds: d })}
            >
              <Text
                style={[
                  styles.durationBtnText,
                  state.durationSeconds === d && styles.durationBtnTextActive,
                ]}
              >
                {d}s
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  iconBtn: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#E6EDF3" },
  imageBox: {
    alignSelf: "center",
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#161B22",
    marginBottom: 12,
  },
  image: { width: "100%", height: "100%" },
  scanLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    opacity: 0.9,
    shadowColor: "#2ECC9A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,17,23,0.75)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  processingText: { color: "#2ECC9A", fontSize: 13, fontWeight: "600" },
  noImage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  noImageText: { color: "#30363D", fontSize: 14 },
  waveformRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    paddingHorizontal: 16,
    gap: 2,
    marginBottom: 4,
  },
  waveBar: {
    flex: 1,
    maxWidth: 8,
    borderRadius: 2,
    minHeight: 2,
  },
  waveformHint: {
    fontSize: 10,
    color: "#7D8590",
    textAlign: "center",
    marginBottom: 14,
    fontStyle: "italic",
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#30363D",
    alignItems: "center",
  },
  modeBtnText: { fontSize: 11, fontWeight: "600", color: "#7D8590" },
  modeDesc: {
    fontSize: 11,
    color: "#7D8590",
    textAlign: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
    lineHeight: 16,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginBottom: 8,
  },
  playBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
  },
  sideBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#161B22",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#30363D",
  },
  controlHint: {
    fontSize: 11,
    color: "#7D8590",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  durationLabel: {
    fontSize: 12,
    color: "#7D8590",
    fontWeight: "600",
    marginRight: 4,
  },
  durationBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  durationBtnActive: {
    backgroundColor: "#2ECC9A22",
    borderColor: "#2ECC9A",
  },
  durationBtnText: { fontSize: 12, color: "#7D8590", fontWeight: "600" },
  durationBtnTextActive: { color: "#2ECC9A" },
});
