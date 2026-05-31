import { useState, useEffect, useRef, useCallback } from "react";
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
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useSonification } from "@/lib/sonification-store";
import { useImagePixels } from "@/lib/use-image-pixels";
import {
  synthesizeFromPixels,
  encodeWav,
  arrayBufferToBase64,
  extractWaveformBars,
  type SonificationMode,
} from "@/lib/sonification-engine";
import {
  saveIndividualSonification,
  saveCombinedTones,
  saveStackedOutput,
} from "@/lib/save-audio";

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
    "Every pixel: brightness→pitch · hue→timbre · saturation→harmonics · position→time",
  WAVE_GENETICS:
    "Every pixel: R→396 Hz · G→528 Hz · B→741 Hz · luminance→40 Hz coherence · X→phase · Y→detune",
  BIOFIELD:
    "Full spectral scan + pixel-driven biofield carriers (amplitude & phase from image data)",
};

/** Write WAV ArrayBuffer to a cache file and return a file:// URI (or data: on web). */
async function writeWavToFile(wavBuffer: ArrayBuffer): Promise<string> {
  if (Platform.OS === "web") {
    const base64 = arrayBufferToBase64(wavBuffer);
    return `data:audio/wav;base64,${base64}`;
  }
  const path = (FileSystem.cacheDirectory ?? "") + "biosonify-output.wav";
  const base64 = arrayBufferToBase64(wavBuffer);
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

export default function SonifyScreen() {
  const router = useRouter();
  const { state, dispatch, getEnabledFrequencies, getEnabledHz } = useSonification();
  const { extractPixels, isExtracting } = useImagePixels();
  const [scanPos] = useState(new Animated.Value(0));
  const scanAnim = useRef<Animated.CompositeAnimation | null>(null);
  const player = useAudioPlayer(null);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
      barAnims.forEach((anim) => {
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
      });
    }
  }, [state.waveformBars]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => { player.release(); };
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
      const audioUri = await writeWavToFile(wavBuffer);
      const base64 = arrayBufferToBase64(wavBuffer);
      const dataUri = `data:audio/wav;base64,${base64}`;
      const bars = extractWaveformBars(samples, BAR_COUNT);
      dispatch({ type: "SET_AUDIO", dataUri, audioUri, waveformBars: bars });
    } catch (e) {
      dispatch({ type: "SET_PROCESSING", processing: false });
      Alert.alert("Synthesis failed", String(e));
    }
  }, [state.imageUri, state.mode, state.durationSeconds, extractPixels, getEnabledHz, dispatch]);

  const handlePlay = useCallback(async () => {
    if (!state.audioUri) {
      await synthesize();
      return;
    }
    try {
      player.replace({ uri: state.audioUri });
      player.play();
      dispatch({ type: "SET_PLAYING", playing: true });
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
  }, [state.audioUri, state.durationSeconds, synthesize, player, dispatch]);

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

  // ── Save handlers ────────────────────────────────────────────────────────────

  const handleSaveIndividual = useCallback(async () => {
    if (!state.audioDataUri) {
      Alert.alert("No audio", "Synthesize audio first by pressing Play.");
      return;
    }
    setIsSaving(true);
    setShowSaveMenu(false);
    try {
      await saveIndividualSonification(
        state.audioDataUri,
        `BioSonify_${state.mode}_${state.durationSeconds}s`
      );
    } catch (e) {
      Alert.alert("Save failed", String(e));
    } finally {
      setIsSaving(false);
    }
  }, [state.audioDataUri, state.mode, state.durationSeconds]);

  const handleSaveCombined = useCallback(async () => {
    const enabled = getEnabledFrequencies();
    setIsSaving(true);
    setShowSaveMenu(false);
    try {
      await saveCombinedTones(enabled, state.durationSeconds);
    } catch (e) {
      Alert.alert("Save failed", String(e));
    } finally {
      setIsSaving(false);
    }
  }, [getEnabledFrequencies, state.durationSeconds]);

  const handleSaveStacked = useCallback(async () => {
    if (!state.audioDataUri) {
      Alert.alert("No audio", "Synthesize audio first by pressing Play.");
      return;
    }
    const enabled = getEnabledFrequencies();
    setIsSaving(true);
    setShowSaveMenu(false);
    try {
      await saveStackedOutput(state.audioDataUri, enabled, state.durationSeconds);
    } catch (e) {
      Alert.alert("Save failed", String(e));
    } finally {
      setIsSaving(false);
    }
  }, [state.audioDataUri, getEnabledFrequencies, state.durationSeconds]);

  const imageAreaW = SCREEN_W - 32;
  const imageAreaH = Math.round(imageAreaW * 0.6);

  return (
    <ScreenContainer containerClassName="bg-background" className="bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={22} color="#7D8590" />
          </Pressable>
          <Text style={styles.headerTitle}>Sonification Player</Text>
          <Pressable
            style={({ pressed }) => [
              styles.iconBtn,
              styles.saveHeaderBtn,
              pressed && { opacity: 0.6 },
              isSaving && { opacity: 0.4 },
            ]}
            onPress={() => setShowSaveMenu(true)}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size={16} color="#2ECC9A" />
            ) : (
              <IconSymbol name="square.and.arrow.down" size={20} color="#2ECC9A" />
            )}
          </Pressable>
        </View>

        {/* ── Image + scan line ────────────────────────────────────────────── */}
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

        {/* ── Waveform — real data only ────────────────────────────────────── */}
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

        {/* ── Mode selector ────────────────────────────────────────────────── */}
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
              onPress={() => dispatch({ type: "SET_MODE", mode: m })}
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

        {/* ── Playback controls ────────────────────────────────────────────── */}
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
          {state.audioUri
            ? "Audio ready · Tap ⚡ to re-synthesize · Tap 💾 to save"
            : state.imageUri
            ? "Tap ▶ to synthesize — every pixel will be translated to sound"
            : "Select an image from the home screen first"}
        </Text>

        {/* ── Duration ─────────────────────────────────────────────────────── */}
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

        {/* ── Save section ─────────────────────────────────────────────────── */}
        <View style={styles.saveSection}>
          <Text style={styles.saveSectionTitle}>Save Audio</Text>
          <View style={styles.saveRow}>
            {/* Individual */}
            <Pressable
              style={({ pressed }) => [
                styles.saveCard,
                pressed && { opacity: 0.75 },
                !state.audioDataUri && styles.saveCardDisabled,
              ]}
              onPress={handleSaveIndividual}
              disabled={!state.audioDataUri || isSaving}
            >
              <IconSymbol name="waveform" size={22} color="#2ECC9A" />
              <Text style={styles.saveCardTitle}>Individual</Text>
              <Text style={styles.saveCardDesc}>Image sonification only</Text>
            </Pressable>

            {/* Combined */}
            <Pressable
              style={({ pressed }) => [
                styles.saveCard,
                pressed && { opacity: 0.75 },
              ]}
              onPress={handleSaveCombined}
              disabled={isSaving}
            >
              <IconSymbol name="music.note.list" size={22} color="#9B59B6" />
              <Text style={styles.saveCardTitle}>Combined</Text>
              <Text style={styles.saveCardDesc}>All active frequencies mixed</Text>
            </Pressable>

            {/* Stacked */}
            <Pressable
              style={({ pressed }) => [
                styles.saveCard,
                pressed && { opacity: 0.75 },
                !state.audioDataUri && styles.saveCardDisabled,
              ]}
              onPress={handleSaveStacked}
              disabled={!state.audioDataUri || isSaving}
            >
              <IconSymbol name="square.stack.3d.up" size={22} color="#F0A500" />
              <Text style={styles.saveCardTitle}>Stacked</Text>
              <Text style={styles.saveCardDesc}>Image + frequencies layered</Text>
            </Pressable>
          </View>
          {isSaving && (
            <View style={styles.savingRow}>
              <ActivityIndicator size={14} color="#2ECC9A" />
              <Text style={styles.savingText}>Generating and saving audio…</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Save menu modal ──────────────────────────────────────────────────── */}
      <Modal
        visible={showSaveMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveMenu(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSaveMenu(false)}
        >
          <View style={styles.saveMenu}>
            <Text style={styles.saveMenuTitle}>Save Audio</Text>

            <Pressable
              style={styles.saveMenuItem}
              onPress={handleSaveIndividual}
              disabled={!state.audioDataUri}
            >
              <IconSymbol name="waveform" size={20} color="#2ECC9A" />
              <View style={styles.saveMenuItemInfo}>
                <Text style={[styles.saveMenuItemTitle, !state.audioDataUri && { opacity: 0.4 }]}>
                  Individual — Image Sonification
                </Text>
                <Text style={styles.saveMenuItemDesc}>
                  Save the current image-to-sound translation as a WAV file
                </Text>
              </View>
            </Pressable>

            <Pressable style={styles.saveMenuItem} onPress={handleSaveCombined}>
              <IconSymbol name="music.note.list" size={20} color="#9B59B6" />
              <View style={styles.saveMenuItemInfo}>
                <Text style={styles.saveMenuItemTitle}>Combined — Frequency Mix</Text>
                <Text style={styles.saveMenuItemDesc}>
                  All {state.enabledFrequencies.length} active frequencies mixed into one WAV
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.saveMenuItem}
              onPress={handleSaveStacked}
              disabled={!state.audioDataUri}
            >
              <IconSymbol name="square.stack.3d.up" size={20} color="#F0A500" />
              <View style={styles.saveMenuItemInfo}>
                <Text style={[styles.saveMenuItemTitle, !state.audioDataUri && { opacity: 0.4 }]}>
                  Stacked — Image + Frequencies
                </Text>
                <Text style={styles.saveMenuItemDesc}>
                  Image sonification layered with all active frequency tones
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.saveMenuCancel}
              onPress={() => setShowSaveMenu(false)}
            >
              <Text style={styles.saveMenuCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  saveHeaderBtn: {
    backgroundColor: "#161B22",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#30363D",
  },
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
    marginBottom: 24,
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
  // ── Save section ──────────────────────────────────────────────────────────
  saveSection: {
    paddingHorizontal: 16,
  },
  saveSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7D8590",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  saveRow: {
    flexDirection: "row",
    gap: 10,
  },
  saveCard: {
    flex: 1,
    backgroundColor: "#161B22",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#30363D",
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  saveCardDisabled: { opacity: 0.35 },
  saveCardTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#E6EDF3",
    textAlign: "center",
  },
  saveCardDesc: {
    fontSize: 10,
    color: "#7D8590",
    textAlign: "center",
    lineHeight: 14,
  },
  savingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    justifyContent: "center",
  },
  savingText: { fontSize: 12, color: "#2ECC9A" },
  // ── Save menu modal ────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  saveMenu: {
    backgroundColor: "#161B22",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 4,
  },
  saveMenuTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#E6EDF3",
    marginBottom: 12,
    textAlign: "center",
  },
  saveMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  saveMenuItemInfo: { flex: 1 },
  saveMenuItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E6EDF3",
    marginBottom: 2,
  },
  saveMenuItemDesc: {
    fontSize: 12,
    color: "#7D8590",
    lineHeight: 16,
  },
  saveMenuCancel: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
  },
  saveMenuCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7D8590",
  },
});
