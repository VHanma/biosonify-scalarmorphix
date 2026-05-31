import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  Platform,
} from "react-native";
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
  synthesizeFromPixels,
  encodeWav,
  arrayBufferToBase64DataUri,
  type PixelData,
} from "@/lib/sonification-engine";

const CATEGORY_COLORS: Record<FrequencyCategory, string> = {
  Solfeggio: "#2ECC9A",
  Schumann: "#4A9EFF",
  Brainwave: "#A78BFA",
  Biofield: "#F0A500",
  Rife: "#F85149",
};

/** Generate a 3-second pure sine tone for preview */
function generatePreviewTone(hz: number): string {
  const sampleRate = 44100;
  const duration = 3;
  const totalSamples = sampleRate * duration;
  const samples = new Float32Array(totalSamples);

  // For very low frequencies (< 20 Hz), use a 200 Hz carrier AM-modulated by the frequency
  const audibleHz = hz < 20 ? 200 : hz;
  const modHz = hz < 20 ? hz : 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Fade in/out envelope
    const fade = Math.min(1, Math.min(t / 0.1, (duration - t) / 0.1));
    let s = Math.sin(2 * Math.PI * audibleHz * t) * 0.7 * fade;
    if (modHz > 0) {
      s *= 0.5 + 0.5 * Math.sin(2 * Math.PI * modHz * t);
    }
    samples[i] = s;
  }

  const wav = encodeWav(samples, sampleRate);
  return arrayBufferToBase64DataUri(wav);
}

export default function FrequenciesScreen() {
  const { state, dispatch } = useSonification();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<FrequencyCategory | "All">("All");
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const player = useAudioPlayer(null);

  useEffect(() => {
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
    (entry: FrequencyEntry) => {
      if (previewingId === entry.id) {
        player.pause();
        setPreviewingId(null);
        return;
      }
      const dataUri = generatePreviewTone(entry.hz);
      player.replace({ uri: dataUri });
      player.play();
      setPreviewingId(entry.id);
      setTimeout(() => setPreviewingId(null), 3100);
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
    const color = CATEGORY_COLORS[item.category];

    return (
      <View style={[styles.freqCard, isEnabled && { borderLeftColor: color, borderLeftWidth: 3 }]}>
        <View style={styles.freqHeader}>
          <View style={[styles.catBadge, { backgroundColor: color + "22" }]}>
            <Text style={[styles.catBadgeText, { color }]}>{item.category}</Text>
          </View>
          <Text style={styles.freqHz}>{item.hz} Hz</Text>
        </View>
        <Text style={styles.freqName}>{item.name}</Text>
        <Text style={styles.freqEffect} numberOfLines={3}>{item.effect}</Text>
        <Text style={styles.freqSource}>Source: {item.source}</Text>

        <View style={styles.freqActions}>
          <Pressable
            style={({ pressed }) => [
              styles.previewBtn,
              isPreviewing && { backgroundColor: color + "33", borderColor: color },
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => previewTone(item)}
          >
            <IconSymbol
              name={isPreviewing ? "pause.fill" : "play.fill"}
              size={14}
              color={color}
            />
            <Text style={[styles.previewBtnText, { color }]}>
              {isPreviewing ? "Stop" : "Preview"}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.toggleBtn,
              isEnabled && { backgroundColor: color, borderColor: color },
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => toggleFrequency(item.id)}
          >
            <IconSymbol
              name={isEnabled ? "checkmark.circle.fill" : "xmark.circle.fill"}
              size={14}
              color={isEnabled ? "#0D1117" : "#7D8590"}
            />
            <Text
              style={[
                styles.toggleBtnText,
                isEnabled && { color: "#0D1117" },
              ]}
            >
              {isEnabled ? "Active" : "Add"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background" className="bg-background">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Frequency Library</Text>
        <View style={styles.activeCount}>
          <Text style={styles.activeCountText}>{enabledCount} active</Text>
        </View>
      </View>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <View style={styles.searchRow}>
        <IconSymbol name="list.bullet" size={16} color="#7D8590" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search frequencies…"
          placeholderTextColor="#7D8590"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      {/* ── Category Filter ─────────────────────────────────────────────── */}
      <View style={styles.catRow}>
        {(["All", ...CATEGORIES] as (FrequencyCategory | "All")[]).map((cat) => (
          <Pressable
            key={cat}
            style={[
              styles.catBtn,
              activeCategory === cat && {
                backgroundColor:
                  cat === "All"
                    ? "#2ECC9A22"
                    : CATEGORY_COLORS[cat as FrequencyCategory] + "22",
                borderColor:
                  cat === "All" ? "#2ECC9A" : CATEGORY_COLORS[cat as FrequencyCategory],
              },
            ]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text
              style={[
                styles.catBtnText,
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
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No frequencies match your search.</Text>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#E6EDF3",
  },
  activeCount: {
    backgroundColor: "#2ECC9A22",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#2ECC9A",
  },
  activeCountText: {
    fontSize: 12,
    color: "#2ECC9A",
    fontWeight: "700",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#161B22",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  searchInput: {
    flex: 1,
    color: "#E6EDF3",
    fontSize: 14,
  },
  catRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  catBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  catBtnText: {
    fontSize: 11,
    color: "#7D8590",
    fontWeight: "600",
  },
  freqCard: {
    backgroundColor: "#161B22",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 1,
    borderLeftColor: "#30363D",
  },
  freqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  freqHz: {
    fontSize: 16,
    fontWeight: "800",
    color: "#E6EDF3",
  },
  freqName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E6EDF3",
    marginBottom: 4,
  },
  freqEffect: {
    fontSize: 12,
    color: "#7D8590",
    lineHeight: 17,
    marginBottom: 4,
  },
  freqSource: {
    fontSize: 10,
    color: "#30363D",
    fontStyle: "italic",
    marginBottom: 10,
  },
  freqActions: {
    flexDirection: "row",
    gap: 8,
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7D8590",
  },
  emptyText: {
    color: "#7D8590",
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
});
