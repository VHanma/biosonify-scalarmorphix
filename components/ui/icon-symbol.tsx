import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING: IconMapping = {
  // Navigation
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  // BioSonify specific
  "waveform": "graphic-eq",
  "waveform.circle.fill": "graphic-eq",
  "music.note": "music-note",
  "music.note.list": "queue-music",
  "photo": "photo",
  "photo.fill": "photo",
  "camera.fill": "camera-alt",
  "play.fill": "play-arrow",
  "pause.fill": "pause",
  "stop.fill": "stop",
  "square.and.arrow.up": "share",
  "arrow.down.circle": "download",
  "info.circle": "info",
  "info.circle.fill": "info",
  "checkmark.circle.fill": "check-circle",
  "xmark.circle.fill": "cancel",
  "slider.horizontal.3": "tune",
  "dna": "biotech",
  "atom": "science",
  "bolt.fill": "bolt",
  "sparkles": "auto-awesome",
  "list.bullet": "list",
  "clock.arrow.circlepath": "history",
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const mappedName = MAPPING[name] ?? "help-outline";
  return <MaterialIcons color={color} size={size} name={mappedName} style={style} />;
}
