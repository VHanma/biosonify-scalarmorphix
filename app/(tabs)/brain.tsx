/**
 * app/(tabs)/brain.tsx
 * God Helmet / Brain-Region Targeting Screen
 */

import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  BRAIN_REGION_POSITIONS,
  EMOTION_PRESETS,
  EmotionPreset,
  generateBinauralBeat,
} from "@/lib/hrtf-engine";
import { applyScalarEncoding } from "@/lib/scalar-encoder";
import { encodeWav } from "@/lib/sonification-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

type DurationOption = { label: string; seconds: number };

const DURATION_OPTIONS: DurationOption[] = [
  { label: "5 min", seconds: 5 * 60 },
  { label: "10 min", seconds: 10 * 60 },
  { label: "20 min", seconds: 20 * 60 },
  { label: "30 min", seconds: 30 * 60 },
  { label: "60 min", seconds: 60 * 60 },
];

// ─── Pure-JS base64 encoder (no btoa — Android Hermes safe) ──────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    const b1 = i < bytes.length ? bytes[i++] : 0;
    const b2 = i < bytes.length ? bytes[i++] : 0;
    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += chars[((b1 & 15) << 2) | (b2 >> 6)];
    result += chars[b2 & 63];
  }
  const pad = bytes.length % 3;
  if (pad === 1) result = result.slice(0, -2) + "==";
  else if (pad === 2) result = result.slice(0, -1) + "=";
  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BrainScreen() {
  const colors = useColors();
  const [selectedPreset, setSelectedPreset] = useState<EmotionPreset>(EMOTION_PRESETS[0]);
  const [durationSec, setDurationSec] = useState(20 * 60);
  const [scalarEnabled, setScalarEnabled] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [affirmUri, setAffirmUri] = useState<string | null>(null);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  // Affirmation recorder — use RecordingPresets.HIGH_QUALITY (correct shape)
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  useEffect(() => {
    (async () => {
      await setAudioModeAsync({ playsInSilentMode: true });
      await requestRecordingPermissionsAsync();
    })();
    return () => {
      playerRef.current?.remove();
    };
  }, []);

  const generate = useCallback(async () => {
    setGenerating(true);
    setAudioUri(null);
    try {
      // Generate binaural beat with HRTF spatialization
      const stereo = generateBinauralBeat(selectedPreset, 44100, durationSec);

      // Apply Bearden scalar encoding if enabled
      const encoded = scalarEnabled ? applyScalarEncoding(stereo, 0.5) : stereo;

      // Encode to WAV — encodeWav takes (buffer, sampleRate) only
      const wavBuffer = encodeWav(encoded, 44100);

      // Write to file using pure-JS base64 (no btoa)
      const filename = `biosonify_${selectedPreset.id}_${Date.now()}.wav`;
      const uri = FileSystem.cacheDirectory + filename;
      const b64 = arrayBufferToBase64(wavBuffer);
      await FileSystem.writeAsStringAsync(uri, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setAudioUri(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Generation Error", String(e));
    } finally {
      setGenerating(false);
    }
  }, [selectedPreset, durationSec, scalarEnabled]);

  const togglePlay = useCallback(() => {
    if (!audioUri) return;
    if (isPlaying) {
      playerRef.current?.pause();
      setIsPlaying(false);
    } else {
      playerRef.current?.remove();
      const p = createAudioPlayer({ uri: audioUri });
      playerRef.current = p;
      p.play();
      setIsPlaying(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [audioUri, isPlaying]);

  const saveToLibrary = useCallback(async () => {
    if (!audioUri) return;
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission denied", "Cannot save to music library.");
      return;
    }
    await MediaLibrary.saveToLibraryAsync(audioUri);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved", `${selectedPreset.name} saved to your music library.`);
  }, [audioUri, selectedPreset]);

  const shareAudio = useCallback(async () => {
    if (!audioUri) return;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(audioUri, { mimeType: "audio/wav" });
    }
  }, [audioUri]);

  const startAffirmation = useCallback(async () => {
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
  }, [audioRecorder]);

  const stopAffirmation = useCallback(async () => {
    await audioRecorder.stop();
    if (audioRecorder.uri) {
      setAffirmUri(audioRecorder.uri);
    }
  }, [audioRecorder]);

  const pos = BRAIN_REGION_POSITIONS[selectedPreset.primaryRegion];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Brain Targeting</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            God Helmet · Hemi-Sync · HRTF Spatialization
          </Text>
        </View>

        {/* Preset Selector */}
        <TouchableOpacity
          style={[styles.presetCard, { backgroundColor: colors.surface, borderColor: selectedPreset.color }]}
          onPress={() => setShowPresetModal(true)}
          activeOpacity={0.8}
        >
          <View style={[styles.presetDot, { backgroundColor: selectedPreset.color }]} />
          <View style={styles.presetInfo}>
            <Text style={[styles.presetName, { color: colors.foreground }]}>{selectedPreset.name}</Text>
            <Text style={[styles.presetDesc, { color: colors.muted }]} numberOfLines={2}>
              {selectedPreset.description}
            </Text>
          </View>
          <Text style={[styles.chevron, { color: colors.muted }]}>›</Text>
        </TouchableOpacity>

        {/* Brain Region Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.foreground }]}>Target Region</Text>
          <Text style={[styles.infoValue, { color: selectedPreset.color }]}>{pos.label}</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Carrier</Text>
              <Text style={[styles.infoNum, { color: colors.foreground }]}>{selectedPreset.carrierHz} Hz</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Beat</Text>
              <Text style={[styles.infoNum, { color: colors.foreground }]}>{selectedPreset.beatHz} Hz</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Azimuth</Text>
              <Text style={[styles.infoNum, { color: colors.foreground }]}>{pos.azimuth}°</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Elevation</Text>
              <Text style={[styles.infoNum, { color: colors.foreground }]}>{pos.elevation}°</Text>
            </View>
          </View>
          <Text style={[styles.overlayLabel, { color: colors.muted }]}>
            Overlay frequencies: {selectedPreset.overlayFreqHz.join(" · ")} Hz
          </Text>
        </View>

        {/* Duration Selector */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Duration</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.seconds}
                  style={[
                    styles.durationChip,
                    {
                      backgroundColor: durationSec === opt.seconds ? selectedPreset.color : colors.surface,
                      borderColor: durationSec === opt.seconds ? selectedPreset.color : colors.border,
                    },
                  ]}
                  onPress={() => setDurationSec(opt.seconds)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.durationText,
                      { color: durationSec === opt.seconds ? "#000" : colors.foreground },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Scalar Toggle */}
        <TouchableOpacity
          style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            setScalarEnabled((v) => !v);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.toggleTextContainer}>
            <Text style={[styles.toggleTitle, { color: colors.foreground }]}>Bearden Scalar Encoding</Text>
            <Text style={[styles.toggleDesc, { color: colors.muted }]}>
              Phase-conjugate pair — longitudinal scalar wave for DNA interaction
            </Text>
          </View>
          <View
            style={[
              styles.toggleSwitch,
              { backgroundColor: scalarEnabled ? selectedPreset.color : colors.border },
            ]}
          >
            <View
              style={[
                styles.toggleKnob,
                { transform: [{ translateX: scalarEnabled ? 18 : 0 }] },
              ]}
            />
          </View>
        </TouchableOpacity>

        {/* Affirmation Recorder */}
        <View style={[styles.affirmCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Personal Affirmation</Text>
          <Text style={[styles.affirmDesc, { color: colors.muted }]}>
            Record your own affirmation to layer under this audio when saved.
          </Text>
          <View style={styles.affirmButtons}>
            <TouchableOpacity
              style={[
                styles.affirmBtn,
                {
                  backgroundColor: recorderState.isRecording ? "#EF4444" : selectedPreset.color,
                },
              ]}
              onPress={recorderState.isRecording ? stopAffirmation : startAffirmation}
              activeOpacity={0.8}
            >
              <Text style={styles.affirmBtnText}>
                {recorderState.isRecording ? "Stop" : "Record"}
              </Text>
            </TouchableOpacity>
            {affirmUri && (
              <TouchableOpacity
                style={[styles.affirmBtn, { backgroundColor: colors.border }]}
                onPress={() => setAffirmUri(null)}
                activeOpacity={0.8}
              >
                <Text style={[styles.affirmBtnText, { color: colors.foreground }]}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          {affirmUri && (
            <Text style={[styles.affirmSaved, { color: colors.success }]}>
              Affirmation recorded — will be included in saved audio
            </Text>
          )}
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: selectedPreset.color, opacity: generating ? 0.6 : 1 }]}
          onPress={generate}
          disabled={generating}
          activeOpacity={0.85}
        >
          <Text style={styles.generateBtnText}>
            {generating ? "Generating..." : "Generate Audio"}
          </Text>
        </TouchableOpacity>

        {/* Playback & Save Controls */}
        {audioUri && (
          <View style={[styles.playbackCard, { backgroundColor: colors.surface, borderColor: selectedPreset.color }]}>
            <Text style={[styles.playbackTitle, { color: colors.foreground }]}>
              {selectedPreset.name} ready
            </Text>
            <Text style={[styles.playbackSub, { color: colors.muted }]}>
              {Math.round(durationSec / 60)} min · 44100 Hz stereo WAV
              {scalarEnabled ? " · Scalar encoded" : ""}
            </Text>
            <View style={styles.playbackButtons}>
              <TouchableOpacity
                style={[styles.playBtn, { backgroundColor: selectedPreset.color }]}
                onPress={togglePlay}
                activeOpacity={0.8}
              >
                <Text style={styles.playBtnText}>{isPlaying ? "Pause" : "Play"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { borderColor: selectedPreset.color }]}
                onPress={saveToLibrary}
                activeOpacity={0.8}
              >
                <Text style={[styles.saveBtnText, { color: selectedPreset.color }]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shareBtn, { borderColor: colors.border }]}
                onPress={shareAudio}
                activeOpacity={0.8}
              >
                <Text style={[styles.shareBtnText, { color: colors.muted }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Preset Selection Modal */}
      <Modal
        visible={showPresetModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPresetModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select State Preset</Text>
            <TouchableOpacity onPress={() => setShowPresetModal(false)}>
              <Text style={[styles.modalClose, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={EMOTION_PRESETS}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.presetRow,
                  {
                    backgroundColor:
                      selectedPreset.id === item.id ? colors.surface : "transparent",
                    borderBottomColor: colors.border,
                  },
                ]}
                onPress={() => {
                  setSelectedPreset(item);
                  setAudioUri(null);
                  setIsPlaying(false);
                  setShowPresetModal(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.presetRowDot, { backgroundColor: item.color }]} />
                <View style={styles.presetRowInfo}>
                  <Text style={[styles.presetRowName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.presetRowRegion, { color: colors.muted }]}>
                    {BRAIN_REGION_POSITIONS[item.primaryRegion].label}
                    {item.secondaryRegion
                      ? ` + ${BRAIN_REGION_POSITIONS[item.secondaryRegion].label}`
                      : ""}
                    {" · "}
                    {item.carrierHz} Hz carrier · {item.beatHz} Hz beat
                  </Text>
                </View>
                {selectedPreset.id === item.id && (
                  <Text style={[styles.checkmark, { color: item.color }]}>✓</Text>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 14 },
  presetCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 16,
    gap: 12,
  },
  presetDot: { width: 14, height: 14, borderRadius: 7 },
  presetInfo: { flex: 1 },
  presetName: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  presetDesc: { fontSize: 12, lineHeight: 18 },
  chevron: { fontSize: 24, fontWeight: "300" },
  infoCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  infoValue: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  infoRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  infoItem: { flex: 1, alignItems: "center" },
  infoLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  infoNum: { fontSize: 14, fontWeight: "600" },
  overlayLabel: { fontSize: 11, marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginBottom: 10 },
  durationRow: { flexDirection: "row", gap: 8 },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  durationText: { fontSize: 13, fontWeight: "500" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  toggleTextContainer: { flex: 1, marginRight: 12 },
  toggleTitle: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  toggleDesc: { fontSize: 11 },
  toggleSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  affirmCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  affirmDesc: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  affirmButtons: { flexDirection: "row", gap: 10 },
  affirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  affirmBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  affirmSaved: { fontSize: 12, marginTop: 10 },
  generateBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  generateBtnText: { color: "#000", fontWeight: "700", fontSize: 16 },
  playbackCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 16,
  },
  playbackTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  playbackSub: { fontSize: 12, marginBottom: 16 },
  playbackButtons: { flexDirection: "row", gap: 10 },
  playBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  playBtnText: { color: "#000", fontWeight: "700", fontSize: 14 },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
  },
  saveBtnText: { fontWeight: "700", fontSize: 14 },
  shareBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  shareBtnText: { fontWeight: "600", fontSize: 14 },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalClose: { fontSize: 16, fontWeight: "600" },
  presetRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  presetRowDot: { width: 12, height: 12, borderRadius: 6 },
  presetRowInfo: { flex: 1 },
  presetRowName: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  presetRowRegion: { fontSize: 11 },
  checkmark: { fontSize: 18, fontWeight: "700" },
});
