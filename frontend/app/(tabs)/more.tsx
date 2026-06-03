import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, COLORS } from "@/src/context/ThemeContext";
import { miscAdhkar, istiftahAdhkar } from "@/src/data/otherAdhkar";
import { moreSections } from "@/src/data/extraAdhkar";
import { DhikrItem } from "@/src/data/morningAdhkar";
import { playAudio, stopCurrent } from "@/src/utils/audioPlayer";
import { PatternBackground } from "@/src/components/PatternBackground";

interface Section {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: DhikrItem[];
}

const SECTIONS: Section[] = [
  { id: "misc", title: "أذكار متنوعة", icon: "leaf", items: miscAdhkar },
  { id: "istiftah", title: "أذكار الاستفتاح", icon: "play-circle", items: istiftahAdhkar },
  ...moreSections.map((s) => ({
    id: s.id,
    title: s.title,
    icon: (s.id === "virtues"
      ? "star"
      : s.id === "istighfar"
      ? "refresh-circle"
      : s.id === "protection"
      ? "shield-checkmark"
      : s.id === "salat-nabi"
      ? "heart"
      : "compass") as keyof typeof Ionicons.glyphMap,
    items: s.items,
  })),
];

export default function MoreScreen() {
  const { colors } = useTheme();
  const [openId, setOpenId] = useState<string | null>(SECTIONS[0].id);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handlePlay = async (sectionId: string, item: DhikrItem) => {
    const key = `${sectionId}-${item.id}`;
    if (!item.audioUrl) return;
    if (playingId === key) {
      await stopCurrent();
      setPlayingId(null);
      return;
    }
    setLoadingId(key);
    await playAudio(item.audioUrl, {
      onStatus: (s) => {
        if (!s.isPlaying) setPlayingId((p) => (p === key ? null : p));
      },
      onFinish: () => setPlayingId(null),
    });
    setLoadingId(null);
    setPlayingId(key);
  };

  return (
    <PatternBackground>
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>المزيد من الأذكار</Text>
        <Text style={styles.subtitle}>{SECTIONS.length} أقسام</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {SECTIONS.map((section) => {
          const isOpen = openId === section.id;
          return (
            <View key={section.id} style={[styles.sectionWrap, { backgroundColor: colors.surface }]}>
              <TouchableOpacity
                testID={`section-${section.id}`}
                style={styles.sectionHeader}
                onPress={() => setOpenId(isOpen ? null : section.id)}
                activeOpacity={0.85}
              >
                <Ionicons name={section.icon} size={24} color={COLORS.gold} />
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{section.items.length}</Text>
                </View>
                <Ionicons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={22}
                  color="#CBD5E1"
                />
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.sectionBody}>
                  {section.items.map((item) => {
                    const key = `${section.id}-${item.id}`;
                    return (
                      <View key={key} style={styles.dhikrItem}>
                        <Text style={styles.dhikrItemTitle}>{item.title}</Text>
                        <View style={styles.dhikrDivider} />
                        <Text style={styles.dhikrItemText}>{item.text}</Text>
                        {item.audioUrl ? (
                          <TouchableOpacity
                            testID={`play-${section.id}-${item.id}`}
                            style={styles.playBtn}
                            onPress={() => handlePlay(section.id, item)}
                          >
                            {loadingId === key ? (
                              <ActivityIndicator color="#1a1a1a" />
                            ) : (
                              <Ionicons
                                name={playingId === key ? "pause" : "play"}
                                size={20}
                                color="#1a1a1a"
                              />
                            )}
                            <Text style={styles.playBtnText}>
                              {playingId === key ? "إيقاف" : "استمع"}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
    </PatternBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 8 },
  title: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", textAlign: "center" },
  subtitle: { color: "#CBD5E1", fontSize: 13, textAlign: "center", marginTop: 4 },
  scroll: { padding: 16, paddingBottom: 30 },
  sectionWrap: {
    borderRadius: 18,
    marginBottom: 12,
    overflow: "hidden",
    borderColor: "rgba(212,175,55,0.18)",
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  sectionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", flex: 1 },
  countBadge: {
    backgroundColor: "rgba(212,175,55,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: { color: COLORS.goldLight, fontSize: 12, fontWeight: "700" },
  sectionBody: { padding: 12, paddingTop: 0 },
  dhikrItem: {
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
  },
  dhikrItemTitle: { color: COLORS.goldLight, fontSize: 16, fontWeight: "700", textAlign: "center", fontFamily: "Amiri_700Bold" },
  dhikrDivider: { height: 1, backgroundColor: "rgba(212,175,55,0.2)", marginVertical: 10 },
  dhikrItemText: { color: "#FFFFFF", fontSize: 20, lineHeight: 38, textAlign: "center", marginBottom: 10, fontFamily: "Amiri_400Regular" },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.gold,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  playBtnText: { color: "#1a1a1a", fontSize: 14, fontWeight: "800" },
});
