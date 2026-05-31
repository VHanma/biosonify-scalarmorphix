import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Animated,
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

export default function HomeScreen() {
  const router = useRouter();
  const { state, dispatch } = useSonification();
  const [requesting, setRequesting] = useState(false);

  // Animated waveform bars for hero decoration
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.2))
  ).current;

  useEffect(() => {
    const animations = barAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 0.2 + Math.random() * 0.8,
            duration: 400 + i * 30,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0.1 + Math.random() * 0.3,
            duration: 400 + i * 20,
            useNativeDriver: false,
          }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

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

          {/* Animated waveform bars */}
          <View style={styles.waveformContainer}>
            {barAnims.map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [4, 56],
                    }),
                    backgroundColor:
                      i % 3 === 0
                        ? "#2ECC9A"
                        : i % 3 === 1
                        ? "#F0A500"
                        : "#1A6B5A",
                  },
                ]}
              />
            ))}
          </View>

          <Text style={styles.tagline}>
            Wave Genetics · Solfeggio · Schumann · Rife
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

        {/* ── Mode Cards ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sonification Modes</Text>
          <ModeCard
            icon="photo"
            title="Spectral Scan"
            description="Pixel-by-pixel frequency mapping. Brightness → pitch, color → timbre, position → time."
            color="#2ECC9A"
          />
          <ModeCard
            icon="dna"
            title="Wave Genetics"
            description="Gariaev-inspired: luminance modulates a 40 Hz coherence carrier. RGB channels drive 396 / 528 / 741 Hz Solfeggio tones."
            color="#F0A500"
          />
          <ModeCard
            icon="sparkles"
            title="Biofield Overlay"
            description="Spectral scan + additive synthesis of Schumann resonances, Solfeggio tones, and brainwave carriers."
            color="#1A6B5A"
          />
        </View>

        {/* ── Recent Images ─────────────────────────────────────────────── */}
        {state.recentImages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {state.recentImages.map((item) => (
                <Pressable
                  key={item.uri}
                  style={({ pressed }) => [
                    styles.recentThumb,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => openRecent(item.uri)}
                >
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.recentImage}
                    resizeMode="cover"
                  />
                  <View style={styles.recentOverlay}>
                    <IconSymbol name="play.fill" size={18} color="#fff" />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function ModeCard({
  icon,
  title,
  description,
  color,
}: {
  icon: string;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <View style={[styles.modeCard, { borderLeftColor: color }]}>
      <View style={[styles.modeIconBg, { backgroundColor: color + "22" }]}>
        <IconSymbol name={icon as any} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.modeTitle}>{title}</Text>
        <Text style={styles.modeDesc}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  appTitle: {
    fontSize: 38,
    fontWeight: "800",
    color: "#E6EDF3",
    letterSpacing: 1,
  },
  appSubtitle: {
    fontSize: 15,
    color: "#7D8590",
    marginTop: 4,
    marginBottom: 20,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 64,
    gap: 3,
    marginBottom: 12,
  },
  waveBar: {
    width: Math.floor((SCREEN_W - 64) / BAR_COUNT) - 2,
    borderRadius: 2,
    minHeight: 4,
  },
  tagline: {
    fontSize: 11,
    color: "#2ECC9A",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 28,
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
  primaryBtnText: {
    color: "#0D1117",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#2ECC9A",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  secondaryBtnText: {
    color: "#2ECC9A",
    fontWeight: "700",
    fontSize: 16,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7D8590",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  modeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#161B22",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
  },
  modeIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E6EDF3",
    marginBottom: 3,
  },
  modeDesc: {
    fontSize: 12,
    color: "#7D8590",
    lineHeight: 17,
  },
  recentThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 10,
    overflow: "hidden",
    backgroundColor: "#161B22",
  },
  recentImage: {
    width: "100%",
    height: "100%",
  },
  recentOverlay: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    padding: 4,
  },
});
