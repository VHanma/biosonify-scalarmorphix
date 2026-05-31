import { useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
  FlatList,
  Platform,
  Alert,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useSonification } from "@/lib/sonification-store";

const { width: SCREEN_W } = Dimensions.get("window");

// ── Deterministic waveform hero ─────────────────────────────────────────────
// These values are computed from the three primary Solfeggio carriers:
// 396 Hz (UT), 528 Hz (MI), 741 Hz (SOL) sampled at 24 evenly-spaced phase points.
// No randomness — same values every render.
const HERO_BARS = Array.from({ length: 24 }, (_, i) => {
  const t = i / 24;
  const a = Math.sin(2 * Math.PI * 396 * t) * 0.4;
  const b = Math.sin(2 * Math.PI * 528 * t) * 0.35;
  const c = Math.sin(2 * Math.PI * 741 * t) * 0.25;
  return Math.abs(a + b + c);
});
const heroMax = Math.max(...HERO_BARS);
const HERO_NORMALIZED = HERO_BARS.map((v) => v / heroMax);

export default function HomeScreen() {
  const router = useRouter();
  const { state, dispatch } = useSonification();

  const pickFromLibrary = useCallback(async () => {
    if (Platform.OS === "android") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "BioSonify needs access to your photo library to select images for sonification."
        );
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      dispatch({
        type: "SET_IMAGE",
        uri: asset.uri,
        width: asset.width ?? 0,
        height: asset.height ?? 0,
      });
      dispatch({ type: "ADD_RECENT", uri: asset.uri });
      router.push("/sonify" as any);
    }
  }, [dispatch, router]);

  const pickFromCamera = useCallback(async () => {
    if (Platform.OS === "android") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "BioSonify needs camera access to capture images for sonification."
        );
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      dispatch({
        type: "SET_IMAGE",
        uri: asset.uri,
        width: asset.width ?? 0,
        height: asset.height ?? 0,
      });
      dispatch({ type: "ADD_RECENT", uri: asset.uri });
      router.push("/sonify" as any);
    }
  }, [dispatch, router]);

  const openRecent = useCallback(
    (uri: string) => {
      dispatch({ type: "SET_IMAGE", uri, width: 0, height: 0 });
      router.push("/sonify" as any);
    },
    [dispatch, router]
  );

  return (
    <ScreenContainer containerClassName="bg-background" className="bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>BioSonify</Text>
            <Text style={styles.tagline}>Image → Sound · Every pixel encoded</Text>
          </View>
          <View style={styles.headerBadge}>
            <IconSymbol name="dna" size={18} color="#2ECC9A" />
          </View>
        </View>

        {/* ── Waveform hero ────────────────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.heroWave}>
            {HERO_NORMALIZED.map((v, i) => (
              <View
                key={i}
                style={[
                  styles.heroBar,
                  { height: Math.max(4, v * 48), opacity: 0.6 + v * 0.4 },
                ]}
              />
            ))}
          </View>
          <Text style={styles.heroLabel}>396 · 528 · 741 Hz — Solfeggio carriers</Text>
          <Text style={styles.heroSub}>
            Tap an image source below to translate its full pixel data into sound
          </Text>
        </View>

        {/* ── Image source buttons ─────────────────────────────────────────── */}
        <View style={styles.sourceRow}>
          <Pressable
            style={({ pressed }) => [styles.sourceBtn, pressed && { opacity: 0.75 }]}
            onPress={pickFromLibrary}
          >
            <View style={[styles.sourceBtnIcon, { backgroundColor: "#2ECC9A22" }]}>
              <IconSymbol name="photo.fill" size={26} color="#2ECC9A" />
            </View>
            <Text style={styles.sourceBtnTitle}>Photo Library</Text>
            <Text style={styles.sourceBtnDesc}>Select any image</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.sourceBtn, pressed && { opacity: 0.75 }]}
            onPress={pickFromCamera}
          >
            <View style={[styles.sourceBtnIcon, { backgroundColor: "#F0A50022" }]}>
              <IconSymbol name="camera.fill" size={26} color="#F0A500" />
            </View>
            <Text style={styles.sourceBtnTitle}>Camera</Text>
            <Text style={styles.sourceBtnDesc}>Capture live</Text>
          </Pressable>
        </View>

        {/* ── Mode cards ───────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Synthesis Modes</Text>
        <View style={styles.modeCards}>
          <View style={[styles.modeCard, { borderColor: "#2ECC9A55" }]}>
            <Text style={[styles.modeCardTitle, { color: "#2ECC9A" }]}>Spectral</Text>
            <Text style={styles.modeCardDesc}>
              Brightness → pitch · Hue → timbre · Saturation → harmonics · X/Y → time/octave
            </Text>
          </View>
          <View style={[styles.modeCard, { borderColor: "#F0A50055" }]}>
            <Text style={[styles.modeCardTitle, { color: "#F0A500" }]}>Wave Genetics</Text>
            <Text style={styles.modeCardDesc}>
              R→396 Hz · G→528 Hz · B→741 Hz · Luminance→40 Hz coherence · Gariaev He-Ne laser equivalent at 13,788 Hz
            </Text>
          </View>
          <View style={[styles.modeCard, { borderColor: "#4A9EFF55" }]}>
            <Text style={[styles.modeCardTitle, { color: "#4A9EFF" }]}>Biofield</Text>
            <Text style={styles.modeCardDesc}>
              Full spectral scan + pixel data drives amplitude and phase of all active biofield carriers from the frequency library
            </Text>
          </View>
        </View>

        {/* ── Recent images ────────────────────────────────────────────────── */}
        {state.recentImages.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Images</Text>
            <FlatList
              horizontal
              data={state.recentImages}
              keyExtractor={(item) => item.uri}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentList}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.recentItem, pressed && { opacity: 0.75 }]}
                  onPress={() => openRecent(item.uri)}
                >
                  <Image source={{ uri: item.uri }} style={styles.recentImage} />
                  <View style={styles.recentOverlay}>
                    <IconSymbol name="play.fill" size={16} color="#fff" />
                  </View>
                </Pressable>
              )}
            />
          </>
        )}

        {/* ── Stats bar ────────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>565</Text>
            <Text style={styles.statLabel}>Frequencies</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>8</Text>
            <Text style={styles.statLabel}>Categories</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>3</Text>
            <Text style={styles.statLabel}>Engines</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Random bits</Text>
          </View>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  appName: { fontSize: 28, fontWeight: "900", color: "#E6EDF3", letterSpacing: -0.5 },
  tagline: { fontSize: 12, color: "#7D8590", marginTop: 2 },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#161B22",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2ECC9A44",
  },
  heroCard: {
    marginHorizontal: 16,
    backgroundColor: "#161B22",
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#30363D",
    alignItems: "center",
  },
  heroWave: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    gap: 3,
    marginBottom: 10,
  },
  heroBar: {
    width: 8,
    borderRadius: 4,
    backgroundColor: "#2ECC9A",
  },
  heroLabel: {
    fontSize: 11,
    color: "#2ECC9A",
    fontWeight: "600",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  heroSub: {
    fontSize: 12,
    color: "#7D8590",
    textAlign: "center",
    lineHeight: 17,
  },
  sourceRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 28,
  },
  sourceBtn: {
    flex: 1,
    backgroundColor: "#161B22",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  sourceBtnIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceBtnTitle: { fontSize: 15, fontWeight: "700", color: "#E6EDF3" },
  sourceBtnDesc: { fontSize: 11, color: "#7D8590" },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7D8590",
    paddingHorizontal: 20,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  modeCards: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 28,
  },
  modeCard: {
    backgroundColor: "#161B22",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 4,
  },
  modeCardTitle: { fontSize: 14, fontWeight: "700" },
  modeCardDesc: { fontSize: 12, color: "#7D8590", lineHeight: 17 },
  recentList: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 28,
  },
  recentItem: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#161B22",
  },
  recentImage: { width: "100%", height: "100%" },
  recentOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    backgroundColor: "#161B22",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#30363D",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: { alignItems: "center", flex: 1 },
  statValue: { fontSize: 20, fontWeight: "800", color: "#2ECC9A" },
  statLabel: { fontSize: 10, color: "#7D8590", marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: "#30363D" },
});
