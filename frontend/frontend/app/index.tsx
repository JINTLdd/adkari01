import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, COLORS } from "@/src/context/ThemeContext";
import { storage } from "@/src/utils/storage";
import { downloadAllAudio, isAudioDownloaded } from "@/src/utils/audioDownload";
import { rescheduleAll, loadSettings, ensureNotificationPermissions } from "@/src/utils/notifications";

const BG_DAY = "https://static.prod-images.emergentagent.com/jobs/dce11d34-2ba4-4431-b8a4-c4429f74ac6d/images/479150ae83126462622680af692f833bf5338320e2ace7c8bd9d8d6b1312c494.png";
const BG_NIGHT = "https://static.prod-images.emergentagent.com/jobs/dce11d34-2ba4-4431-b8a4-c4429f74ac6d/images/38b4c2660d186a55ee6ab1c1ebc4f40f0684afaaf3473681d64dc024f6b3a49d.png";

export default function Welcome() {
  const { mode, colors, isLoaded } = useTheme();
  const [checked, setChecked] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [percent, setPercent] = useState(0);
  const [progressText, setProgressText] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      const seen = await storage.getItem<boolean>("welcome_seen", false);
      const downloaded = await isAudioDownloaded();
      if (seen || downloaded) {
        router.replace("/(tabs)");
        return;
      }
      setChecked(true);
    })();
  }, [isLoaded]);

  const handleDownload = async () => {
    setDownloading(true);
    setPercent(0);
    setProgressText("جاري التحميل...");
    const ok = await downloadAllAudio((p, i, total) => {
      setPercent(p);
      setProgressText(`جاري تحميل الملف ${i} من ${total}`);
    });
    setDownloading(false);
    if (ok) {
      await storage.setItem("welcome_seen", true);
      // Schedule default notifications
      await ensureNotificationPermissions();
      const settings = await loadSettings();
      await rescheduleAll(settings).catch(() => {});
      Alert.alert("تم بنجاح ✅", "تم التحميل بنجاح، التطبيق يعمل الآن بدون إنترنت", [
        { text: "ابدأ", onPress: () => router.replace("/(tabs)") },
      ]);
    } else {
      Alert.alert("خطأ", "تعذر إكمال التحميل، يمكنك المحاولة لاحقاً من الإعدادات");
    }
  };

  const handleSkip = async () => {
    await storage.setItem("welcome_seen", true);
    await ensureNotificationPermissions();
    const settings = await loadSettings();
    await rescheduleAll(settings).catch(() => {});
    router.replace("/(tabs)");
  };

  if (!checked) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <ImageBackground
      source={{ uri: mode === "day" ? BG_DAY : BG_NIGHT }}
      style={[styles.container, { backgroundColor: colors.bg }]}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.content}>
          <View style={styles.headerBlock}>
            <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</Text>
            <Text style={styles.appName} testID="app-name">أذكاري</Text>
            <View style={styles.divider} />
            <Text style={styles.tagline}>حصن المسلم بين يديك</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>أهلاً بك في أذكاري</Text>
            <Text style={styles.cardText}>
              للاستمتاع بالتطبيق بدون إنترنت، يرجى تحميل الصوتيات مرة واحدة فقط
            </Text>
            <Text style={styles.cardSize}>الحجم التقريبي ~60 ميجا</Text>

            {downloading ? (
              <View style={styles.progressWrap}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                </View>
                <Text style={styles.progressPercent}>{percent}%</Text>
                <Text style={styles.progressText}>{progressText}</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  testID="download-audio-btn"
                  style={styles.primaryButton}
                  onPress={handleDownload}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>تحميل الصوتيات الآن</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="skip-download-btn"
                  style={styles.secondaryButton}
                  onPress={handleSkip}
                  activeOpacity={0.85}
                >
                  <Text style={styles.secondaryButtonText}>تخطي - سأحمل لاحقاً</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <Text style={styles.footer}>أذكار الصباح والمساء • الأذان • التسبيح</Text>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  safe: { flex: 1 },
  content: { flex: 1, justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 24 },
  headerBlock: { alignItems: "center", marginTop: 30 },
  bismillah: { color: COLORS.goldLight, fontSize: 18, textAlign: "center", marginBottom: 14 },
  appName: { color: "#FFFFFF", fontSize: 64, fontWeight: "800", textAlign: "center", letterSpacing: 2 },
  divider: { width: 80, height: 3, backgroundColor: COLORS.gold, marginVertical: 14, borderRadius: 2 },
  tagline: { color: "#E2E8F0", fontSize: 18 },
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(212,175,55,0.4)",
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    marginBottom: 8,
  },
  cardTitle: { color: COLORS.goldLight, fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 10 },
  cardText: { color: "#F8FAFC", fontSize: 16, textAlign: "center", lineHeight: 26, marginBottom: 6 },
  cardSize: { color: "#CBD5E1", fontSize: 14, textAlign: "center", marginBottom: 18 },
  primaryButton: {
    backgroundColor: COLORS.gold,
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 12,
  },
  primaryButtonText: { color: "#1a1a1a", fontSize: 18, fontWeight: "800", textAlign: "center" },
  secondaryButton: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.4)",
    borderWidth: 1.5,
    paddingVertical: 16,
    borderRadius: 16,
  },
  secondaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600", textAlign: "center" },
  progressWrap: { alignItems: "center", paddingVertical: 8 },
  progressBarBg: {
    width: "100%",
    height: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressBarFill: { height: "100%", backgroundColor: COLORS.gold, borderRadius: 8 },
  progressPercent: { color: COLORS.goldLight, fontSize: 28, fontWeight: "800" },
  progressText: { color: "#E2E8F0", fontSize: 14, marginTop: 4 },
  footer: { color: "#CBD5E1", fontSize: 13, textAlign: "center" },
});
