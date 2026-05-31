import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  Alert,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useSonification } from "@/lib/sonification-store";

const { width: SCREEN_W } = Dimensions.get("window");
const BAR_COUNT = 40;

/**
 * Static waveform bars derived from a deterministic sine pattern.
 * These represent the shape of a 528 Hz Solfeggio wave sampled at BAR_COUNT points.
 * No randomness — this is a real waveform, not decoration.
 */
const STATIC_BARS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const t = i / BAR_COUNT;
  // Superposition of 396, 528, 741 Hz Solfeggio waves sampled at equal intervals
  const v =
    0.4 * Math.abs(Math.sin(2 * Math.PI * 396 * t)) +
    0.35 * Math.abs(Math.sin(2 * Math.PI * 528 * t)) +
    0.25 * Math.abs(Math.sin(2 * Math.PI * 741 * t));
  return Math.min(1, v / 1.0);
});

export default function HomeScreen() {
  const router = useRouter();
  const { state, dispatch } = useSonification();
  const [requesting, setRequesting] = useState(false);

  const pickImage = useCallback(async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission needed",
            "BioSonify needs access to your photo library to sonify images."
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets.length > 0) {
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
    } finally {
      setRequesting(false);
    }
  }, [requesting, dispatch, router]);

  const takePhoto = useCallback(async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission needed", "Camera access is required to capture images.");
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets.length > 0) {
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
    } finally {
      setRequesting(false);
    }
  }, [requesting, dispatch, router]);

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
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <Text style={styles.appTitle}>BioSonify</Text>
          <Text style={styles.appSubtitle}>
            Transform images into living sound
          </Text>

          {/* Static Solfeggio waveform — superposition of 396 + 528 + 741 Hz */}
          <View style={styles.waveformContainer}>
            {STATIC_BARS.map((height, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: 4 + height * 52,
                    backgroundColor:
                      i % 3 === 0 ? "#2ECC9A" : i % 3 === 1 ? "#F0A500" : "#1A6B5A",
                  },
                ]}
              />
            ))}
          </View>

          <Text style={styles.tagline}>
            396 · 528 · 741 Hz Solfeggio superposition
          </Text>
        </View>

        {/* ── Action Buttons ────────────────────────────────────────────── */}
        <View style={styles.buttonRow}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={pickImage}
            disabled={requesting}
          >
            {requesting ? (
              <ActivityIndicator color="#0D1117" size="small" />
            ) : (
              <>
                <IconSymbol name="photo.fill" size={22} color="#0D1117" />
                <Text style={styles.primaryBtnText}>Pick Image</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={takePhoto}
            disabled={requesting}
          >
            <IconSymbol name="camera.fill" size={22} color="#2ECC9A" />
            <Text style={styles.secondaryBtnText}>Camera</Text>
          </Pressable>
        </View>

        {/* ── Mode cards ───────────────────────────────────────────────── */}
        <View style={styles.modeCards}>
          {[
            {
              color: "#2ECC9A",
              title: "Spectral Scan",
              desc: "Pixel brightness → pitch · hue → timbre · saturation → harmonics",
            },
            {
              color: "#F0A500",
              title: "Wave Genetics",
              desc: "R→396 Hz · G→528 Hz · B→741 Hz · luminance→40 Hz coherence carrier",
            },
            {
              color: "#4A9EFF",
              title: "Biofield Overlay",
              desc: "Spectral base + pixel-driven Schumann / Rife / Solfeggio carriers",
            },
          ].map((m) => (
            <View
              key={m.title}
              style={[styles.modeCard, { borderLeftColor: m.color }]}
            >
              <Text style={[styles.modeCardTitle, { color: m.color }]}>{m.title}</Text>
              <Text style={styles.modeCardDesc}>{m.desc}</Text>
            </View>
          ))}
        </View>

        {/* ── Recent images ─────────────────────────────────────────────── */}
        {state.recentImages.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>Recent</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {state.recentImages.map((r) => (
                <Pressable
                  key={r.uri}
                  style={({ pressed }) => [
                    styles.recentThumb,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => openRecent(r.uri)}
                >
                  <Image
                    source={{ uri: r.uri }}
                    style={styles.recentImg}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  appTitle: {
    fontSize: 34,
    fontWeight: "900",
    color: "#E6EDF3",
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 14,
    color: "#7D8590",
    marginTop: 4,
    marginBottom: 20,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    gap: 2,
    marginBottom: 8,
  },
  waveBar: {
    width: Math.floor((SCREEN_W - 32 - BAR_COUNT * 2) / BAR_COUNT),
    borderRadius: 2,
    minHeight: 4,
  },
  tagline: {
    fontSize: 11,
    color: "#7D8590",
    fontStyle: "italic",
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2ECC9A",
    paddingVertical: 14,
    borderRadius: 14,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#161B22",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2ECC9A",
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#0D1117" },
  secondaryBtnText: { fontSize: 16, fontWeight: "700", color: "#2ECC9A" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  modeCards: { paddingHorizontal: 16, gap: 10, marginBottom: 24 },
  modeCard: {
    backgroundColor: "#161B22",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#30363D",
    borderLeftWidth: 3,
    padding: 14,
  },
  modeCardTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  modeCardDesc: { fontSize: 12, color: "#7D8590", lineHeight: 17 },
  recentSection: { paddingHorizontal: 16 },
  recentTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E6EDF3",
    marginBottom: 10,
  },
  recentThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: "hidden",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  recentImg: { width: "100%", height: "100%" },
});
