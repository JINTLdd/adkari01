import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme, COLORS } from "@/src/context/ThemeContext";
import { refreshInactiveReminder } from "@/src/utils/notifications";
import { useEffect } from "react";
import { PatternBackground } from "@/src/components/PatternBackground";

interface CategoryCard {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const categories: CategoryCard[] = [
  { id: "qibla", title: "اتجاه القبلة", subtitle: "بوصلة الكعبة بدون إنترنت", icon: "compass", color: "#D4AF37" },
  { id: "morning", title: "أذكار الصباح", subtitle: "24 ذكراً • تشتغل تلقائياً", icon: "sunny", color: "#F59E0B" },
  { id: "evening", title: "أذكار المساء", subtitle: "24 ذكراً • تشتغل تلقائياً", icon: "moon", color: "#6366F1" },
  { id: "wakeup", title: "أذكار الاستيقاظ", subtitle: "عند الاستيقاظ من النوم", icon: "alarm-outline", color: "#10B981" },
  { id: "sleep", title: "أذكار النوم", subtitle: "قبل النوم", icon: "bed", color: "#8B5CF6" },
  { id: "after-prayer", title: "أذكار بعد الصلاة", subtitle: "الأذكار المختارة", icon: "ribbon", color: "#06B6D4" },
];

export default function Home() {
  const { colors, mode } = useTheme();

  useEffect(() => {
    // User opened app → reset inactive reminder
    refreshInactiveReminder(true).catch(() => {});
  }, []);

  return (
    <PatternBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title} testID="home-title">أذكاري</Text>
          <Text style={styles.subtitle}>حصن المسلم في جيبك</Text>
        </View>

        <View style={styles.bannerWrap}>
          <View style={[styles.banner, { backgroundColor: colors.surface }]}>
            <Ionicons name="heart" size={28} color={COLORS.gold} />
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerTitle}>تذكير اليوم</Text>
              <Text style={styles.bannerText}>
                مَنْ قَالَ سُبْحَانَ اللَّهِ وَبِحَمْدِهِ في يَوْمٍ مِائَةَ مَرَّةٍ حُطَّتْ خَطَايَاهُ
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>الأقسام الرئيسية</Text>

        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            testID={`category-${c.id}`}
            style={[styles.card, { backgroundColor: colors.surface }]}
            onPress={() => {
              if (c.id === "qibla") {
                router.push("/qibla" as any);
              } else {
                router.push(`/session/${c.id}` as any);
              }
            }}
            activeOpacity={0.85}
          >
            <View style={[styles.iconBubble, { backgroundColor: c.color + "33" }]}>
              <Ionicons name={c.icon} size={28} color={c.color} />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>{c.title}</Text>
              <Text style={styles.cardSubtitle}>{c.subtitle}</Text>
            </View>
            <Ionicons name="chevron-back" size={22} color={COLORS.gold} />
          </TouchableOpacity>
        ))}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
    </PatternBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { alignItems: "center", marginBottom: 24, marginTop: 10 },
  bismillah: { color: COLORS.goldLight, fontSize: 16, marginBottom: 6 },
  title: { color: "#FFFFFF", fontSize: 42, fontWeight: "800", letterSpacing: 1 },
  subtitle: { color: "#CBD5E1", fontSize: 15, marginTop: 4 },
  bannerWrap: { marginBottom: 24 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    borderColor: "rgba(212,175,55,0.3)",
    borderWidth: 1,
    gap: 12,
  },
  bannerTextWrap: { flex: 1 },
  bannerTitle: { color: COLORS.goldLight, fontSize: 13, fontWeight: "700", marginBottom: 2 },
  bannerText: { color: "#F8FAFC", fontSize: 15, lineHeight: 22 },
  sectionLabel: { color: "#CBD5E1", fontSize: 14, marginBottom: 12, marginRight: 4, fontWeight: "600" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    gap: 14,
  },
  iconBubble: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cardTextWrap: { flex: 1 },
  cardTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  cardSubtitle: { color: "#CBD5E1", fontSize: 13 },
});
