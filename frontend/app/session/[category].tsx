import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useTheme, COLORS } from "@/src/context/ThemeContext";
import { morningEveningAdhkar, DhikrItem } from "@/src/data/morningAdhkar";
import { wakeupAdhkar, afterPrayerAdhkar } from "@/src/data/otherAdhkar";
import { sleepAdhkarExpanded } from "@/src/data/extraAdhkar";
import { playAudio, stopCurrent, pauseCurrent, resumeCurrent } from "@/src/utils/audioPlayer";
import { storage } from "@/src/utils/storage";
import { PatternBackground } from "@/src/components/PatternBackground";

const CATEGORY_MAP: Record<string, { title: string; items: DhikrItem[] }> = {
  morning: { title: "أذكار الصباح", items: morningEveningAdhkar },
  evening: { title: "أذكار المساء", items: morningEveningAdhkar },
  sleep: { title: "أذكار النوم", items: sleepAdhkarExpanded },
  wakeup: { title: "أذكار الاستيقاظ من النوم", items: wakeupAdhkar },
  "after-prayer": { title: "أذكار بعد الصلاة", items: afterPrayerAdhkar },
};

export default function Session() {
  const { category, autoplay } = useLocalSearchParams<{ category: string; autoplay?: string }>();
  const { colors } = useTheme();
  const config = CATEGORY_MAP[category || ""] || CATEGORY_MAP.morning;
  const { title, items } = config;

  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const autoplayDone = useRef(false);

  const current = items[index];
  const isLast = index === items.length - 1;

  useEffect(() => {
    return () => {
      stopCurrent();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [index]);

  // Auto-play first dhikr's audio when entering any of the auto sections
  // (morning/evening/sleep/wakeup), OR when opened via notification (autoplay=1)
  useEffect(() => {
    if (autoplayDone.current) return;
    const autoSections = ["morning", "evening", "sleep", "wakeup"];
    const shouldAutoplay = autoplay === "1" || autoSections.includes(category || "");
    if (shouldAutoplay && current?.audioUrl) {
      autoplayDone.current = true;
      (async () => {
        setAudioLoading(true);
        await playAudio(current.audioUrl, {
          onStatus: (s) => setIsPlaying(s.isPlaying),
          onFinish: () => setIsPlaying(false),
        });
        setAudioLoading(false);
        setIsPlaying(true);
      })();
    }
  }, [category, autoplay, current]);

  const handleTap = async () => {
    if (count + 1 >= current.count) {
      // Reached target
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // ignore
      }
      if (isLast) {
        setCount(current.count);
        setCompleted(true);
        await stopCurrent();
      } else {
        // Advance
        setTimeout(() => {
          setIndex((i) => i + 1);
          setCount(0);
          setIsPlaying(false);
          stopCurrent();
        }, 400);
      }
    } else {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore
      }
      setCount((c) => c + 1);
    }
  };

  const handlePlay = async () => {
    if (!current.audioUrl) {
      Alert.alert("تنبيه", "لا يوجد ملف صوتي لهذا الذكر");
      return;
    }
    if (isPlaying) {
      await pauseCurrent();
      setIsPlaying(false);
      return;
    }
    setAudioLoading(true);
    await playAudio(current.audioUrl, {
      onStatus: (s) => setIsPlaying(s.isPlaying),
      onFinish: () => setIsPlaying(false),
    });
    setAudioLoading(false);
    setIsPlaying(true);
  };

  const handleReset = () => {
    setIndex(0);
    setCount(0);
    setCompleted(false);
    setIsPlaying(false);
    stopCurrent();
  };

  const handleSkip = () => {
    if (isLast) {
      setCompleted(true);
      stopCurrent();
      return;
    }
    setIndex((i) => i + 1);
    setCount(0);
    setIsPlaying(false);
    stopCurrent();
  };

  if (completed) {
    return (
      <PatternBackground>
        <SafeAreaView style={styles.container}>
        <View style={styles.completedWrap}>
          <View style={[styles.completedCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="checkmark-circle" size={92} color={COLORS.gold} />
            <Text style={styles.completedTitle}>تم بفضل الله</Text>
            <Text style={styles.completedText}>انتهيت من {title}</Text>
            <Text style={styles.completedDua}>
              تَقَبَّلَ اللَّهُ مِنْكَ صَالِحَ الأَعْمَالِ
            </Text>
            <TouchableOpacity
              testID="restart-session-btn"
              style={styles.primaryBtn}
              onPress={handleReset}
            >
              <Text style={styles.primaryBtnText}>إعادة من البداية</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="back-home-btn"
              style={styles.secondaryBtn}
              onPress={() => router.back()}
            >
              <Text style={styles.secondaryBtnText}>العودة للرئيسية</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
      </PatternBackground>
    );
  }

  const progress = current.count > 0 ? Math.min(count / current.count, 1) : 0;

  return (
    <PatternBackground>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-forward" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.topBarTextWrap}>
          <Text style={styles.topBarTitle}>{title}</Text>
          <Text style={styles.topBarSub}>
            {index + 1} من {items.length}
          </Text>
        </View>
        {isPlaying ? (
          <TouchableOpacity
            testID="stop-audio-top"
            onPress={async () => {
              await stopCurrent();
              setIsPlaying(false);
            }}
            hitSlop={10}
            style={styles.stopBtnTop}
          >
            <Ionicons name="stop" size={20} color="#1a1a1a" />
            <Text style={styles.stopBtnTopText}>إيقاف</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity testID="skip-btn" onPress={handleSkip} hitSlop={10}>
            <Ionicons name="play-skip-back" size={24} color={COLORS.gold} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.progressOverall}>
        <View
          style={[
            styles.progressOverallFill,
            { width: `${((index + 1) / items.length) * 100}%` },
          ]}
        />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.dhikrCard, { backgroundColor: colors.surface }]}>
          <Text style={styles.dhikrTitle}>{current.title}</Text>
          <View style={styles.divider} />
          <Text style={styles.dhikrText}>{current.text}</Text>
        </View>

        <View style={[styles.playerCard, { backgroundColor: colors.surfaceAlt }]}>
          <TouchableOpacity
            testID="play-audio-btn"
            style={styles.playButton}
            onPress={handlePlay}
            disabled={audioLoading}
          >
            {audioLoading ? (
              <ActivityIndicator color="#1a1a1a" />
            ) : (
              <Ionicons name={isPlaying ? "pause" : "play"} size={32} color="#1a1a1a" />
            )}
          </TouchableOpacity>
          <View style={styles.playerInfo}>
            <Text style={styles.playerLabel}>مشغّل الصوت</Text>
            <Text style={styles.playerSubLabel}>
              {isPlaying ? "يتم التشغيل..." : "اضغط للاستماع"}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.counterArea, { backgroundColor: colors.surface }]}>
        <Text style={styles.counterHint}>اضغط الزر للعد</Text>
        <TouchableOpacity
          testID="dhikr-counter-btn"
          style={styles.counterButton}
          onPress={handleTap}
          activeOpacity={0.85}
        >
          <View style={[styles.counterProgressFill, { width: `${progress * 100}%` }]} />
          <Text style={styles.counterNumber}>
            {count} / {current.count}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    </PatternBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  topBarTextWrap: { flex: 1, alignItems: "center" },
  topBarTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  topBarSub: { color: "#CBD5E1", fontSize: 13, marginTop: 2 },
  progressOverall: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressOverallFill: { height: "100%", backgroundColor: COLORS.gold },
  scrollContent: { padding: 16, paddingBottom: 20 },
  dhikrCard: {
    borderRadius: 24,
    padding: 24,
    borderColor: "rgba(212,175,55,0.3)",
    borderWidth: 1,
    marginBottom: 14,
  },
  dhikrTitle: { color: COLORS.goldLight, fontSize: 20, fontWeight: "700", textAlign: "center", fontFamily: "Amiri_700Bold" },
  divider: { height: 1, backgroundColor: "rgba(212,175,55,0.3)", marginVertical: 14 },
  dhikrText: { color: "#FFFFFF", fontSize: 26, lineHeight: 50, textAlign: "center", fontFamily: "Amiri_400Regular" },
  playerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    gap: 14,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  playerInfo: { flex: 1 },
  playerLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  playerSubLabel: { color: "#CBD5E1", fontSize: 13, marginTop: 4 },
  counterArea: {
    padding: 20,
    paddingTop: 16,
    borderTopColor: "rgba(212,175,55,0.25)",
    borderTopWidth: 1,
  },
  counterHint: { color: "#CBD5E1", fontSize: 12, textAlign: "center", marginBottom: 8 },
  counterButton: {
    height: 90,
    borderRadius: 24,
    backgroundColor: "rgba(212,175,55,0.18)",
    borderColor: COLORS.gold,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  counterProgressFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(212,175,55,0.45)",
  },
  counterNumber: { color: "#FFFFFF", fontSize: 36, fontWeight: "800" },
  stopBtnTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: COLORS.gold,
  },
  stopBtnTopText: { color: "#1a1a1a", fontSize: 13, fontWeight: "800" },
  completedWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  completedCard: {
    width: "100%",
    padding: 32,
    borderRadius: 24,
    alignItems: "center",
    borderColor: COLORS.gold,
    borderWidth: 1.5,
  },
  completedTitle: { color: COLORS.goldLight, fontSize: 30, fontWeight: "800", marginTop: 16 },
  completedText: { color: "#FFFFFF", fontSize: 20, marginTop: 8, textAlign: "center" },
  completedDua: { color: "#E2E8F0", fontSize: 16, marginTop: 14, textAlign: "center", lineHeight: 26 },
  primaryBtn: {
    backgroundColor: COLORS.gold,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginTop: 24,
    alignSelf: "stretch",
  },
  primaryBtnText: { color: "#1a1a1a", fontSize: 17, fontWeight: "800", textAlign: "center" },
  secondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginTop: 10,
    borderColor: "rgba(255,255,255,0.3)",
    borderWidth: 1,
    alignSelf: "stretch",
  },
  secondaryBtnText: { color: "#FFFFFF", fontSize: 16, textAlign: "center" },
});
