import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTheme, COLORS } from "@/src/context/ThemeContext";
import { adhanOptions, cities, postAdhanDua } from "@/src/data/otherAdhkar";
import { getPrayerTimes, formatTime, getNextPrayer, PRAYER_LABELS_AR, PrayerName } from "@/src/utils/prayerTimes";
import { playAudio, stopCurrent, pauseCurrent } from "@/src/utils/audioPlayer";
import { storage } from "@/src/utils/storage";
import { PatternBackground } from "@/src/components/PatternBackground";
import { PRAYER_MOSQUE_IMAGES, AZAN_TEXT_LINES } from "@/src/data/floatingDuas";

const MOSQUE_IMG = "https://images.unsplash.com/photo-1692566123227-0f68f1b9dac6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwyfHxwcm9waGV0JTIwbW9zcXVlJTIwbWFkaW5haHxlbnwwfHx8fDE3Nzg4NjI4Nzh8MA&ixlib=rb-4.1.0&q=85";

export default function AdhanScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ autoplay?: string; prayer?: string }>();
  const [cityId, setCityId] = useState<string>("aden");
  const [coords, setCoords] = useState({ lat: 12.7855, lng: 45.0187 });
  const [selectedMuezzin, setSelectedMuezzin] = useState(adhanOptions[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAdhanFull, setShowAdhanFull] = useState(false);
  const [activePrayer, setActivePrayer] = useState<PrayerName>("fajr");
  const [azanLineIdx, setAzanLineIdx] = useState(0);
  const [showDuaPopup, setShowDuaPopup] = useState(false);
  const [duaPlaying, setDuaPlaying] = useState(false);
  const lastAdhanRef = useRef<{ prayer: PrayerName; ts: number } | null>(null);
  const handledParamRef = useRef(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    (async () => {
      const savedCity = await storage.getItem<string>("adhan_city", "aden");
      const savedMuezzin = await storage.getItem<number>("adhan_muezzin", 1);
      if (savedCity) handleCityChange(savedCity, false);
      const m = adhanOptions.find((a) => a.id === savedMuezzin);
      if (m) setSelectedMuezzin(m);
    })();
  }, []);

  // Tick every minute for next prayer countdown + auto-play check
  useEffect(() => {
    const interval = setInterval(() => {
      forceTick((x) => x + 1);
      checkAutoAdhan();
    }, 30 * 1000);
    return () => clearInterval(interval);
  }, [coords, selectedMuezzin]);

  // Initial check
  useEffect(() => {
    checkAutoAdhan();
  }, [coords]);

  // When opened from a prayer notification → auto-show full-screen azan
  useEffect(() => {
    if (handledParamRef.current) return;
    if (params.autoplay === "1" && params.prayer) {
      handledParamRef.current = true;
      const p = String(params.prayer) as PrayerName;
      setActivePrayer(p);
      setShowAdhanFull(true);
      handlePlayAdhan(true);
    }
  }, [params.autoplay, params.prayer]);

  // Cycle azan text lines while playing
  useEffect(() => {
    if (!showAdhanFull || !isPlaying) return;
    const t = setInterval(() => {
      setAzanLineIdx((i) => (i + 1) % AZAN_TEXT_LINES.length);
    }, 3500);
    return () => clearInterval(t);
  }, [showAdhanFull, isPlaying]);

  const checkAutoAdhan = async () => {
    const times = getPrayerTimes(coords.lat, coords.lng);
    const now = new Date();
    const order: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
    for (const p of order) {
      const diffSec = Math.abs((times[p].getTime() - now.getTime()) / 1000);
      if (diffSec < 45) {
        const lastTs = lastAdhanRef.current?.ts || 0;
        if (lastAdhanRef.current?.prayer === p && Date.now() - lastTs < 5 * 60 * 1000) return;
        lastAdhanRef.current = { prayer: p, ts: Date.now() };
        setActivePrayer(p);
        setShowAdhanFull(true);
        await handlePlayAdhan(true);
        return;
      }
    }
  };

  const handleCityChange = async (id: string, save = true) => {
    setCityId(id);
    if (save) await storage.setItem("adhan_city", id);

    if (id === "current") {
      // Show pre-permission explanation
      const goAhead = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "تحديد موقعك 📍",
          "نحتاج إذن الموقع لحساب مواقيت الصلاة في مدينتك بدقة. لن نشارك موقعك مع أي جهة.",
          [
            { text: "إلغاء", style: "cancel", onPress: () => resolve(false) },
            { text: "متابعة", onPress: () => resolve(true) },
          ]
        );
      });
      if (!goAhead) {
        setCityId("aden");
        return;
      }
      const perm = await Location.getForegroundPermissionsAsync();
      let status = perm.status;
      if (status !== "granted") {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
        if (status !== "granted" && !req.canAskAgain) {
          Alert.alert(
            "إذن الموقع معطل",
            "لاستخدام موقعك، يرجى تفعيل إذن الموقع من إعدادات الهاتف.",
            [
              { text: "ليس الآن", style: "cancel" },
              { text: "فتح الإعدادات", onPress: () => Linking.openSettings().catch(() => {}) },
            ]
          );
        }
      }
      if (status !== "granted") {
        setCityId("aden");
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({});
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        Alert.alert("خطأ", "تعذر تحديد الموقع");
      }
    } else {
      const city = cities.find((c) => c.id === id);
      if (city) setCoords({ lat: city.lat, lng: city.lng });
    }
  };

  const handlePlayAdhan = async (showDua = false) => {
    if (isPlaying) {
      await pauseCurrent();
      setIsPlaying(false);
      return;
    }
    setLoading(true);
    await playAudio(selectedMuezzin.url, {
      onStatus: (s) => setIsPlaying(s.isPlaying),
      onFinish: () => {
        setIsPlaying(false);
        if (showDua) {
          setShowDuaPopup(true);
          setTimeout(() => playPostAdhanDua(), 600);
        }
      },
    });
    setLoading(false);
    setIsPlaying(true);
  };

  const playPostAdhanDua = async () => {
    setDuaPlaying(true);
    await playAudio(postAdhanDua.audioUrl, {
      onStatus: (s) => setDuaPlaying(s.isPlaying),
      onFinish: () => setDuaPlaying(false),
    });
  };

  const closeDuaPopup = async () => {
    await stopCurrent();
    setDuaPlaying(false);
    setShowDuaPopup(false);
  };

  const handleMuezzinSelect = async (id: number) => {
    const m = adhanOptions.find((a) => a.id === id);
    if (m) {
      setSelectedMuezzin(m);
      await storage.setItem("adhan_muezzin", id);
    }
  };

  const times = getPrayerTimes(coords.lat, coords.lng);
  const next = getNextPrayer(times);
  const order: PrayerName[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

  const minsTo = Math.floor((next.time.getTime() - Date.now()) / 60000);
  const hrsTo = Math.floor(minsTo / 60);
  const remMins = minsTo % 60;

  return (
    <PatternBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>الأذان ومواقيت الصلاة</Text>

        {/* Next prayer card */}
        <View style={[styles.nextCard, { backgroundColor: colors.surface }]}>
          <Text style={styles.nextLabel}>الصلاة القادمة</Text>
          <Text style={styles.nextPrayer}>{PRAYER_LABELS_AR[next.name]}</Text>
          <Text style={styles.nextTime}>{formatTime(next.time)}</Text>
          <Text style={styles.nextCountdown}>
            {minsTo > 0
              ? `بعد ${hrsTo > 0 ? `${hrsTo} ساعة و ` : ""}${remMins} دقيقة`
              : "حان وقت الصلاة"}
          </Text>
        </View>

        {/* City selector */}
        <Text style={styles.sectionLabel}>المدينة</Text>
        <View style={styles.cityRow}>
          {cities.map((c) => (
            <TouchableOpacity
              key={c.id}
              testID={`city-${c.id}`}
              style={[
                styles.cityChip,
                { backgroundColor: colors.surface },
                cityId === c.id && { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
              ]}
              onPress={() => handleCityChange(c.id)}
            >
              <Text style={[styles.cityChipText, cityId === c.id && { color: "#1a1a1a", fontWeight: "800" }]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Prayer times list */}
        <Text style={styles.sectionLabel}>مواقيت اليوم</Text>
        <View style={[styles.timesCard, { backgroundColor: colors.surface }]}>
          {order.map((p) => (
            <View key={p} style={styles.timeRow}>
              <Text style={[styles.timeName, next.name === p && { color: COLORS.gold }]}>
                {PRAYER_LABELS_AR[p]}
              </Text>
              <Text style={[styles.timeValue, next.name === p && { color: COLORS.gold }]}>
                {formatTime(times[p])}
              </Text>
            </View>
          ))}
        </View>

        {/* Play adhan */}
        <Text style={styles.sectionLabel}>تشغيل الأذان</Text>
        <View style={[styles.playerCard, { backgroundColor: colors.surface }]}>
          <Text style={styles.muezzinName}>{selectedMuezzin.name}</Text>
          <TouchableOpacity
            testID="play-adhan-btn"
            style={styles.bigPlayBtn}
            onPress={() => handlePlayAdhan(true)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#1a1a1a" size="large" />
            ) : (
              <Ionicons name={isPlaying ? "pause" : "play"} size={48} color="#1a1a1a" />
            )}
          </TouchableOpacity>
          <Text style={styles.playerHint}>اضغط لتشغيل الأذان</Text>
        </View>

        {/* Muezzin options */}
        <Text style={styles.sectionLabel}>اختر المؤذن (8 خيارات)</Text>
        {adhanOptions.map((m) => (
          <TouchableOpacity
            key={m.id}
            testID={`muezzin-${m.id}`}
            style={[
              styles.muezzinRow,
              { backgroundColor: colors.surface },
              selectedMuezzin.id === m.id && { borderColor: COLORS.gold, borderWidth: 2 },
            ]}
            onPress={() => handleMuezzinSelect(m.id)}
          >
            <Ionicons
              name={selectedMuezzin.id === m.id ? "radio-button-on" : "radio-button-off"}
              size={24}
              color={selectedMuezzin.id === m.id ? COLORS.gold : "#CBD5E1"}
            />
            <Text style={styles.muezzinRowText}>{m.name}</Text>
          </TouchableOpacity>
        ))}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Full-screen Adhan popup */}
      <Modal visible={showAdhanFull} transparent animationType="fade" onRequestClose={() => setShowAdhanFull(false)}>
        <View style={styles.fullScreenAdhan}>
          <Image
            source={{ uri: PRAYER_MOSQUE_IMAGES[activePrayer] || MOSQUE_IMG }}
            style={styles.fullMosqueImg}
            resizeMode="cover"
          />
          <View style={styles.fullOverlay} />
          <View style={styles.fullContent}>
            <Text style={styles.fullPrayerLabel}>حان وقت صلاة</Text>
            <Text style={styles.fullPrayerName}>{PRAYER_LABELS_AR[activePrayer]}</Text>
            <View style={styles.azanBox}>
              <Text style={styles.azanText}>{AZAN_TEXT_LINES[azanLineIdx]}</Text>
            </View>
            <View style={styles.fullButtons}>
              <TouchableOpacity
                testID="stop-adhan-btn"
                style={[styles.fullBtn, { backgroundColor: "#DC2626" }]}
                onPress={async () => {
                  await stopCurrent();
                  setIsPlaying(false);
                  setShowAdhanFull(false);
                }}
              >
                <Ionicons name="stop" size={24} color="#FFFFFF" />
                <Text style={styles.fullBtnText}>إيقاف الأذان</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="close-fullscreen-adhan"
                style={[styles.fullBtn, { backgroundColor: "rgba(255,255,255,0.18)" }]}
                onPress={() => setShowAdhanFull(false)}
              >
                <Ionicons name="contract" size={22} color="#FFFFFF" />
                <Text style={styles.fullBtnText}>تصغير</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Post-adhan Dua Popup */}
      <Modal visible={showDuaPopup} transparent animationType="fade" onRequestClose={closeDuaPopup}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.duaModal, { backgroundColor: colors.surface }]}>
            <Image source={{ uri: MOSQUE_IMG }} style={styles.mosqueImg} />
            <View style={styles.duaContent}>
              <Text style={styles.duaTitle}>دعاء بعد الأذان</Text>
              <Text style={styles.duaText}>{postAdhanDua.text}</Text>
              <View style={styles.duaButtons}>
                <TouchableOpacity
                  testID="dua-play-btn"
                  style={[styles.duaBtn, { backgroundColor: COLORS.gold }]}
                  onPress={duaPlaying ? () => { stopCurrent(); setDuaPlaying(false); } : playPostAdhanDua}
                >
                  <Ionicons name={duaPlaying ? "pause" : "play"} size={22} color="#1a1a1a" />
                  <Text style={styles.duaBtnText}>{duaPlaying ? "إيقاف" : "استمع"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="dua-close-btn"
                  style={[styles.duaBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
                  onPress={closeDuaPopup}
                >
                  <Ionicons name="close" size={22} color="#FFFFFF" />
                  <Text style={[styles.duaBtnText, { color: "#FFFFFF" }]}>إغلاق</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </PatternBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  pageTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 16 },
  nextCard: {
    padding: 22,
    borderRadius: 24,
    alignItems: "center",
    borderColor: "rgba(212,175,55,0.4)",
    borderWidth: 1,
    marginBottom: 20,
  },
  nextLabel: { color: "#CBD5E1", fontSize: 14, marginBottom: 4 },
  nextPrayer: { color: COLORS.goldLight, fontSize: 32, fontWeight: "800" },
  nextTime: { color: "#FFFFFF", fontSize: 28, fontWeight: "700", marginTop: 6 },
  nextCountdown: { color: "#E2E8F0", fontSize: 14, marginTop: 6 },
  sectionLabel: { color: "#CBD5E1", fontSize: 14, fontWeight: "600", marginBottom: 10, marginRight: 4 },
  cityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  cityChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
  },
  cityChipText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  timesCard: { padding: 16, borderRadius: 20, marginBottom: 20 },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 1,
  },
  timeName: { color: "#FFFFFF", fontSize: 17, fontWeight: "600" },
  timeValue: { color: "#E2E8F0", fontSize: 17, fontWeight: "700" },
  playerCard: { padding: 24, borderRadius: 24, alignItems: "center", marginBottom: 20 },
  muezzinName: { color: COLORS.goldLight, fontSize: 16, fontWeight: "700", marginBottom: 16 },
  bigPlayBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  playerHint: { color: "#CBD5E1", fontSize: 13 },
  muezzinRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    gap: 12,
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
  },
  muezzinRowText: { color: "#FFFFFF", fontSize: 15, flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  duaModal: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    borderColor: COLORS.gold,
    borderWidth: 1.5,
  },
  mosqueImg: { width: "100%", height: 200 },
  duaContent: { padding: 20 },
  duaTitle: { color: COLORS.goldLight, fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  duaText: { color: "#FFFFFF", fontSize: 17, lineHeight: 32, textAlign: "center" },
  duaButtons: { flexDirection: "row", gap: 10, marginTop: 20 },
  duaBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 14,
    gap: 8,
  },
  duaBtnText: { color: "#1a1a1a", fontSize: 16, fontWeight: "800" },
  fullScreenAdhan: { flex: 1, backgroundColor: "#000" },
  fullMosqueImg: { ...StyleSheet.absoluteFillObject },
  fullOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  fullContent: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  fullPrayerLabel: { color: "#F2D77D", fontSize: 22, marginBottom: 4 },
  fullPrayerName: { color: "#FFFFFF", fontSize: 56, fontWeight: "800", marginBottom: 40 },
  azanBox: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderColor: COLORS.gold,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 28,
    marginBottom: 40,
    minHeight: 100,
    justifyContent: "center",
  },
  azanText: { color: "#FFFFFF", fontSize: 30, fontWeight: "700", textAlign: "center", lineHeight: 46 },
  fullButtons: { flexDirection: "row", gap: 12, alignSelf: "stretch" },
  fullBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  fullBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
