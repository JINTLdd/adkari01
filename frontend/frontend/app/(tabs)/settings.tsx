import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, COLORS } from "@/src/context/ThemeContext";
import {
  loadSettings,
  saveSettings,
  rescheduleAll,
  ScheduleSettings,
  DEFAULT_SETTINGS,
  ensureNotificationPermissions,
} from "@/src/utils/notifications";
import { downloadAllAudio, clearDownloadedAudio, isAudioDownloaded } from "@/src/utils/audioDownload";
import { storage } from "@/src/utils/storage";
import { cities } from "@/src/data/otherAdhkar";
import { CURRENT_VERSION, checkForUpdates, promptUpdate } from "@/src/utils/updateCheck";
import { Linking } from "react-native";
import { PatternBackground } from "@/src/components/PatternBackground";

const TIKTOK_URL = "https://www.tiktok.com/@_qra_n";

const PRAYER_OFFSETS = [5, 10, 15, 30];

export default function SettingsScreen() {
  const { mode, colors, toggle } = useTheme();
  const [settings, setSettings] = useState<ScheduleSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [percent, setPercent] = useState(0);
  const [audioDownloaded, setAudioDownloadedState] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [selectedCityId, setSelectedCityId] = useState("aden");

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setSettings(s);
      const d = await isAudioDownloaded();
      setAudioDownloadedState(d);
      const sound = await storage.getItem<boolean>("settings_sound", true);
      const vib = await storage.getItem<boolean>("settings_vibration", true);
      const city = await storage.getItem<string>("adhan_city", "aden");
      setSoundEnabled(sound !== false);
      setVibrationEnabled(vib !== false);
      if (city) setSelectedCityId(city);
      setLoaded(true);
    })();
  }, []);

  const updateSetting = async <K extends keyof ScheduleSettings>(key: K, value: ScheduleSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveSettings(newSettings);
    await ensureNotificationPermissions();
    await rescheduleAll(newSettings);
  };

  const handleCitySelect = async (cityId: string) => {
    const city = cities.find((c) => c.id === cityId);
    if (!city || cityId === "current") return;
    setSelectedCityId(cityId);
    await storage.setItem("adhan_city", cityId);
    const newSettings = { ...settings, cityLat: city.lat, cityLng: city.lng };
    setSettings(newSettings);
    await saveSettings(newSettings);
    await rescheduleAll(newSettings);
  };

  const handleRedownload = async () => {
    Alert.alert("إعادة تحميل الصوتيات", "هل تريد إعادة تحميل جميع الصوتيات؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تحميل",
        onPress: async () => {
          await clearDownloadedAudio();
          setDownloading(true);
          setPercent(0);
          await downloadAllAudio((p) => setPercent(p));
          setDownloading(false);
          setAudioDownloadedState(true);
          Alert.alert("تم", "تم تحميل الصوتيات بنجاح");
        },
      },
    ]);
  };

  if (!loaded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </SafeAreaView>
    );
  }

  return (
    <PatternBackground>
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>الإعدادات</Text>

        {/* Appearance */}
        <Text style={styles.sectionLabel}>المظهر</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.row}>
            <Ionicons name={mode === "day" ? "sunny" : "moon"} size={22} color={COLORS.gold} />
            <Text style={styles.rowLabel}>{mode === "day" ? "وضع النهار" : "وضع الليل"}</Text>
            <Switch
              testID="theme-switch"
              value={mode === "night"}
              onValueChange={toggle}
              trackColor={{ false: "#999", true: COLORS.gold }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Sound & Vibration */}
        <Text style={styles.sectionLabel}>الصوت والاهتزاز</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <SettingRow
            icon="volume-high"
            label="الصوت"
            value={soundEnabled}
            onChange={(v) => {
              setSoundEnabled(v);
              storage.setItem("settings_sound", v);
            }}
            testID="sound-switch"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="phone-portrait"
            label="الاهتزاز"
            value={vibrationEnabled}
            onChange={(v) => {
              setVibrationEnabled(v);
              storage.setItem("settings_vibration", v);
            }}
            testID="vibration-switch"
          />
        </View>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>التنبيهات والإشعارات</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <SettingRow
            icon="sunny"
            label="أذكار الصباح (5:00 ص)"
            value={settings.morningEnabled}
            onChange={(v) => updateSetting("morningEnabled", v)}
            testID="morning-switch"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="moon"
            label="أذكار المساء (5:00 م)"
            value={settings.eveningEnabled}
            onChange={(v) => updateSetting("eveningEnabled", v)}
            testID="evening-switch"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="bed"
            label="أذكار النوم (9:00 م)"
            value={settings.sleepEnabled}
            onChange={(v) => updateSetting("sleepEnabled", v)}
            testID="sleep-switch"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="alarm"
            label="أذكار الاستيقاظ (5:30 ص)"
            value={settings.wakeupEnabled}
            onChange={(v) => updateSetting("wakeupEnabled", v)}
            testID="wakeup-switch"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="time"
            label="صلاة الضحى"
            value={settings.duhaEnabled}
            onChange={(v) => updateSetting("duhaEnabled", v)}
            testID="duha-switch"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="restaurant"
            label="صيام الإثنين والخميس"
            value={settings.mondayThursdayFastingEnabled}
            onChange={(v) => updateSetting("mondayThursdayFastingEnabled", v)}
            testID="fasting-switch"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="book"
            label="تذكير قراءة القرآن (8 م)"
            value={settings.quranReminderEnabled}
            onChange={(v) => updateSetting("quranReminderEnabled", v)}
            testID="quran-switch"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="notifications"
            label="تنبيه قبل الصلاة"
            value={settings.prayerEnabled}
            onChange={(v) => updateSetting("prayerEnabled", v)}
            testID="prayer-switch"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="heart"
            label='إشعار "نفتقدك" عند عدم الاستخدام'
            value={settings.inactiveReminderEnabled}
            onChange={(v) => updateSetting("inactiveReminderEnabled", v)}
            testID="inactive-switch"
          />
        </View>

        {/* Prayer Offset */}
        <Text style={styles.sectionLabel}>التنبيه قبل وقت الصلاة بـ (دقيقة)</Text>
        <View style={styles.chipRow}>
          {PRAYER_OFFSETS.map((m) => (
            <TouchableOpacity
              key={m}
              testID={`offset-${m}`}
              style={[
                styles.chip,
                { backgroundColor: colors.surface },
                settings.prayerOffsetMin === m && { backgroundColor: COLORS.gold },
              ]}
              onPress={() => updateSetting("prayerOffsetMin", m)}
            >
              <Text
                style={[
                  styles.chipText,
                  settings.prayerOffsetMin === m && { color: "#1a1a1a", fontWeight: "800" },
                ]}
              >
                {m} د
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* City for prayer times */}
        <Text style={styles.sectionLabel}>مدينة مواقيت الصلاة</Text>
        <View style={styles.chipRow}>
          {cities.filter((c) => c.id !== "current").map((c) => (
            <TouchableOpacity
              key={c.id}
              testID={`settings-city-${c.id}`}
              style={[
                styles.chip,
                { backgroundColor: colors.surface },
                selectedCityId === c.id && { backgroundColor: COLORS.gold },
              ]}
              onPress={() => handleCitySelect(c.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedCityId === c.id && { color: "#1a1a1a", fontWeight: "800" },
                ]}
              >
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Audio download */}
        <Text style={styles.sectionLabel}>الصوتيات</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.row}>
            <Ionicons name="cloud-download" size={22} color={COLORS.gold} />
            <Text style={styles.rowLabel}>
              {audioDownloaded ? "تم تحميل الصوتيات ✅" : "لم يتم تحميل الصوتيات"}
            </Text>
          </View>
          {downloading ? (
            <View style={{ paddingTop: 12 }}>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${percent}%` }]} />
              </View>
              <Text style={styles.progressText}>{percent}%</Text>
            </View>
          ) : (
            <TouchableOpacity
              testID="redownload-btn"
              style={styles.actionBtn}
              onPress={handleRedownload}
            >
              <Ionicons name="refresh" size={20} color="#1a1a1a" />
              <Text style={styles.actionBtnText}>
                {audioDownloaded ? "إعادة تحميل الصوتيات" : "تحميل الصوتيات"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 20 }} />
        <Text style={styles.sectionLabel}>التطبيق</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            testID="check-update-btn"
            style={styles.row}
            onPress={async () => {
              const r = await checkForUpdates();
              if (r?.shouldUpdate) {
                promptUpdate(r.message, r.url, r.force);
              } else {
                Alert.alert("التطبيق محدّث", "أنت تستخدم أحدث إصدار من أذكاري ✅");
              }
            }}
          >
            <Ionicons name="cloud-upload" size={22} color={COLORS.gold} />
            <Text style={styles.rowLabel}>التحقق من التحديثات</Text>
            <Ionicons name="chevron-back" size={20} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            testID="report-ad-btn"
            style={styles.row}
            onPress={() => Linking.openURL(TIKTOK_URL).catch(() => {})}
          >
            <Ionicons name="alert-circle" size={22} color={COLORS.gold} />
            <Text style={styles.rowLabel}>للإبلاغ عن إعلان مخالف</Text>
            <Text style={styles.rowHint}>@_qra_n</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
        <Text style={styles.versionText}>أذكاري • الإصدار {CURRENT_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
    </PatternBackground>
  );
}

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}

function SettingRow({ icon, label, value, onChange, testID }: SettingRowProps) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={COLORS.gold} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#999", true: COLORS.gold }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  pageTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 18 },
  sectionLabel: { color: "#CBD5E1", fontSize: 14, fontWeight: "600", marginBottom: 8, marginRight: 4, marginTop: 12 },
  card: {
    borderRadius: 18,
    padding: 14,
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  rowLabel: { color: "#FFFFFF", fontSize: 15, flex: 1, fontWeight: "600" },
  rowHint: { color: "#CBD5E1", fontSize: 13 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
  },
  chipText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.gold,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 10,
  },
  actionBtnText: { color: "#1a1a1a", fontSize: 15, fontWeight: "800" },
  progressBg: {
    height: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: COLORS.gold },
  progressText: { color: COLORS.goldLight, fontSize: 14, textAlign: "center", marginTop: 6, fontWeight: "700" },
  versionText: { color: "#94A3B8", fontSize: 12, textAlign: "center" },
});
