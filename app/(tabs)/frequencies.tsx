import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  Platform,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  FREQUENCY_LIBRARY,
  CATEGORIES,
  type FrequencyEntry,
  type FrequencyCategory,
} from "@/lib/frequencies";
import { useSonification } from "@/lib/sonification-store";
import {
  encodeWav,
  arrayBufferToBase64,
} from "@/lib/sonification-engine";

const CATEGORY_COLORS: Record<FrequencyCategory, string> = {
  Solfeggio: "#2ECC9A",
  Schumann: "#4A9EFF",
  Brainwave: "#A78BFA",
  Biofield: "#F0A500",
  Rife: "#F85149",
};

/** Generate a 3-second pure sine tone and return a playable URI */
async function generatePreviewToneUri(hz: number): Promise<string> {
  const sampleRate = 44100;
  const duration = 3;
  const totalSamples = sampleRate * duration;
  const samples = new Float32Array(totalSamples);

  // For very low frequencies (< 20 Hz), AM-modulate a 200 Hz carrier
  const audibleHz = hz < 20 ? 200 : hz;
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

  const wav = encodeWav(samples, sampleRate);
  const base64 = arrayBufferToBase64(wav);

  if (Platform.OS === "web") {
    return `data:audio/wav;base64,${base64}`;
  }

  // Native: write to file:// path — data: URIs don't work on Android
  const path = (FileSystem.cacheDirectory ?? "") + `preview_${hz}.wav`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

export default function FrequenciesScreen() {
  const { state, dispatch } = useSonification();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<FrequencyCategory | "All">("All");
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const player = useAudioPlayer(null);

  useEffect(() => {
    // Correct option name: playsInSilentMode (not playsInSilentModeIOS)
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => player.release();
  }, []);

  const filtered = FREQUENCY_LIBRARY.filter((f) => {
    const matchCat = activeCategory === "All" || f.category === activeCategory;
    const matchSearch =
      search.length === 0 ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.effect.toLowerCase().includes(search.toLowerCase()) ||
      String(f.hz).includes(search);
    return matchCat && matchSearch;
  });

  const previewTone = useCallback(
    async (entry: FrequencyEntry) => {
      if (previewingId === entry.id) {
        player.pause();
        setPreviewingId(null);
        return;
      }
      try {
        const uri = await generatePreviewToneUri(entry.hz);
        player.replace({ uri });
        player.play();
        setPreviewingId(entry.id);
        setTimeout(() => setPreviewingId(null), 3100);
      } catch {
        // silently ignore preview errors
      }
    },
    [previewingId, player]
  );

  const toggleFrequency = useCallback(
    (id: string) => {
      dispatch({ type: "TOGGLE_FREQUENCY", id });
    },
    [dispatch]
  );

  const enabledCount = state.enabledFrequencies.length;

  const renderItem = ({ item }: { item: FrequencyEntry }) => {
    const isEnabled = state.enabledFrequencies.includes(item.id);
    const isPreviewing = previewingId === item.id;
    const catColor = CATEGORY_COLORS[item.category];

    return (
      <View style={styles.card}>
        <View style={[styles.catDot, { backgroundColor: catColor }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.freqName}>{item.name}</Text>
            <Text style={[styles.freqHz, { color: catColor }]}>
              {item.hz < 1 ? item.hz.toFixed(2) : item.hz % 1 === 0 ? item.hz : item.hz.toFixed(1)} Hz
            </Text>
          </View>
          <Text style={styles.freqEffect}>{item.effect}</Text>
          <Text style={styles.freqSource}>{item.source}</Text>
          <View style={styles.cardActions}>
            <Pressable
              style={[styles.actionBtn, isPreviewing && { borderColor: catColor }]}
              onPress={() => previewTone(item)}
            >
              <IconSymbol
                name={isPreviewing ? "pause.fill" : "play.fill"}
                size={13}
                color={isPreviewing ? catColor : "#7D8590"}
              />
              <Text style={[styles.actionBtnText, isPreviewing && { color: catColor }]}>
                {isPreviewing ? "Stop" : "Preview"}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.actionBtn,
                isEnabled && { borderColor: catColor, backgroundColor: catColor + "22" },
              ]}
              onPress={() => toggleFrequency(item.id)}
            >
              <IconSymbol
                name={isEnabled ? "checkmark.circle.fill" : "plus.circle"}
                size={13}
                color={isEnabled ? catColor : "#7D8590"}
              />
              <Text style={[styles.actionBtnText, isEnabled && { color: catColor }]}>
                {isEnabled ? "Added" : "Add to Mix"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background" className="bg-background">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Frequency Library</Text>
        <Text style={styles.subtitle}>
          {enabledCount} active · tap to add to biofield mix
        </Text>
      </View>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <View style={styles.searchRow}>
        <IconSymbol name="magnifyingglass" size={16} color="#7D8590" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search frequencies…"
          placeholderTextColor="#7D8590"
          value={search}
          onChangeText={setSearch}
          returnKeyType="done"
        />
      </View>

      {/* ── Category chips ─────────────────────────────────────────────── */}
      <View style={styles.chipRow}>
        {(["All", ...CATEGORIES] as (FrequencyCategory | "All")[]).map((cat) => (
          <Pressable
            key={cat}
            style={[
              styles.chip,
              activeCategory === cat && {
                backgroundColor:
                  cat === "All" ? "#2ECC9A22" : CATEGORY_COLORS[cat as FrequencyCategory] + "22",
                borderColor:
                  cat === "All" ? "#2ECC9A" : CATEGORY_COLORS[cat as FrequencyCategory],
              },
            ]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text
              style={[
                styles.chipText,
                activeCategory === cat && {
                  color:
                    cat === "All" ? "#2ECC9A" : CATEGORY_COLORS[cat as FrequencyCategory],
                },
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── List ───────────────────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: "800", color: "#E6EDF3" },
  subtitle: { fontSize: 12, color: "#7D8590", marginTop: 2 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: "#161B22",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#30363D",
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: "#E6EDF3",
    fontSize: 14,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  chipText: { fontSize: 11, fontWeight: "600", color: "#7D8590" },
  card: {
    flexDirection: "row",
    backgroundColor: "#161B22",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#30363D",
    overflow: "hidden",
  },
  catDot: { width: 4 },
  cardBody: { flex: 1, padding: 12 },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  freqName: { fontSize: 14, fontWeight: "700", color: "#E6EDF3", flex: 1 },
  freqHz: { fontSize: 13, fontWeight: "800", marginLeft: 8 },
  freqEffect: { fontSize: 12, color: "#C9D1D9", lineHeight: 17, marginBottom: 2 },
  freqSource: { fontSize: 10, color: "#7D8590", fontStyle: "italic", marginBottom: 8 },
  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  actionBtnText: { fontSize: 11, fontWeight: "600", color: "#7D8590" },
});
