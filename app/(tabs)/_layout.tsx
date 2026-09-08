import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#34E3A4",
        tabBarInactiveTintColor: "#7D8590",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: "#111820",
          borderTopColor: "#2A3744",
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Sonify",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="waveform" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="image-music"
        options={{
          title: "Image Music",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="music.note" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="musical"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="frequencies"
        options={{
          title: "Freqs",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="music.note.list" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="brain"
        options={{
          title: "Brain",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="brain" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: "Theory",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="atom" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
