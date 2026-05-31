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
  BIOFIELD: "#1A6B5A",
};

const MODE_DESCRIPTIONS: Record<SonificationMode, string> = {
  SPECTRAL: "Pixel brightness → pitch · Color → timbre · Position → time",
  WAVE_GENETICS: "Gariaev 40 Hz carrier · RGB → 396 / 528 / 741 Hz Solfeggio",
  BIOFIELD: "Spectral + Schumann · Solfeggio · Brainwave carriers",
};

export default function SonifyScreen() {
  const router = useRouter();
  const { state, dispatch, getEnabledHz } = useSonification();
  const { extractPixels, isExtracting } = useImagePixels();
  const [scanPos] = useState(new Animated.Value(0));
  const scanAnim = useRef<Animated.CompositeAnimation | null>(null);
  const player = useAudioPlayer(null);

  // Waveform bars (from synthesis or animated placeholder)
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.1))
  ).current;
  const idleAnim = useRef<Animated.CompositeAnimation | null>(null);

  // Start idle waveform animation
  useEffect(() => {
    if (!state.isPlaying && state.waveformBars.length === 0) {
      const anims = barAnims.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.1 + Math.random() * 0.4,
              duration: 600 + i * 20,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0.05 + Math.random() * 0.15,
              duration: 600 + i * 15,
              useNativeDriver: false,
            }),
          ])
        )
      );
      idleAnim.current = Animated.parallel(anims);
      idleAnim.current.start();
    } else {
      idleAnim.current?.stop();
      // Set bars from synthesis data
      if (state.waveformBars.length > 0) {
        state.waveformBars.forEach((val, i) => {
          if (i < barAnims.length) barAnims[i].setValue(val);
        });
      }
    }
    return () => idleAnim.current?.stop();
  }, [state.isPlaying, state.waveformBars]);

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

      // Start scan line animation
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
      Alert.alert("No audio", "Please synthesize audio first by pressing Play.");
      return;
    }
    try {
      if (Platform.OS === "web") {
        // Web: trigger download
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
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={22} color="#7D8590" />
          </Pressable>
          <Text style={styles.headerTitle}>Sonification Player</Text>
          <Pressable
            style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.6 }]}
            onPress={handleExport}
          >
            <IconSymbol name="square.and.arrow.up" size={20} color="#2ECC9A" />
          </Pressable>
        </View>

        {/* ── Image Display with Scan Line ─────────────────────────────── */}
        <View style={[styles.imageContainer, { width: imageAreaW, height: imageAreaH }]}>
          {state.imageUri ? (
            <>
              <Image
                source={{ uri: state.imageUri }}
                style={styles.image}
                resizeMode="cover"
              />
              {/* Scan line overlay */}
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    left: scanPos.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, imageAreaW],
                    }),
                  },
                ]}
              />
              {/* Processing overlay */}
              {(state.isProcessing || isExtracting) && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator color="#2ECC9A" size="large" />
                  <Text style={styles.processingText}>Synthesizing…</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noImagePlaceholder}>
              <IconSymbol name="photo.fill" size={40} color="#30363D" />
              <Text style={styles.noImageText}>No image selected</Text>
            </View>
          )}
        </View>

        {/* ── Waveform Visualizer ───────────────────────────────────────── */}
        <View style={styles.waveformContainer}>
          {barAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveBar,
                {
                  height: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [3, 52],
                  }),
                  backgroundColor:
                    MODE_COLORS[state.mode] +
                    (state.isPlaying ? "FF" : "88"),
                },
              ]}
            />
          ))}
        </View>

        {/* ── Mode Selector ─────────────────────────────────────────────── */}
        <View style={styles.modeRow}>
          {(["SPECTRAL", "WAVE_GENETICS", "BIOFIELD"] as SonificationMode[]).map(
            (m) => (
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
            )
          )}
        </View>

        {/* Mode description */}
        <Text style={styles.modeDesc}>{MODE_DESCRIPTIONS[state.mode]}</Text>

        {/* ── Playback Controls ─────────────────────────────────────────── */}
        <View style={styles.controls}>
          <Pressable
            style={({ pressed }) => [styles.stopBtn, pressed && { opacity: 0.7 }]}
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
            style={({ pressed }) => [styles.stopBtn, pressed && { opacity: 0.7 }]}
            onPress={synthesize}
            disabled={state.isProcessing || isExtracting || !state.imageUri}
          >
            <IconSymbol name="bolt.fill" size={22} color="#F0A500" />
          </Pressable>
        </View>

        <Text style={styles.controlHint}>
          {state.audioDataUri
            ? "Audio ready · Tap ⚡ to re-synthesize"
            : "Tap ▶ to synthesize and play"}
        </Text>

        {/* ── Duration Selector ─────────────────────────────────────────── */}
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
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#E6EDF3",
  },
  exportBtn: {
    padding: 8,
  },
  imageContainer: {
    alignSelf: "center",
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#161B22",
    marginBottom: 16,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  scanLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#2ECC9A",
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
  processingText: {
    color: "#2ECC9A",
    fontSize: 14,
    fontWeight: "600",
  },
  noImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  noImageText: {
    color: "#30363D",
    fontSize: 14,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    paddingHorizontal: 16,
    gap: 2,
    marginBottom: 16,
  },
  waveBar: {
    flex: 1,
    maxWidth: 8,
    borderRadius: 2,
    minHeight: 3,
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
  modeBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7D8590",
  },
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
    shadowColor: "#2ECC9A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  stopBtn: {
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
  durationBtnText: {
    fontSize: 12,
    color: "#7D8590",
    fontWeight: "600",
  },
  durationBtnTextActive: {
    color: "#2ECC9A",
  },
});
