import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import { StatusBar } from "expo-status-bar";
import {
  arrayBufferToBase64,
  buildComposition,
  bytesToBase64,
  encodeMidi,
  renderWav,
  type Composition,
  type ForgeSettings,
  type Pixel,
  type ScaleMode,
  type ScanMode,
} from "./src/forge-engine";

declare function require(name: string): any;

const PAPER = "#F6F0E7";
const INK = "#151515";
const MUTED = "#706D68";
const LINE = "#D8D0C5";
const CORAL = "#FF5D52";
const GOLD = "#FFC83D";
const AQUA = "#12C7B2";
const VIOLET = "#6D5DFB";

const ROOTS = ["C", "D", "E", "F", "G", "A", "B"];
const SCALES: { value: ScaleMode; label: string }[] = [
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
  { value: "pentatonic", label: "Pentatonic" },
  { value: "dorian", label: "Dorian" },
];
const SCANS: { value: ScanMode; label: string }[] = [
  { value: "sweep", label: "Ribbon" },
  { value: "columns", label: "Columns" },
  { value: "orbit", label: "Orbit" },
];
const MOMENTS = [24, 48, 72];
const TEMPOS = [72, 96, 120, 144];

function base64ToBytes(base64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const clean = base64.replace(/\s+/g, "");
  let padding = 0;
  if (clean.endsWith("==")) padding = 2;
  else if (clean.endsWith("=")) padding = 1;
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4) - padding);
  let oi = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = clean[i + 2] === "=" ? 0 : lookup[clean.charCodeAt(i + 2)];
    const d = clean[i + 3] === "=" ? 0 : lookup[clean.charCodeAt(i + 3)];
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (oi < out.length) out[oi++] = (n >> 16) & 255;
    if (oi < out.length) out[oi++] = (n >> 8) & 255;
    if (oi < out.length) out[oi++] = n & 255;
  }
  return out;
}

function decodeJpeg(base64: string): { pixels: Pixel[]; width: number; height: number } {
  const jpeg = require("jpeg-js") as {
    decode: (bytes: Uint8Array, options?: { useTArray?: boolean }) => {
      width: number;
      height: number;
      data: Uint8Array;
    };
  };
  const decoded = jpeg.decode(base64ToBytes(base64), { useTArray: true });
  const pixels: Pixel[] = [];
  for (let i = 0; i < decoded.data.length; i += 4) {
    pixels.push({
      r: decoded.data[i],
      g: decoded.data[i + 1],
      b: decoded.data[i + 2],
      a: decoded.data[i + 3],
    });
  }
  return { pixels, width: decoded.width, height: decoded.height };
}

