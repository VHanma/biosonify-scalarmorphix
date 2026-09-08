/**
 * Musical Sonify
 * Mobile data→MIDI workflow adapted from erinspace/sonify.
 * Works offline: CSV/TXT import, key locking, timing quantization, GM sources,
 * percussion, multi-track MIDI export, and rendered WAV preview.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";

import { ScreenContainer } from "@/components/screen-container";
import {
  ALL_SOURCES,
  DEFAULT_MUSICAL_OPTIONS,
  DEFAULT_SOURCES,
  DEMO_CSV,
  KEY_CHOICES,
  arrayBufferToBase64,
  bytesToBase64,
  encodeMidi,
  parseNumericTable,
  prepareTracks,
  renderPreviewWavAsync,
  tableToTracks,
  type KeyName,
  type MusicalOptions,
  type ParsedNumericTable,
  type SourceChoice,
} from "@/lib/erin-musical-sonify";

const ACCENT = "#2ECC9A";
const BG = "#0D1117";
const SURFACE = "#161B22";
const BORDER = "#30363D";
const TEXT = "#F0F6FC";
const MUTED = "#8B949E";
const WARNING = "#F0A500";

const QUANTIZE_CHOICES = [0.125, 0.25, 0.5, 1, 2];
const OCTAVE_CHOICES = [1, 2, 3, 4, 5, 6];
const DURATION_CHOICES = [0.125, 0.25, 0.5, 1, 2];

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "sonify";
}

function formatSource(source: SourceChoice): string {
  return source.kind === "percussion" ? `Drum · ${source.label}` : source.label;
}

export default function MusicalSonifyScreen() {
  const player = useAudioPlayer(null);
  const initial = useMemo(() => parseNumericTable(DEMO_CSV), []);
  const [rawText, setRawText] = useState(DEMO_CSV);
  const [table, setTable] = useState<ParsedNumericTable>(initial);
  const [fileLabel, setFileLabel] = useState("Built-in demo");
  const [xColumn, setXColumn] = useState(0);
  const [yColumns, setYColumns] = useState<number[]>([1]);
  const [sourceByColumn, setSourceByColumn] = useState<Record<number, SourceChoice>>({
    1: DEFAULT_SOURCES[0],
  });
  const [options, setOptions] = useState<MusicalOptions>(DEFAULT_MUSICAL_OPTIONS);
  const [tempoText, setTempoText] = useState(String(DEFAULT_MUSICAL_OPTIONS.tempoBpm));
  const [midiMinText, setMidiMinText] = useState(String(DEFAULT_MUSICAL_OPTIONS.midiMin));
  const [midiMaxText, setMidiMaxText] = useState(String(DEFAULT_MUSICAL_OPTIONS.midiMax));
  const [busy, setBusy] = useState<"preview" | "midi" | "wav" | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Load data or use the demo, then choose what becomes pitch.");
  const [keyModal, setKeyModal] = useState(false);
  const [sourceModalColumn, setSourceModalColumn] = useState<number | null>(null);
  const [sourceSearch, setSourceSearch] = useState("");

  useEffect(() => () => player.release(), [player]);

  const selectedKeyLabel = KEY_CHOICES.find((k) => k.value === options.key)?.label ?? "Chromatic / raw";

  const filteredSources = useMemo(() => {
    const q = sourceSearch.trim().toLowerCase();
    if (!q) return ALL_SOURCES;
    return ALL_SOURCES.filter((s) => `${s.kind} ${s.label}`.toLowerCase().includes(q));
  }, [sourceSearch]);

  const sourceFor = (column: number, position = 0): SourceChoice =>
    sourceByColumn[column] ?? DEFAULT_SOURCES[position % DEFAULT_SOURCES.length];

  const normalizedOptions = (): MusicalOptions => {
    const tempo = Number(tempoText);
    const midiMin = Number(midiMinText);
    const midiMax = Number(midiMaxText);
    return {
      ...options,
      tempoBpm: Number.isFinite(tempo) ? Math.max(20, Math.min(400, tempo)) : 120,
      midiMin: Number.isFinite(midiMin) ? Math.max(0, Math.min(127, Math.round(midiMin))) : 36,
      midiMax: Number.isFinite(midiMax) ? Math.max(0, Math.min(127, Math.round(midiMax))) : 96,
    };
  };

  const buildTracks = () => {
    if (yColumns.length === 0) throw new Error("Choose at least one Y / pitch column.");
    const map: Record<number, SourceChoice> = {};
    yColumns.forEach((col, i) => { map[col] = sourceFor(col, i); });
    const tracks = tableToTracks(table, xColumn, yColumns, map);
    if (tracks.length === 0) throw new Error("No numeric notes could be made from the selected columns.");
    return tracks;
  };

  const parseText = () => {
    try {
      const parsed = parseNumericTable(rawText);
      setTable(parsed);
      setXColumn(0);
      const defaultY = parsed.headers.length > 1 ? [1] : [];
      setYColumns(defaultY);
      setSourceByColumn(defaultY.length ? { [defaultY[0]]: DEFAULT_SOURCES[0] } : {});
      setFileLabel("Pasted / edited data");
      setStatus(`${parsed.rows.length} rows · ${parsed.headers.length} columns parsed.`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Could not parse data", String(e));
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/plain", "text/tab-separated-values", "application/csv", "application/vnd.ms-excel", "*/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const text = await FileSystem.readAsStringAsync(asset.uri);
      const parsed = parseNumericTable(text);
      setRawText(text);
      setTable(parsed);
      setFileLabel(asset.name ?? "Imported data");
      setXColumn(0);
      const defaultY = parsed.headers.length > 1 ? [1] : [];
      setYColumns(defaultY);
      setSourceByColumn(defaultY.length ? { [defaultY[0]]: DEFAULT_SOURCES[0] } : {});
      setStatus(`${parsed.rows.length} rows imported from ${asset.name ?? "file"}.`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Import failed", String(e));
    }
  };

  const toggleY = (column: number) => {
    if (column === xColumn) return;
    setYColumns((current) => {
      if (current.includes(column)) return current.filter((c) => c !== column);
      if (current.length >= 12) {
        Alert.alert("Track limit", "Choose up to 12 simultaneous tracks for phone playback.");
        return current;
      }
      const next = [...current, column];
      if (!sourceByColumn[column]) {
        setSourceByColumn((m) => ({ ...m, [column]: DEFAULT_SOURCES[current.length % DEFAULT_SOURCES.length] }));
      }
      return next;
    });
  };

  const makePreview = async () => {
    setBusy("preview");
    setProgress(0);
    try {
      const tracks = buildTracks();
      const opts = normalizedOptions();
      if (opts.midiMin > opts.midiMax) throw new Error("MIDI minimum must be less than or equal to maximum.");
      const wav = await renderPreviewWavAsync(tracks, opts, 44100, 60, setProgress);
      const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!base) throw new Error("No writable cache directory is available.");
      const uri = `${base}musical-sonify-preview.wav`;
      await FileSystem.writeAsStringAsync(uri, arrayBufferToBase64(wav), { encoding: FileSystem.EncodingType.Base64 });
      player.replace({ uri });
      player.play();
      setStatus(`Playing ${tracks.length} track${tracks.length === 1 ? "" : "s"} · ${opts.tempoBpm} BPM · ${selectedKeyLabel}.`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Preview failed", String(e));
      setStatus("Preview failed. Check the selected columns and mapping range.");
    } finally {
      setBusy(null);
      setProgress(0);
    }
  };

  const exportMidi = async () => {
    setBusy("midi");
    try {
      const tracks = buildTracks();
      const opts = normalizedOptions();
      if (opts.midiMin > opts.midiMax) throw new Error("MIDI minimum must be less than or equal to maximum.");
      const midi = encodeMidi(tracks, opts);
      const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!base) throw new Error("No writable directory is available.");
      const uri = `${base}${safeName(fileLabel)}_${opts.tempoBpm}bpm.mid`;
      await FileSystem.writeAsStringAsync(uri, bytesToBase64(midi), { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "audio/midi", dialogTitle: "Export Musical Sonify MIDI" });
      }
      setStatus(`MIDI exported · ${tracks.length} track${tracks.length === 1 ? "" : "s"}.`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("MIDI export failed", String(e));
    } finally {
      setBusy(null);
    }
  };

  const exportWav = async () => {
    setBusy("wav");
    setProgress(0);
    try {
      const tracks = buildTracks();
      const opts = normalizedOptions();
      if (opts.midiMin > opts.midiMax) throw new Error("MIDI minimum must be less than or equal to maximum.");
      const wav = await renderPreviewWavAsync(tracks, opts, 44100, 60, setProgress);
      const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!base) throw new Error("No writable directory is available.");
      const uri = `${base}${safeName(fileLabel)}_${opts.tempoBpm}bpm.wav`;
      await FileSystem.writeAsStringAsync(uri, arrayBufferToBase64(wav), { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "audio/wav", dialogTitle: "Export Musical Sonify WAV" });
      }
      setStatus("Rendered WAV exported.");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("WAV export failed", String(e));
    } finally {
      setBusy(null);
      setProgress(0);
    }
  };

  const previewPrepared = () => {
    try {
      const tracks = prepareTracks(buildTracks(), normalizedOptions());
      const sample = tracks[0]?.points.slice(0, 6) ?? [];
      if (!sample.length) return "No mapped notes";
      return sample.map((p) => `${p.x.toFixed(2)}→${Math.round(p.y)}`).join("  ");
    } catch {
      return "Mapping unavailable";
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-background">
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>ERINSPACE ENGINE · MOBILE PORT</Text>
        <Text style={styles.title}>Musical Sonify</Text>
        <Text style={styles.subtitle}>
          Turn numeric data into keyed music, percussion, multi-track MIDI, and a phone-playable WAV. Everything runs offline.
        </Text>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>1 · Data</Text>
              <Text style={styles.meta}>{fileLabel}</Text>
            </View>
            <Pressable style={styles.smallButton} onPress={pickFile}>
              <Text style={styles.smallButtonText}>LOAD CSV/TXT</Text>
            </Pressable>
          </View>
          <TextInput
            value={rawText}
            onChangeText={setRawText}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.dataInput}
            placeholder="time,value\n0,10\n1,20"
            placeholderTextColor="#5B6570"
          />
          <Pressable style={styles.secondaryButton} onPress={parseText}>
            <Text style={styles.secondaryButtonText}>PARSE TEXT</Text>
          </Pressable>
          <Text style={styles.meta}>{table.rows.length} rows · {table.headers.length} columns</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>2 · Time column (X)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {table.headers.map((header, i) => (
              <Pressable
                key={`x-${i}`}
                onPress={() => {
                  setXColumn(i);
                  setYColumns((ys) => ys.filter((y) => y !== i));
                }}
                style={[styles.chip, xColumn === i && styles.chipActive]}
              >
                <Text style={[styles.chipText, xColumn === i && styles.chipTextActive]}>{header}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.cardTitle, { marginTop: 18 }]}>Pitch / track columns (Y)</Text>
          <View style={styles.wrap}>
            {table.headers.map((header, i) => {
              const selected = yColumns.includes(i);
              const disabled = i === xColumn;
              return (
                <Pressable
                  key={`y-${i}`}
                  disabled={disabled}
                  onPress={() => toggleY(i)}
                  style={[styles.chip, selected && styles.chipActive, disabled && styles.chipDisabled]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive, disabled && styles.chipTextDisabled]}>{header}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {yColumns.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>3 · Track instruments</Text>
            {yColumns.map((column, i) => {
              const source = sourceFor(column, i);
              return (
                <Pressable
                  key={`source-${column}`}
                  onPress={() => { setSourceModalColumn(column); setSourceSearch(""); }}
                  style={styles.trackRow}
                >
                  <View style={styles.trackIndex}><Text style={styles.trackIndexText}>{i + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trackName}>{table.headers[column]}</Text>
                    <Text style={styles.trackSource}>{formatSource(source)}</Text>
                  </View>
                  <Text style={styles.change}>CHANGE</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>4 · Musical mapping</Text>
          <Text style={styles.label}>Key</Text>
          <Pressable style={styles.selectButton} onPress={() => setKeyModal(true)}>
            <Text style={styles.selectText}>{selectedKeyLabel}</Text>
            <Text style={styles.selectArrow}>▼</Text>
          </Pressable>

          <Text style={styles.label}>Octave span</Text>
          <View style={styles.wrap}>
            {OCTAVE_CHOICES.map((value) => (
              <Pressable key={value} onPress={() => setOptions((o) => ({ ...o, numberOfOctaves: value }))}
                style={[styles.chip, options.numberOfOctaves === value && styles.chipActive]}>
                <Text style={[styles.chipText, options.numberOfOctaves === value && styles.chipTextActive]}>{value}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Timing quantize (beats)</Text>
          <View style={styles.wrap}>
            {QUANTIZE_CHOICES.map((value) => (
              <Pressable key={value} onPress={() => setOptions((o) => ({ ...o, quantizeStep: value }))}
                style={[styles.chip, options.quantizeStep === value && styles.chipActive]}>
                <Text style={[styles.chipText, options.quantizeStep === value && styles.chipTextActive]}>{value}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Note length (beats)</Text>
          <View style={styles.wrap}>
            {DURATION_CHOICES.map((value) => (
              <Pressable key={value} onPress={() => setOptions((o) => ({ ...o, noteDurationBeats: value }))}
                style={[styles.chip, options.noteDurationBeats === value && styles.chipActive]}>
                <Text style={[styles.chipText, options.noteDurationBeats === value && styles.chipTextActive]}>{value}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Tempo BPM</Text>
              <TextInput value={tempoText} onChangeText={setTempoText} keyboardType="numeric" style={styles.numberInput} />
            </View>
            <View style={{ width: 14 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Velocity</Text>
              <TextInput
                value={String(options.velocity)}
                onChangeText={(v) => {
                  const n = Number(v);
                  if (Number.isFinite(n)) setOptions((o) => ({ ...o, velocity: Math.max(1, Math.min(127, Math.round(n))) }));
                }}
                keyboardType="numeric"
                style={styles.numberInput}
              />
            </View>
          </View>

          {options.key === null && (
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>MIDI min</Text>
                <TextInput value={midiMinText} onChangeText={setMidiMinText} keyboardType="numeric" style={styles.numberInput} />
              </View>
              <View style={{ width: 14 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>MIDI max</Text>
                <TextInput value={midiMaxText} onChangeText={setMidiMaxText} keyboardType="numeric" style={styles.numberInput} />
              </View>
            </View>
          )}

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.labelInline}>Normalize time to zero</Text>
              <Text style={styles.meta}>Keeps timestamps from creating giant silent gaps.</Text>
            </View>
            <Switch
              value={options.normalizeTime}
              onValueChange={(v) => setOptions((o) => ({ ...o, normalizeTime: v }))}
              trackColor={{ false: "#30363D", true: "#1F6F58" }}
              thumbColor={options.normalizeTime ? ACCENT : "#8B949E"}
            />
          </View>
        </View>

        <View style={styles.mappingCard}>
          <Text style={styles.mappingTitle}>Mapped note sample</Text>
          <Text style={styles.mappingText}>{previewPrepared()}</Text>
          <Text style={styles.mappingHint}>format: beat → MIDI note</Text>
        </View>

        <View style={styles.actionGrid}>
          <Pressable disabled={busy !== null} onPress={makePreview} style={[styles.primaryButton, busy !== null && styles.disabledButton]}>
            {busy === "preview" ? <ActivityIndicator color="#0D1117" /> : <Text style={styles.primaryButtonText}>▶ PLAY WAV</Text>}
          </Pressable>
          <Pressable disabled={busy !== null} onPress={() => player.pause()} style={styles.darkButton}>
            <Text style={styles.darkButtonText}>Ⅱ PAUSE</Text>
          </Pressable>
          <Pressable disabled={busy !== null} onPress={exportMidi} style={[styles.exportButton, busy !== null && styles.disabledButton]}>
            {busy === "midi" ? <ActivityIndicator color={TEXT} /> : <Text style={styles.exportButtonText}>⇩ EXPORT MIDI</Text>}
          </Pressable>
          <Pressable disabled={busy !== null} onPress={exportWav} style={[styles.exportButton, busy !== null && styles.disabledButton]}>
            {busy === "wav" ? <ActivityIndicator color={TEXT} /> : <Text style={styles.exportButtonText}>⇩ EXPORT WAV</Text>}
          </Pressable>
        </View>

        {busy && progress > 0 && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        )}
        <Text style={styles.status}>{status}</Text>
        <Text style={styles.credit}>Core mapping model adapted from Erin Braswell's erinspace/sonify (MIT).</Text>
        <View style={{ height: Platform.OS === "web" ? 30 : 80 }} />
      </ScrollView>

      <Modal visible={keyModal} transparent animationType="fade" onRequestClose={() => setKeyModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setKeyModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Choose key</Text>
            {KEY_CHOICES.map((choice) => (
              <Pressable
                key={choice.label}
                style={[styles.modalRow, options.key === choice.value && styles.modalRowActive]}
                onPress={() => {
                  setOptions((o) => ({ ...o, key: choice.value as KeyName | null }));
                  setKeyModal(false);
                }}
              >
                <Text style={[styles.modalRowText, options.key === choice.value && styles.modalRowTextActive]}>{choice.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={sourceModalColumn !== null} transparent animationType="slide" onRequestClose={() => setSourceModalColumn(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.sourceModalCard]}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Instrument / percussion</Text>
              <Pressable onPress={() => setSourceModalColumn(null)}><Text style={styles.closeText}>CLOSE</Text></Pressable>
            </View>
            <TextInput
              value={sourceSearch}
              onChangeText={setSourceSearch}
              placeholder="Search piano, strings, snare…"
              placeholderTextColor="#5B6570"
              autoCapitalize="none"
              style={styles.searchInput}
            />
            <FlatList
              data={filteredSources}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={styles.sourceRow}
                  onPress={() => {
                    if (sourceModalColumn !== null) {
                      setSourceByColumn((m) => ({ ...m, [sourceModalColumn]: item }));
                    }
                    setSourceModalColumn(null);
                  }}
                >
                  <Text style={styles.sourceKind}>{item.kind === "percussion" ? "DRUM" : `GM ${item.midi + 1}`}</Text>
                  <Text style={styles.sourceLabel}>{item.label}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16, paddingTop: 18 },
  eyebrow: { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: TEXT, fontSize: 32, lineHeight: 38, fontWeight: "900", marginTop: 5 },
  subtitle: { color: MUTED, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 18 },
  card: { backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 15, marginBottom: 14 },
  cardTitle: { color: TEXT, fontSize: 16, fontWeight: "800", lineHeight: 22 },
  meta: { color: MUTED, fontSize: 12, lineHeight: 17, marginTop: 3 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  smallButton: { backgroundColor: "#20382F", borderWidth: 1, borderColor: "#2A6F58", paddingHorizontal: 11, paddingVertical: 9, borderRadius: 9 },
  smallButtonText: { color: ACCENT, fontSize: 11, fontWeight: "800" },
  dataInput: { marginTop: 12, minHeight: 126, maxHeight: 220, borderRadius: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: "#0D1117", color: "#C9D1D9", fontSize: 12, lineHeight: 18, padding: 11, textAlignVertical: "top", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  secondaryButton: { borderRadius: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: "#21262D", alignItems: "center", paddingVertical: 10, marginTop: 10 },
  secondaryButtonText: { color: TEXT, fontSize: 12, fontWeight: "800" },
  chips: { gap: 8, paddingTop: 10, paddingRight: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 9 },
  chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: "#21262D", borderWidth: 1, borderColor: BORDER },
  chipActive: { backgroundColor: "#173D31", borderColor: ACCENT },
  chipDisabled: { opacity: 0.35 },
  chipText: { color: "#C9D1D9", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: ACCENT },
  chipTextDisabled: { color: "#69727D" },
  trackRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  trackIndex: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#173D31", alignItems: "center", justifyContent: "center", marginRight: 10 },
  trackIndexText: { color: ACCENT, fontSize: 12, fontWeight: "900" },
  trackName: { color: TEXT, fontSize: 14, fontWeight: "800" },
  trackSource: { color: MUTED, fontSize: 12, marginTop: 2 },
  change: { color: ACCENT, fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  label: { color: MUTED, fontSize: 12, fontWeight: "700", marginTop: 15, marginBottom: 6 },
  labelInline: { color: TEXT, fontSize: 13, fontWeight: "800" },
  selectButton: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: BORDER, backgroundColor: "#0D1117", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  selectText: { color: TEXT, fontSize: 14, fontWeight: "700" },
  selectArrow: { color: ACCENT, fontSize: 10 },
  twoCol: { flexDirection: "row", alignItems: "flex-end" },
  numberInput: { borderWidth: 1, borderColor: BORDER, backgroundColor: "#0D1117", color: TEXT, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontWeight: "700" },
  switchRow: { flexDirection: "row", alignItems: "center", marginTop: 18, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  mappingCard: { backgroundColor: "#101D18", borderWidth: 1, borderColor: "#244C3D", borderRadius: 14, padding: 14, marginBottom: 14 },
  mappingTitle: { color: ACCENT, fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },
  mappingText: { color: TEXT, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12, lineHeight: 19, marginTop: 7 },
  mappingHint: { color: MUTED, fontSize: 10, marginTop: 5 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  primaryButton: { flexGrow: 1, minWidth: "47%", backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  primaryButtonText: { color: BG, fontSize: 13, fontWeight: "900" },
  darkButton: { flexGrow: 1, minWidth: "47%", backgroundColor: "#21262D", borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  darkButtonText: { color: TEXT, fontSize: 13, fontWeight: "900" },
  exportButton: { flexGrow: 1, minWidth: "47%", backgroundColor: "#1B2330", borderWidth: 1, borderColor: "#34465B", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  exportButtonText: { color: "#9CC7FF", fontSize: 13, fontWeight: "900" },
  disabledButton: { opacity: 0.55 },
  progressTrack: { height: 5, backgroundColor: "#21262D", borderRadius: 5, overflow: "hidden", marginTop: 14 },
  progressFill: { height: "100%", backgroundColor: ACCENT },
  status: { color: "#C9D1D9", fontSize: 12, lineHeight: 18, marginTop: 13 },
  credit: { color: "#59636E", fontSize: 10, lineHeight: 15, marginTop: 8 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 18 },
  modalCard: { width: "100%", maxWidth: 520, backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14, maxHeight: "86%" },
  sourceModalCard: { height: "80%" },
  modalTitle: { color: TEXT, fontSize: 18, lineHeight: 24, fontWeight: "900", marginBottom: 10 },
  modalRow: { paddingVertical: 11, paddingHorizontal: 10, borderRadius: 9 },
  modalRowActive: { backgroundColor: "#173D31" },
  modalRowText: { color: "#C9D1D9", fontSize: 14, fontWeight: "700" },
  modalRowTextActive: { color: ACCENT },
  closeText: { color: ACCENT, fontSize: 11, fontWeight: "900" },
  searchInput: { borderWidth: 1, borderColor: BORDER, backgroundColor: BG, color: TEXT, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  sourceRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  sourceKind: { width: 58, color: WARNING, fontSize: 10, fontWeight: "900" },
  sourceLabel: { color: TEXT, fontSize: 13, fontWeight: "700", flex: 1 },
});
