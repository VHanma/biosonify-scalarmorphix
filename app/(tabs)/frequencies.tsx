import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  FREQUENCY_LIBRARY,
  CATEGORIES,
  CATEGORY_COLOR,
  type FrequencyEntry,
  type FrequencyCategory,
} from "@/lib/frequencies";
import { useSonification } from "@/lib/sonification-store";
import { encodeWav, arrayBufferToBase64 } from "@/lib/sonification-engine";

// ─── Preview tone generator ────────────────────────────────────────────────────

async function generatePreviewToneUri(hz: number): Promise<string> {
  const sampleRate = 44100;
  const duration = 3;
  const totalSamples = sampleRate * duration;
  const samples = new Float32Array(totalSamples);

  // Sub-20 Hz: AM-modulate a 200 Hz carrier so you can hear the beat
  const audibleHz = hz < 20 ? 200 : Math.min(hz, 14000);
  const modHz = hz < 20 ? hz : 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const fade = Math.min(1, Math.min(t / 0.1, (duration - t) / 0.1));
    let s = Math.sin(2 * Math.PI * audibleHz * t) * 0.7 * fade;
    if (modHz > 0) {
      s *= 0.5 + 0.5 * Math.sin(2 * Math.PI * modHz * t);
    }
    samples[i] = s;
  }

  const wavBuffer = encodeWav(samples, sampleRate);

  if (Platform.OS === "web") {
    const base64 = arrayBufferToBase64(wavBuffer);
    return `data:audio/wav;base64,${base64}`;
  }
  const path = (FileSystem.cacheDirectory ?? "") + `preview-${hz}.wav`;
  await FileSystem.writeAsStringAsync(path, arrayBufferToBase64(wavBuffer), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

// ─── Save a frequency tone to device ──────────────────────────────────────────

async function saveFrequencyTone(entry: FrequencyEntry): Promise<void> {
  const sampleRate = 44100;
  const duration = 60; // 1-minute tone
  const totalSamples = sampleRate * duration;
  const samples = new Float32Array(totalSamples);

  const audibleHz = entry.hz < 20 ? 200 : Math.min(entry.hz, 14000);
  const modHz = entry.hz < 20 ? entry.hz : 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const fade = Math.min(1, Math.min(t / 0.5, (duration - t) / 0.5));
    let s = Math.sin(2 * Math.PI * audibleHz * t) * 0.8 * fade;
    if (modHz > 0) {
      s *= 0.5 + 0.5 * Math.sin(2 * Math.PI * modHz * t);
    }
    samples[i] = s;
  }

  const wavBuffer = encodeWav(samples, sampleRate);
  const safeName = entry.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  const filename = `BioSonify_${safeName}_${Math.round(entry.hz)}Hz.wav`;

  if (Platform.OS === "web") {
    const base64 = arrayBufferToBase64(wavBuffer);
    const a = (global as any).document?.createElement("a");
    if (a) {
      a.href = `data:audio/wav;base64,${base64}`;
      a.download = filename;
      a.click();
    }
    return;
  }

  const path = (FileSystem.cacheDirectory ?? "") + filename;
  await FileSystem.writeAsStringAsync(path, arrayBufferToBase64(wavBuffer), {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Try to save to media library first
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status === "granted") {
    try {
      await MediaLibrary.saveToLibraryAsync(path);
      Alert.alert("Saved to Music Library", `${filename} saved to your device's music library.`);
      return;
    } catch {
      // Fall through to share
    }
  }

  // Fallback: share
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: "audio/wav", dialogTitle: `Save ${filename}` });
  } else {
    Alert.alert("Saved", `Tone saved to cache: ${path}`);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const ALL_CATEGORY = "All" as const;
type FilterCategory = typeof ALL_CATEGORY | FrequencyCategory;

export default function FrequenciesScreen() {
  const { state, dispatch, persistSettings } = useSonification();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<FilterCategory>(ALL_CATEGORY);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const player = useAudioPlayer(null);
  const playerReady = useRef(false);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => { player.release(); };
  }, []);

  const filteredEntries: FrequencyEntry[] = FREQUENCY_LIBRARY.filter((f) => {
    const matchCat = activeCategory === ALL_CATEGORY || f.category === activeCategory;
    if (!matchCat) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      f.effect.toLowerCase().includes(q) ||
      f.source.toLowerCase().includes(q) ||
      String(f.hz).includes(q)
    );
  });

  const handlePreview = useCallback(async (entry: FrequencyEntry) => {
    if (previewingId === entry.id) {
      player.pause();
      setPreviewingId(null);
      return;
    }
    setPreviewingId(entry.id);
    try {
      const uri = await generatePreviewToneUri(entry.hz);
      player.replace({ uri });
      player.play();
      setTimeout(() => setPreviewingId(null), 3200);
    } catch (e) {
      setPreviewingId(null);
      Alert.alert("Preview failed", String(e));
    }
  }, [previewingId, player]);

  const handleToggle = useCallback((id: string) => {
    dispatch({ type: "TOGGLE_FREQUENCY", id });
    persistSettings();
  }, [dispatch, persistSettings]);

  const handleSave = useCallback(async (entry: FrequencyEntry) => {
    setSavingId(entry.id);
    try {
      await saveFrequencyTone(entry);
    } catch (e) {
      Alert.alert("Save failed", String(e));
    } finally {
      setSavingId(null);
    }
  }, []);

  const renderItem = useCallback(({ item }: { item: FrequencyEntry }) => {
    const isEnabled = state.enabledFrequencies.includes(item.id);
    const isPreviewing = previewingId === item.id;
    const isSaving = savingId === item.id;
    const catColor = CATEGORY_COLOR[item.category] ?? "#7D8590";
    const hzLabel = item.hz < 1
      ? `${item.hz.toFixed(2)} Hz`
      : item.hz < 100
      ? `${item.hz.toFixed(1)} Hz`
      : `${Math.round(item.hz)} Hz`;

    return (
      <View style={[styles.row, isEnabled && { borderColor: catColor + "55", borderWidth: 1 }]}>
        {/* Category dot */}
        <View style={[styles.dot, { backgroundColor: catColor }]} />

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.freqName} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.hzBadge, { color: catColor }]}>{hzLabel}</Text>
          </View>
          <Text style={styles.effectText} numberOfLines={2}>{item.effect}</Text>
          <Text style={styles.sourceText}>{item.source} · {item.category}</Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {/* Preview */}
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
            onPress={() => handlePreview(item)}
          >
            <IconSymbol
              name={isPreviewing ? "pause.fill" : "play.fill"}
              size={14}
              color={isPreviewing ? catColor : "#7D8590"}
            />
          </Pressable>

          {/* Save 1-min tone */}
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
            onPress={() => handleSave(item)}
            disabled={isSaving}
          >
            {isSaving
              ? <ActivityIndicator size={12} color={catColor} />
              : <IconSymbol name="square.and.arrow.down" size={14} color="#7D8590" />
            }
          </Pressable>

          {/* Enable/disable in biofield mix */}
          <Pressable
            style={[styles.toggleBtn, isEnabled && { backgroundColor: catColor + "33", borderColor: catColor }]}
            onPress={() => handleToggle(item.id)}
          >
            <Text style={[styles.toggleText, isEnabled && { color: catColor }]}>
              {isEnabled ? "ON" : "OFF"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }, [state.enabledFrequencies, previewingId, savingId, handlePreview, handleToggle, handleSave]);

  const enabledCount = state.enabledFrequencies.length;

  return (
    <ScreenContainer containerClassName="bg-background" className="bg-background">
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Frequency Library</Text>
          <Text style={styles.subtitle}>{FREQUENCY_LIBRARY.length} frequencies · {enabledCount} active in Biofield</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <IconSymbol name="magnifyingglass" size={16} color="#7D8590" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, effect, source, Hz…"
          placeholderTextColor="#7D8590"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} style={{ padding: 4 }}>
            <IconSymbol name="xmark.circle.fill" size={16} color="#7D8590" />
          </Pressable>
        )}
      </View>

      {/* Category chips */}
      <FlatList
        horizontal
        data={[{ id: ALL_CATEGORY, label: "All", color: "#7D8590", description: "" }, ...CATEGORIES]}
        keyExtractor={(c) => c.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        renderItem={({ item: cat }) => {
          const isActive = activeCategory === cat.id;
          const color = (cat as any).color ?? "#7D8590";
          return (
            <Pressable
              style={[styles.chip, isActive && { backgroundColor: color + "22", borderColor: color }]}
              onPress={() => setActiveCategory(cat.id as FilterCategory)}
            >
              <Text style={[styles.chipText, isActive && { color }]}>{cat.label}</Text>
            </Pressable>
          );
        }}
      />

      {/* Results count */}
      <Text style={styles.resultsCount}>
        {filteredEntries.length} result{filteredEntries.length !== 1 ? "s" : ""}
        {activeCategory !== ALL_CATEGORY ? ` in ${activeCategory}` : ""}
      </Text>

      {/* Frequency list */}
      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        maxToRenderPerBatch={30}
        windowSize={10}
        getItemLayout={(_, index) => ({ length: 84, offset: 84 * index, index })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <IconSymbol name="waveform.slash" size={36} color="#30363D" />
            <Text style={styles.emptyText}>No frequencies match your search</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: { fontSize: 22, fontWeight: "800", color: "#E6EDF3" },
  subtitle: { fontSize: 12, color: "#7D8590", marginTop: 2 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161B22",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#E6EDF3",
    padding: 0,
  },
  chipRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#30363D",
    backgroundColor: "#161B22",
  },
  chipText: { fontSize: 12, fontWeight: "600", color: "#7D8590" },
  resultsCount: {
    fontSize: 11,
    color: "#7D8590",
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161B22",
    borderRadius: 12,
    marginBottom: 6,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  info: { flex: 1, gap: 2 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  freqName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E6EDF3",
    flex: 1,
  },
  hzBadge: {
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 0,
  },
  effectText: {
    fontSize: 11,
    color: "#9BA1A6",
    lineHeight: 15,
  },
  sourceText: {
    fontSize: 10,
    color: "#7D8590",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#0D1117",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#30363D",
  },
  toggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#30363D",
    backgroundColor: "#0D1117",
    minWidth: 36,
    alignItems: "center",
  },
  toggleText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7D8590",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: { fontSize: 14, color: "#7D8590" },
});