function hueColor(hue: number): string {
  if (hue < 0.14) return CORAL;
  if (hue < 0.31) return GOLD;
  if (hue < 0.52) return AQUA;
  if (hue < 0.72) return "#3E9BFF";
  if (hue < 0.9) return VIOLET;
  return "#ED55B9";
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function App() {
  const player = useAudioPlayer(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pixels, setPixels] = useState<Pixel[] | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [composition, setComposition] = useState<Composition | null>(null);
  const [busy, setBusy] = useState<"image" | "forge" | "preview" | "midi" | "wav" | null>(null);
  const [status, setStatus] = useState("Choose an image. Chromaforge will turn its structure into a musical score.");
  const [settings, setSettings] = useState<ForgeSettings>({
    tempo: 96,
    root: "C",
    scale: "major",
    moments: 48,
    scan: "orbit",
  });

  useEffect(() => () => player.release(), [player]);

  const noteCount = useMemo(
    () => composition?.tracks.reduce((sum, track) => sum + track.events.length, 0) ?? 0,
    [composition],
  );

  const chooseImage = async () => {
    setBusy("image");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Photo access needed", "Chromaforge needs photo access so you can choose an image.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 1,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 64, height: 64 } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 1, base64: true },
      );
      if (!manipulated.base64) throw new Error("The image decoder did not receive pixel data.");
      const decoded = decodeJpeg(manipulated.base64);
      setImageUri(asset.uri);
      setPixels(decoded.pixels);
      setImageSize({ width: decoded.width, height: decoded.height });
      setComposition(null);
      setStatus("Image loaded. Choose the score shape, then forge it.");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("Image load failed", String(error));
    } finally {
      setBusy(null);
    }
  };

  const forge = () => {
    if (!pixels) {
      Alert.alert("Choose an image first", "Pick an image before forging a score.");
      return;
    }
    setBusy("forge");
    try {
      const next = buildComposition(pixels, imageSize.width, imageSize.height, settings);
      setComposition(next);
      setStatus(`${noteCount || next.tracks.reduce((sum, t) => sum + t.events.length, 0)} notes forged from ${settings.moments} image moments.`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("Forge failed", String(error));
    } finally {
      setBusy(null);
    }
  };

  const writeWav = async (filename: string): Promise<string> => {
    if (!composition) throw new Error("Forge a score first.");
    const wav = renderWav(composition, settings.tempo);
    const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!base) throw new Error("Chromaforge could not access a writable folder.");
    const uri = `${base}${filename}`;
    await FileSystem.writeAsStringAsync(uri, arrayBufferToBase64(wav), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return uri;
  };

  const preview = async () => {
    setBusy("preview");
    try {
      const uri = await writeWav("chromaforge-preview.wav");
      player.replace({ uri });
      player.play();
      setStatus(`Playing forged score · ${settings.root} ${settings.scale} · ${settings.tempo} BPM.`);
    } catch (error) {
      Alert.alert("Preview failed", String(error));
    } finally {
      setBusy(null);
    }
  };

  const exportWav = async () => {
    setBusy("wav");
    try {
      const uri = await writeWav(`Chromaforge_${settings.root}_${settings.scale}_${settings.tempo}bpm.wav`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "audio/wav", dialogTitle: "Export Chromaforge WAV" });
      }
      setStatus("WAV ready to save or share.");
    } catch (error) {
      Alert.alert("WAV export failed", String(error));
    } finally {
      setBusy(null);
    }
  };

  const exportMidi = async () => {
    if (!composition) {
      Alert.alert("Forge a score first", "Create the image score before exporting MIDI.");
      return;
    }
    setBusy("midi");
    try {
      const bytes = encodeMidi(composition, settings.tempo);
      const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!base) throw new Error("Chromaforge could not access a writable folder.");
      const uri = `${base}Chromaforge_${settings.root}_${settings.scale}_${settings.tempo}bpm.mid`;
      await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "audio/midi", dialogTitle: "Export Chromaforge MIDI" });
      }
      setStatus("MIDI score ready to save or share.");
    } catch (error) {
      Alert.alert("MIDI export failed", String(error));
    } finally {
      setBusy(null);
    }
  };

  const working = busy !== null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <RNStatusBar barStyle="dark-content" backgroundColor={PAPER} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.prismStrip}>
          <View style={[styles.prismBlock, { backgroundColor: CORAL, flex: 1.2 }]} />
          <View style={[styles.prismBlock, { backgroundColor: GOLD, flex: 0.8 }]} />
          <View style={[styles.prismBlock, { backgroundColor: AQUA, flex: 1 }]} />
          <View style={[styles.prismBlock, { backgroundColor: VIOLET, flex: 1.35 }]} />
        </View>

        <Text style={styles.kicker}>PIXEL SCORE LAB</Text>
        <Text style={styles.title}>CHROMAFORGE</Text>
        <Text style={styles.lead}>An image becomes melody, harmony, texture and rhythm. Offline. Deterministic. Exportable.</Text>

        <Pressable style={styles.imageStage} onPress={chooseImage} disabled={working}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.emptyImage}>
              <View style={styles.aperture}>
                <View style={[styles.apertureDot, { backgroundColor: CORAL, left: 18, top: 17 }]} />
                <View style={[styles.apertureDot, { backgroundColor: GOLD, right: 19, top: 29 }]} />
                <View style={[styles.apertureDot, { backgroundColor: AQUA, left: 31, bottom: 18 }]} />
              </View>
              <Text style={styles.emptyTitle}>CHOOSE IMAGE</Text>
              <Text style={styles.emptyText}>Tap here to open a photo</Text>
            </View>
          )}
          {busy === "image" && <View style={styles.busyOverlay}><ActivityIndicator size="large" color={INK} /></View>}
        </Pressable>

        <Text style={styles.sectionLabel}>SCAN GEOMETRY</Text>
        <View style={styles.choiceRow}>
          {SCANS.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setSettings((s) => ({ ...s, scan: item.value }))}
              style={[styles.choice, settings.scan === item.value && styles.choiceActive]}
            >
              <Text style={[styles.choiceText, settings.scan === item.value && styles.choiceTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>MUSICAL DNA</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChoices}>
          {ROOTS.map((root) => (
            <Pressable
              key={root}
              onPress={() => setSettings((s) => ({ ...s, root }))}
              style={[styles.miniChoice, settings.root === root && styles.miniChoiceActive]}
            >
              <Text style={[styles.miniChoiceText, settings.root === root && styles.miniChoiceTextActive]}>{root}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.choiceRowWrap}>
          {SCALES.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setSettings((s) => ({ ...s, scale: item.value }))}
              style={[styles.choice, styles.scaleChoice, settings.scale === item.value && styles.choiceActive]}
            >
              <Text style={[styles.choiceText, settings.scale === item.value && styles.choiceTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.dualPanel}>
          <View style={styles.dualCell}>
            <Text style={styles.sectionLabel}>DETAIL</Text>
            <View style={styles.microRow}>
              {MOMENTS.map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setSettings((s) => ({ ...s, moments: value }))}
                  style={[styles.microChoice, settings.moments === value && styles.microChoiceActive]}
                >
                  <Text style={[styles.microText, settings.moments === value && styles.microTextActive]}>{value}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.dualDivider} />
          <View style={styles.dualCell}>
            <Text style={styles.sectionLabel}>TEMPO</Text>
            <View style={styles.microRow}>
              {TEMPOS.map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setSettings((s) => ({ ...s, tempo: value }))}
                  style={[styles.microChoice, settings.tempo === value && styles.microChoiceActive]}
                >
                  <Text style={[styles.microText, settings.tempo === value && styles.microTextActive]}>{value}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <Pressable style={[styles.forgeButton, !pixels && styles.disabled]} onPress={forge} disabled={!pixels || working}>
          <View style={styles.forgeMark}><View style={styles.forgeMarkInner} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.forgeButtonText}>FORGE SCORE</Text>
            <Text style={styles.forgeButtonSub}>{settings.scan.toUpperCase()} · {settings.root} {settings.scale.toUpperCase()} · {settings.moments} MOMENTS</Text>
          </View>
          {busy === "forge" && <ActivityIndicator color={PAPER} />}
        </Pressable>

        {composition && (
          <View style={styles.resultBlock}>
            <View style={styles.resultHeader}>
              <View>
                <Text style={styles.resultKicker}>FORGED</Text>
                <Text style={styles.resultTitle}>{noteCount} NOTE SCORE</Text>
              </View>
              <View style={styles.scoreBadge}><Text style={styles.scoreBadgeText}>{settings.tempo}</Text><Text style={styles.scoreBadgeSub}>BPM</Text></View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bars}>
              {composition.visual.map((moment, index) => (
                <View key={index} style={styles.barSlot}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: 18 + moment.luminance * 70,
                        backgroundColor: hueColor(moment.hue),
                        opacity: 0.55 + moment.saturation * 0.45,
                      },
                    ]}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.metrics}>
              <View style={styles.metric}><Text style={styles.metricValue}>{percent(composition.metrics.luminance)}</Text><Text style={styles.metricLabel}>LIGHT</Text></View>
              <View style={styles.metric}><Text style={styles.metricValue}>{percent(composition.metrics.saturation)}</Text><Text style={styles.metricLabel}>COLOR</Text></View>
              <View style={styles.metric}><Text style={styles.metricValue}>{percent(composition.metrics.edge)}</Text><Text style={styles.metricLabel}>EDGE</Text></View>
              <View style={styles.metric}><Text style={styles.metricValue}>4</Text><Text style={styles.metricLabel}>TRACKS</Text></View>
            </View>

            <Pressable style={styles.previewButton} onPress={preview} disabled={working}>
              {busy === "preview" ? <ActivityIndicator color={PAPER} /> : <Text style={styles.previewText}>▶ PLAY FORGED AUDIO</Text>}
            </Pressable>
            <View style={styles.exportRow}>
              <Pressable style={styles.exportButton} onPress={exportMidi} disabled={working}>
                {busy === "midi" ? <ActivityIndicator color={INK} /> : <><Text style={styles.exportTop}>MIDI</Text><Text style={styles.exportSub}>EXPORT SCORE</Text></>}
              </Pressable>
              <Pressable style={styles.exportButton} onPress={exportWav} disabled={working}>
                {busy === "wav" ? <ActivityIndicator color={INK} /> : <><Text style={styles.exportTop}>WAV</Text><Text style={styles.exportSub}>EXPORT AUDIO</Text></>}
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.statusBox}><View style={styles.statusDot} /><Text style={styles.statusText}>{status}</Text></View>
        <Text style={styles.footer}>Chromaforge · standalone image-to-music instrument</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PAPER },
  scroll: { flex: 1, backgroundColor: PAPER },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 42 },
  prismStrip: { height: 9, flexDirection: "row", gap: 4, marginBottom: 24 },
  prismBlock: { borderRadius: 99 },
  kicker: { color: MUTED, fontSize: 11, letterSpacing: 2.2, fontWeight: "800" },
  title: { color: INK, fontSize: 39, lineHeight: 42, letterSpacing: -1.8, fontWeight: "900", marginTop: 5 },
  lead: { color: "#383634", fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 22, maxWidth: 360 },
  imageStage: { height: 255, borderWidth: 2, borderColor: INK, backgroundColor: "#E9E1D5", overflow: "hidden", position: "relative" },
  image: { width: "100%", height: "100%" },
  emptyImage: { flex: 1, alignItems: "center", justifyContent: "center" },
  aperture: { width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: INK, marginBottom: 15, position: "relative" },
  apertureDot: { width: 23, height: 23, borderRadius: 12, position: "absolute", borderWidth: 2, borderColor: INK },
  emptyTitle: { color: INK, fontSize: 16, fontWeight: "900", letterSpacing: 1.4 },
  emptyText: { color: MUTED, fontSize: 12, marginTop: 4 },
  busyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(246,240,231,0.75)", alignItems: "center", justifyContent: "center" },
  sectionLabel: { color: MUTED, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginTop: 21, marginBottom: 9 },
  choiceRow: { flexDirection: "row", gap: 8 },
  choiceRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { flex: 1, minHeight: 42, borderWidth: 1.5, borderColor: LINE, alignItems: "center", justifyContent: "center", paddingHorizontal: 9, backgroundColor: "#FBF8F2" },
  choiceActive: { backgroundColor: INK, borderColor: INK },
  choiceText: { color: "#4A4743", fontSize: 12, fontWeight: "800" },
  choiceTextActive: { color: PAPER },
  scaleChoice: { flexBasis: "46%", flexGrow: 1 },
  horizontalChoices: { gap: 7, paddingRight: 10 },
  miniChoice: { width: 46, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: LINE, backgroundColor: "#FBF8F2" },
  miniChoiceActive: { backgroundColor: CORAL, borderColor: INK },
  miniChoiceText: { color: INK, fontSize: 14, fontWeight: "900" },
  miniChoiceTextActive: { color: INK },
  dualPanel: { flexDirection: "row", borderWidth: 1.5, borderColor: INK, marginTop: 22, paddingHorizontal: 12, paddingBottom: 14 },
  dualCell: { flex: 1 },
  dualDivider: { width: 1.5, backgroundColor: INK, marginHorizontal: 12 },
  microRow: { flexDirection: "row", gap: 5 },
  microChoice: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", backgroundColor: "#E8E0D6" },
  microChoiceActive: { backgroundColor: GOLD },
  microText: { color: INK, fontSize: 11, fontWeight: "800" },
  microTextActive: { fontWeight: "900" },
  forgeButton: { minHeight: 82, backgroundColor: INK, marginTop: 18, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 13 },
  disabled: { opacity: 0.38 },
  forgeMark: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: CORAL, alignItems: "center", justifyContent: "center" },
  forgeMarkInner: { width: 17, height: 17, backgroundColor: CORAL, transform: [{ rotate: "45deg" }] },
  forgeButtonText: { color: PAPER, fontSize: 17, fontWeight: "900", letterSpacing: 0.8 },
  forgeButtonSub: { color: "#BDB6AD", fontSize: 9, fontWeight: "700", letterSpacing: 0.55, marginTop: 4 },
  resultBlock: { marginTop: 22, borderWidth: 2, borderColor: INK, backgroundColor: "#FFFDF8", padding: 15 },
  resultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultKicker: { color: CORAL, fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  resultTitle: { color: INK, fontSize: 23, fontWeight: "900", letterSpacing: -0.5, marginTop: 2 },
  scoreBadge: { width: 60, height: 60, borderRadius: 30, backgroundColor: VIOLET, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: INK },
  scoreBadgeText: { color: "white", fontSize: 19, fontWeight: "900", lineHeight: 20 },
  scoreBadgeSub: { color: "white", fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  bars: { height: 105, alignItems: "flex-end", paddingTop: 12, paddingBottom: 6, gap: 3 },
  barSlot: { width: 6, height: 88, justifyContent: "flex-end" },
  bar: { width: 6, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  metrics: { flexDirection: "row", borderTopWidth: 1.5, borderTopColor: INK, borderBottomWidth: 1.5, borderBottomColor: INK, paddingVertical: 12, marginBottom: 13 },
  metric: { flex: 1, alignItems: "center" },
  metricValue: { color: INK, fontSize: 16, fontWeight: "900" },
  metricLabel: { color: MUTED, fontSize: 8, fontWeight: "900", letterSpacing: 1, marginTop: 2 },
  previewButton: { height: 51, backgroundColor: VIOLET, borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" },
  previewText: { color: "white", fontSize: 13, fontWeight: "900", letterSpacing: 0.8 },
  exportRow: { flexDirection: "row", gap: 9, marginTop: 9 },
  exportButton: { flex: 1, height: 61, borderWidth: 1.5, borderColor: INK, alignItems: "center", justifyContent: "center", backgroundColor: PAPER },
  exportTop: { color: INK, fontSize: 15, fontWeight: "900" },
  exportSub: { color: MUTED, fontSize: 8, fontWeight: "900", letterSpacing: 0.9, marginTop: 2 },
  statusBox: { marginTop: 17, flexDirection: "row", alignItems: "flex-start", backgroundColor: "#E9E1D5", padding: 12, gap: 9 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: AQUA, marginTop: 4, borderWidth: 1, borderColor: INK },
  statusText: { flex: 1, color: "#4D4944", fontSize: 11, lineHeight: 16, fontWeight: "600" },
  footer: { color: "#999187", textAlign: "center", fontSize: 9, marginTop: 22, letterSpacing: 0.5 },
});
