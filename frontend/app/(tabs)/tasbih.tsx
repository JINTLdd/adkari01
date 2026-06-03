import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, ImageBackground } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, COLORS } from "@/src/context/ThemeContext";
import { tasbihDhikrs } from "@/src/data/otherAdhkar";
import { storage } from "@/src/utils/storage";

const BG_NIGHT = "https://static.prod-images.emergentagent.com/jobs/dce11d34-2ba4-4431-b8a4-c4429f74ac6d/images/38b4c2660d186a55ee6ab1c1ebc4f40f0684afaaf3473681d64dc024f6b3a49d.png";
const BG_DAY = "https://static.prod-images.emergentagent.com/jobs/dce11d34-2ba4-4431-b8a4-c4429f74ac6d/images/479150ae83126462622680af692f833bf5338320e2ace7c8bd9d8d6b1312c494.png";

export default function TasbihScreen() {
  const { mode, colors } = useTheme();
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [totalToday, setTotalToday] = useState(0);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const scaleRef = useRef(new Animated.Value(1));
  const scale = scaleRef.current;

  const current = tasbihDhikrs[index];
  const progress = Math.min(count / current.target, 1);

  useEffect(() => {
    (async () => {
      const savedTotal = await storage.getItem<number>("tasbih_total", 0);
      setTotalToday(savedTotal || 0);
      const haptic = await storage.getItem<boolean>("settings_vibration", true);
      setHapticEnabled(haptic !== false);
    })();
  }, []);

  const handleTap = async () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    const newCount = count + 1;
    const newTotal = totalToday + 1;
    setTotalToday(newTotal);
    storage.setItem("tasbih_total", newTotal);

    if (hapticEnabled) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore
      }
    }

    if (newCount >= current.target) {
      if (hapticEnabled) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(
            () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
            200
          );
        } catch {
          // ignore
        }
      }
      if (index === tasbihDhikrs.length - 1) {
        setCount(newCount);
        setTimeout(() => {
          setIndex(0);
          setCount(0);
        }, 1500);
      } else {
        setTimeout(() => {
          setIndex(index + 1);
          setCount(0);
        }, 600);
      }
    } else {
      setCount(newCount);
    }
  };

  const handleReset = () => {
    setIndex(0);
    setCount(0);
  };

  return (
    <ImageBackground
      source={{ uri: mode === "day" ? BG_DAY : BG_NIGHT }}
      style={[styles.container, { backgroundColor: colors.bg }]}
      resizeMode="cover"
      imageStyle={{ opacity: 0.18 }}
    >
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Decorative top divider */}
        <View style={styles.topDecor}>
          <View style={styles.decorLine} />
          <Ionicons name="diamond-outline" size={16} color={COLORS.gold} />
          <View style={styles.decorLine} />
        </View>

        <View style={styles.headerWrap}>
          <Text style={styles.title}>المسبحة الإلكترونية</Text>
          <Text style={styles.subtitle}>﴿فَاذْكُرُوا اللَّهَ ذِكْرًا كَثِيرًا﴾</Text>
        </View>

        <View style={styles.dhikrPlate}>
          <Text style={styles.dhikrText}>{current.text}</Text>
          <Text style={styles.dhikrTarget}>الهدف: {current.target}</Text>
        </View>

        <View style={styles.counterArea}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <TouchableOpacity
              testID="tasbih-button"
              style={styles.bigButton}
              onPress={handleTap}
              activeOpacity={0.9}
            >
              <View style={styles.outerRing} />
              <View style={styles.innerCircle}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                <Text style={styles.bigNumber}>{count}</Text>
                <Text style={styles.bigTarget}>/ {current.target}</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>
              {index + 1}/{tasbihDhikrs.length}
            </Text>
            <Text style={styles.statLabel}>المرحلة</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{totalToday}</Text>
            <Text style={styles.statLabel}>إجمالي التسبيحات</Text>
          </View>
        </View>

        <TouchableOpacity
          testID="reset-tasbih-btn"
          style={styles.resetBtn}
          onPress={handleReset}
        >
          <Ionicons name="refresh" size={20} color={COLORS.gold} />
          <Text style={styles.resetBtnText}>إعادة تعيين</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 20, paddingBottom: 16 },
  topDecor: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    gap: 6,
  },
  decorLine: { width: 110, height: 1.2, backgroundColor: "rgba(212,175,55,0.55)" },
  headerWrap: { alignItems: "center", marginTop: 14, marginBottom: 16 },
  title: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", letterSpacing: 0.5 },
  subtitle: { color: "rgba(255,255,255,0.7)", fontSize: 15, marginTop: 6 },
  dhikrPlate: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(212,175,55,0.25)",
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
  },
  dhikrText: { color: "#FFFFFF", fontSize: 24, fontWeight: "700", textAlign: "center" },
  dhikrTarget: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 },
  counterArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  bigButton: {
    width: 230,
    height: 230,
    aspectRatio: 1,
    borderRadius: 115,
    alignItems: "center",
    justifyContent: "center",
  },
  outerRing: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 2,
    borderColor: COLORS.gold,
    opacity: 0.6,
  },
  innerCircle: {
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderColor: COLORS.gold,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    elevation: 12,
  },
  progressFill: {
    position: "absolute",
    left: 0,
    bottom: 0,
    height: "100%",
    backgroundColor: "rgba(212,175,55,0.18)",
  },
  bigNumber: { color: "#FFFFFF", fontSize: 72, fontWeight: "800", lineHeight: 76 },
  bigTarget: { color: "rgba(255,255,255,0.7)", fontSize: 18, fontWeight: "600", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statChip: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderColor: "rgba(212,175,55,0.3)",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  statValue: { color: COLORS.goldLight, fontSize: 22, fontWeight: "800" },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    borderColor: "rgba(212,175,55,0.4)",
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  resetBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
