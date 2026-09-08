/**
 * BioSonify Image Music
 *
 * Turns the same image pixel field used by the core BioSonify engines into
 * multi-track keyed music, MIDI, and WAV. This is the image-first integration
 * layer for the Erin Braswell data→MIDI concepts.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";

import { ScreenContainer } from "@/components/screen-container";
import { useImagePixels } from "@/lib/use-image-pixels";
import {
  DEFAULT_MUSICAL_OPTIONS,
  DEFAULT_SOURCES,
  KEY_CHOICES,
  arrayBufferToBase64,
  bytesToBase64,
  encodeMidi,
  renderPreviewWavAsync,
  tableToTracks,
  type KeyName,
  type MusicalOptions,
  type ParsedNumericTable,
  type SourceChoice,
} from "@/lib/erin-musical-sonify";
import type { PixelData } from "@/lib/sonification-engine";

const BG = "#080D12";
const SURFACE = "#111820";
const SURFACE_2 = "#17212B";
const BORDER = "#2A3744";
const TEXT = "#F3F7FA";
const MUTED = "#91A0AE";
const ACCENT = "#34E3A4";
const HOT = "#FFB84D";

const STEP_CHOICES = [16, 32, 48, 64] as const;
type Geometry = "radial" | "columns" | "rows";
const GEOMETRIES: { id: Geometry; label: string; hint: string }[] = [
  { id: "radial", label: "RADIAL", hint: "center → outer field" },
  { id: "columns", label: "X FIELD", hint: "left → right structure" },
  { id: "rows", label: "Y FIELD", hint: "top → bottom structure" },
];

const IMAGE_HEADERS = [
  "time",
  "luminance",
  "red",
  "green",
  "blue",
  "saturation",
  "hue",
  "contrast",
  "edge_motion",
];

function hue255(r: number, g: number, b: number): number {
  const angle = Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b);
  const normalized = (angle + Math.PI) / (Math.PI * 2);
  return normalized * 255;
}

function stats(pixels: PixelData[]): [number, number, number, number, number, number, number] {
  if (!pixels.length) return [0, 0, 0, 0, 0, 0, 0];
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let lumSum = 0;
  let lumSq = 0;
  let satSum = 0;
  let hueX = 0;
  let hueY = 0;

  for (const p of pixels) {
    const r = p.r;
    const g = p.g;
    const b = p.b;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max - min;
    const h = (hue255(r, g, b) / 255) * Math.PI * 2;
    sr += r;
    sg += g;
    sb += b;
    lumSum += lum;
    lumSq += lum * lum;
    satSum += sat;
    hueX += Math.cos(h);
    hueY += Math.sin(h);
  }

  const n = pixels.length;
  const lum = lumSum / n;
  const variance = Math.max(0, lumSq / n - lum * lum);
  let angle = Math.atan2(hueY / n, hueX / n);
  if (angle < 0) angle += Math.PI * 2;
  const hue = (angle / (Math.PI * 2)) * 255;
  return [lum, sr / n, sg / n, sb / n, satSum / n, hue, Math.sqrt(variance)];
}

function imageToTable(
  pixels: PixelData[],
  width: number,
  height: number,
  steps: number,
  geometry: Geometry,
): ParsedNumericTable {
  if (!pixels.length || width <= 0 || height <= 0) {
    throw new Error("No image pixels were available.");
  }

  const buckets: PixelData[][] = Array.from({ length: steps }, () => []);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const maxRadius = Math.sqrt(cx * cx + cy * cy) || 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = pixels[y * width + x];
      if (!p) continue;
      let t = 0;
      if (geometry === "columns") {
        t = x / Math.max(1, width - 1);
      } else if (geometry === "rows") {
        t = y / Math.max(1, height - 1);
      } else {
        const dx = x - cx;
        const dy = y - cy;
        t = Math.sqrt(dx * dx + dy * dy) / maxRadius;
      }
      const bucket = Math.min(steps - 1, Math.max(0, Math.floor(t * steps)));
      buckets[bucket].push(p);
    }
  }

  const rows: number[][] = [];
  let previousLum = 0;
  buckets.forEach((bucket, i) => {
    const [lum, r, g, b, sat, hue, contrast] = stats(bucket);
    const edge = i === 0 ? 0 : Math.abs(lum - previousLum) + contrast * 0.5;
    previousLum = lum;
    rows.push([i * 0.5, lum, r, g, b, sat, hue, contrast, edge]);
  });

  return { headers: IMAGE_HEADERS, rows, delimiter: "," };
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "image";
}

export default function ImageMusicScreen() {
  const player = useAudioPlayer(null);
  const { extractPixels, isExtracting } = useImagePixels();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageLabel, setImageLabel] = useState("No image loaded");
  const [table, setTable] = useState<ParsedNumericTable | null>(null);
  const [geometry, setGeometry] = useState<Geometry>("radial");
  const [steps, setSteps] = useState<number>(32);
  const [key, setKey] = useState<KeyName | null>("c_major");
  const [tempo, setTempo] = useState(108);
  const [busy, setBusy] = useState<"analyze" | "preview" | "midi" | "wav" | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Pick an image. BioSonify will turn its field structure into music.");

  useEffect(() => () => player.release(), [player]);

  const sourceMap = useMemo<Record<number, SourceChoice>>(
    () => ({
      1: DEFAULT_SOURCES[0],
      6: DEFAULT_SOURCES[2],
      5: DEFAULT_SOURCES[1],
      8: DEFAULT_SOURCES[5],
    }),
    [],
  );

  const options = useMemo<MusicalOptions>(() => ({
    ...DEFAULT_MUSICAL_OPTIONS,
    key,
    tempoBpm: tempo,
    quantizeStep: 0.5,
    noteDurationBeats: 0.45,
    velocity: 92,
    octaveStart: 1,
    numberOfOctaves: 5,
    midiMin: 32,
    midiMax: 100,
    normalizeTime: true,
  }), [key, tempo]);

  const tracks = useMemo(() => {
    if (!table) return [];
    return tableToTracks(table, 0, [1, 6, 5, 8], sourceMap);
  }, [table, sourceMap]);

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Allow photo access so BioSonify can analyze an image.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 1, allowsEditing: false });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageLabel(asset.fileName ?? asset.uri.split("/").pop() ?? "image");
      setTable(null);
      setStatus("Image loaded. Press BUILD IMAGE MUSIC.");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Image load failed", String(e));
    }
  };

  const analyze = async () => {
    if (!imageUri) {
      Alert.alert("Pick an image first");
      return;
    }
    setBusy("analyze");
    setProgress(0);
    try {
      const result = await extractPixels(imageUri);
      const next = imageToTable(result.pixels, result.width, result.height, steps, geometry);
      setTable(next);
      setStatus(`${steps} image-field moments built · 4 musical tracks · ${geometry.toUpperCase()} geometry.`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Image analysis failed", String(e));
    } finally {
      setBusy(null);
    }
  };

  const preview = async () => {
    if (!tracks.length) {
      await analyze();
      return;
    }
    setBusy("preview");
    setProgress(0);
    try {
      const wav = await renderPreviewWavAsync(tracks, options, 44100, 60, setProgress);
      const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!base) throw new Error("No writable cache directory.");
      const uri = `${base}biosonify-image-music-preview.wav`;
      await FileSystem.writeAsStringAsync(uri, arrayBufferToBase64(wav), {
        encoding: FileSystem.EncodingType.Base64,
      });
      player.replace({ uri });
      player.play();
      setStatus(`Playing image music · ${tempo} BPM · ${KEY_CHOICES.find((k) => k.value === key)?.label ?? "Chromatic"}.`);
    } catch (e) {
      Alert.alert("Preview failed", String(e));
    } finally {
      setBusy(null);
      setProgress(0);
    }
  };

  const exportMidi = async () => {
    if (!tracks.length) {
      Alert.alert("Build the image music first.");
      return;
    }
    setBusy("midi");
    try {
      const midi = encodeMidi(tracks, options);
      const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!base) throw new Error("No writable directory.");
      const uri = `${base}${safeName(imageLabel)}_BioSonify.mid`;
      await FileSystem.writeAsStringAsync(uri, bytesToBase64(midi), {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "audio/midi", dialogTitle: "Export BioSonify Image MIDI" });
      }
      setStatus("Image MIDI exported.");
    } catch (e) {
      Alert.alert("MIDI export failed", String(e));
    } finally {
      setBusy(null);
    }
  };

  const exportWav = async () => {
    if (!tracks.length) {
      Alert.alert("Build the image music first.");
      return;
    }
    setBusy("wav");
    setProgress(0);
    try {
      const wav = await renderPreviewWavAsync(tracks, options, 44100, 60, setProgress);
      const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!base) throw new Error("No writable directory.");
      const uri = `${base}${safeName(imageLabel)}_BioSonify.wav`;
      await FileSystem.writeAsStringAsync(uri, arrayBufferToBase64(wav), {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "audio/wav", dialogTitle: "Export BioSonify Image WAV" });
      }
      setStatus("Image WAV exported.");
    } catch (e) {
      Alert.alert("WAV export failed", String(e));
    } finally {
      setBusy(null);
      setProgress(0);
    }
  };

  const cycleKey = () => {
    const useful = KEY_CHOICES.filter((k) => k.value === null || String(k.value).endsWith("_major"));
    const index = Math.max(0, useful.findIndex((k) => k.value === key));
    setKey(useful[(index + 1) % useful.length].value);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-background">
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>R3 · IMAGE MUSICAL ENGINE</Text>
          <Text style={styles.title}>Image → Music</Text>
          <Text style={styles.subtitle}>
            Your BioSonify pixel field becomes melody, harmony, texture, rhythm, MIDI, and WAV. Offline.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>1 · IMAGE FIELD</Text>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderText}>NO IMAGE</Text>
            </View>
          )}
          <Text style={styles.meta}>{imageLabel}</Text>
          <Pressable style={styles.primaryButton} onPress={pickImage} disabled={busy !== null}>
            <Text style={styles.primaryText}>PICK IMAGE</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>2 · STRUCTURE MAPPING</Text>
          <View style={styles.wrap}>
            {GEOMETRIES.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => { setGeometry(g.id); setTable(null); }}
                style={[styles.chip, geometry === g.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, geometry === g.id && styles.chipTextActive]}>{g.label}</Text>
                <Text style={styles.chipHint}>{g.hint}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>DETAIL</Text>
          <View style={styles.wrap}>
            {STEP_CHOICES.map((n) => (
              <Pressable
                key={n}
                onPress={() => { setSteps(n); setTable(null); }}
                style={[styles.miniChip, steps === n && styles.miniChipActive]}
              >
                <Text style={[styles.miniText, steps === n && styles.chipTextActive]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>MUSICAL KEY</Text>
          <Pressable style={styles.selector} onPress={cycleKey}>
            <Text style={styles.selectorText}>{KEY_CHOICES.find((k) => k.value === key)?.label ?? "Chromatic / raw"}</Text>
            <Text style={styles.selectorHint}>tap to cycle</Text>
          </Pressable>

          <Text style={styles.sectionLabel}>TEMPO</Text>
          <View style={styles.tempoRow}>
            <Pressable style={styles.tempoButton} onPress={() => setTempo((v) => Math.max(40, v - 8))}>
              <Text style={styles.tempoButtonText}>−</Text>
            </Pressable>
            <Text style={styles.tempoValue}>{tempo} BPM</Text>
            <Pressable style={styles.tempoButton} onPress={() => setTempo((v) => Math.min(220, v + 8))}>
              <Text style={styles.tempoButtonText}>+</Text>
            </Pressable>
          </View>

          <Pressable style={styles.buildButton} onPress={analyze} disabled={!imageUri || busy !== null}>
            {(busy === "analyze" || isExtracting) ? <ActivityIndicator color={BG} /> : <Text style={styles.buildText}>BUILD IMAGE MUSIC</Text>}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>3 · WHAT THE IMAGE DRIVES</Text>
          <View style={styles.signalGrid}>
            {[
              ["LUMINANCE", "melody"],
              ["HUE", "harmonic color"],
              ["SATURATION", "texture"],
              ["EDGE MOTION", "percussion"],
            ].map(([a, b]) => (
              <View key={a} style={styles.signalCell}>
                <Text style={styles.signalMain}>{a}</Text>
                <Text style={styles.signalSub}>{b}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.status}>{status}</Text>
          {busy && busy !== "analyze" && progress > 0 ? (
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} /></View>
          ) : null}
        </View>

        <View style={styles.actionGrid}>
          <Pressable style={[styles.action, !tracks.length && styles.disabled]} onPress={preview} disabled={busy !== null || !imageUri}>
            <Text style={styles.actionTitle}>▶ PREVIEW</Text>
            <Text style={styles.actionSub}>hear the image</Text>
          </Pressable>
          <Pressable style={[styles.action, !tracks.length && styles.disabled]} onPress={exportMidi} disabled={busy !== null || !tracks.length}>
            <Text style={styles.actionTitle}>MIDI</Text>
            <Text style={styles.actionSub}>editable notes</Text>
          </Pressable>
          <Pressable style={[styles.action, !tracks.length && styles.disabled]} onPress={exportWav} disabled={busy !== null || !tracks.length}>
            <Text style={styles.actionTitle}>WAV</Text>
            <Text style={styles.actionSub}>rendered audio</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Erin Braswell sonify concepts + BioSonify image-field extraction · deterministic offline mapping
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 110, gap: 14 },
  hero: { paddingVertical: 12 },
  kicker: { color: ACCENT, fontSize: 11, fontWeight: "900", letterSpacing: 1.6 },
  title: { color: TEXT, fontSize: 34, fontWeight: "900", marginTop: 5 },
  subtitle: { color: MUTED, fontSize: 14, lineHeight: 20, marginTop: 7 },
  card: { backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 18, padding: 14, gap: 11 },
  cardTitle: { color: TEXT, fontSize: 13, fontWeight: "900", letterSpacing: 1.1 },
  image: { width: "100%", height: 220, borderRadius: 14, backgroundColor: SURFACE_2 },
  imagePlaceholder: { width: "100%", height: 160, borderRadius: 14, backgroundColor: SURFACE_2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: BORDER, borderStyle: "dashed" },
  placeholderText: { color: MUTED, fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  meta: { color: MUTED, fontSize: 12 },
  primaryButton: { backgroundColor: SURFACE_2, borderColor: ACCENT, borderWidth: 1, borderRadius: 12, minHeight: 46, alignItems: "center", justifyContent: "center" },
  primaryText: { color: ACCENT, fontWeight: "900", letterSpacing: 1 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexGrow: 1, minWidth: 96, backgroundColor: SURFACE_2, borderColor: BORDER, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10 },
  chipActive: { borderColor: ACCENT, backgroundColor: "#123126" },
  chipText: { color: MUTED, fontSize: 11, fontWeight: "900" },
  chipTextActive: { color: ACCENT },
  chipHint: { color: "#6F7D89", fontSize: 9, marginTop: 3 },
  miniChip: { minWidth: 54, alignItems: "center", backgroundColor: SURFACE_2, borderRadius: 10, borderWidth: 1, borderColor: BORDER, paddingVertical: 9 },
  miniChipActive: { borderColor: ACCENT },
  miniText: { color: MUTED, fontWeight: "800" },
  sectionLabel: { color: HOT, fontSize: 10, fontWeight: "900", letterSpacing: 1.1, marginTop: 5 },
  selector: { backgroundColor: SURFACE_2, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectorText: { color: TEXT, fontWeight: "800" },
  selectorHint: { color: MUTED, fontSize: 10 },
  tempoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 22 },
  tempoButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: SURFACE_2, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" },
  tempoButtonText: { color: ACCENT, fontSize: 23, fontWeight: "500" },
  tempoValue: { color: TEXT, fontSize: 20, fontWeight: "900", minWidth: 105, textAlign: "center" },
  buildButton: { backgroundColor: ACCENT, borderRadius: 14, minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: 4 },
  buildText: { color: BG, fontWeight: "900", letterSpacing: 1.2 },
  signalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  signalCell: { width: "48%", flexGrow: 1, backgroundColor: SURFACE_2, borderRadius: 11, padding: 10 },
  signalMain: { color: TEXT, fontSize: 10, fontWeight: "900" },
  signalSub: { color: MUTED, fontSize: 10, marginTop: 2 },
  status: { color: MUTED, fontSize: 12, lineHeight: 18 },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: SURFACE_2, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: ACCENT },
  actionGrid: { flexDirection: "row", gap: 8 },
  action: { flex: 1, backgroundColor: SURFACE, borderRadius: 14, borderWidth: 1, borderColor: BORDER, paddingVertical: 14, paddingHorizontal: 8, alignItems: "center" },
  disabled: { opacity: 0.4 },
  actionTitle: { color: ACCENT, fontSize: 12, fontWeight: "900" },
  actionSub: { color: MUTED, fontSize: 9, marginTop: 4, textAlign: "center" },
  footer: { color: "#596875", fontSize: 10, lineHeight: 15, textAlign: "center", paddingHorizontal: 12, marginTop: 5 },
});
