import * as Notifications from "expo-notifications";
import { Platform, Alert, Linking } from "react-native";
import { storage } from "@/src/utils/storage";
import { getPrayerTimes, PRAYER_LABELS_AR, PrayerName } from "./prayerTimes";
import { FLOATING_DUAS } from "@/src/data/floatingDuas";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * IMPORTANT: All scheduled notifications below are registered with Android's
 * native AlarmManager/NotificationManager via expo-notifications. They fire
 * even when the app is killed or the phone is restarted (Expo registers a
 * BootReceiver internally). This only works fully in a production APK
 * (published via Emergent's publish button) — Expo Go has restrictions.
 */

export async function ensureNotificationPermissions(showRationale = true): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") {
    await setupChannelsAndCategories();
    return true;
  }
  if (showRationale && current.status === "undetermined") {
    await new Promise<void>((resolve) => {
      Alert.alert(
        "تفعيل الإشعارات 🔔",
        "نحتاج إذن الإشعارات لتذكيرك بمواقيت الصلاة وأذكار الصباح/المساء/النوم — تعمل حتى عند إغلاق التطبيق.",
        [{ text: "موافق", onPress: () => resolve() }]
      );
    });
  }
  const req = await Notifications.requestPermissionsAsync({
    android: {},
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowCriticalAlerts: true,
      provideAppNotificationSettings: true,
    },
  });
  await setupChannelsAndCategories();
  if (req.status !== "granted" && !req.canAskAgain) {
    Alert.alert(
      "الإشعارات معطلة",
      "لتلقي تنبيهات الأذكار والصلاة، يرجى تفعيل الإشعارات من إعدادات الهاتف.",
      [
        { text: "ليس الآن", style: "cancel" },
        { text: "فتح الإعدادات", onPress: () => Linking.openSettings().catch(() => {}) },
      ]
    );
    return false;
  }
  return req.status === "granted";
}

async function setupChannelsAndCategories() {
  if (Platform.OS === "web") return;
  // Action categories: "Stop" button on prayer/adhkar notifications
  await Notifications.setNotificationCategoryAsync("PRAYER_CATEGORY", [
    { identifier: "STOP_ACTION", buttonTitle: "إيقاف", options: { isDestructive: true, opensAppToForeground: false } },
    { identifier: "OPEN_ACTION", buttonTitle: "فتح الدعاء", options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync("ADHKAR_CATEGORY", [
    { identifier: "STOP_ACTION", buttonTitle: "إيقاف", options: { isDestructive: true, opensAppToForeground: false } },
    { identifier: "OPEN_ACTION", buttonTitle: "ابدأ القراءة", options: { opensAppToForeground: true } },
  ]);

  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("prayer-channel", {
    name: "مواقيت الصلاة",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableLights: true,
    lightColor: "#D4AF37",
  });
  await Notifications.setNotificationChannelAsync("adhkar-channel", {
    name: "الأذكار",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableLights: true,
    lightColor: "#D4AF37",
  });
  await Notifications.setNotificationChannelAsync("dua-channel", {
    name: "أدعية متناوبة",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 200, 100, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function cancelAll() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

interface ScheduleSettings {
  morningEnabled: boolean;
  eveningEnabled: boolean;
  sleepEnabled: boolean;
  wakeupEnabled: boolean;
  duhaEnabled: boolean;
  mondayThursdayFastingEnabled: boolean;
  quranReminderEnabled: boolean;
  prayerEnabled: boolean;
  prayerOffsetMin: number;
  inactiveReminderEnabled: boolean;
  duaReminderEnabled: boolean;
  cityLat: number;
  cityLng: number;
}

export const DEFAULT_SETTINGS: ScheduleSettings = {
  morningEnabled: true,
  eveningEnabled: true,
  sleepEnabled: true,
  wakeupEnabled: true,
  duhaEnabled: true,
  mondayThursdayFastingEnabled: true,
  quranReminderEnabled: true,
  prayerEnabled: true,
  prayerOffsetMin: 10,
  inactiveReminderEnabled: true,
  duaReminderEnabled: true,
  cityLat: 12.7855,
  cityLng: 45.0187,
};

async function scheduleDaily(
  hour: number,
  minute: number,
  title: string,
  body: string,
  id: string,
  data: Record<string, any> = {},
  categoryIdentifier?: string,
  channelId = "adhkar-channel"
) {
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title,
      body,
      sound: "default",
      data,
      categoryIdentifier,
      ...(Platform.OS === "android" ? { channelId } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
    },
  });
}

async function scheduleWeekday(weekday: number, hour: number, minute: number, title: string, body: string, id: string) {
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title,
      body,
      sound: "default",
      ...(Platform.OS === "android" ? { channelId: "adhkar-channel" } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      weekday,
      hour,
      minute,
      repeats: true,
    },
  });
}

async function scheduleDate(
  date: Date,
  title: string,
  body: string,
  id: string,
  data: Record<string, any> = {},
  categoryIdentifier?: string,
  channelId = "prayer-channel"
) {
  if (date.getTime() <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title,
      body,
      sound: "default",
      data,
      categoryIdentifier,
      ...(Platform.OS === "android" ? { channelId } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });
}

export async function rescheduleAll(settings: ScheduleSettings) {
  await cancelAll();

  if (settings.morningEnabled) {
    await scheduleDaily(
      5, 0,
      "أذكار الصباح 🌅",
      "حان وقت أذكار الصباح — اضغط لتشغيل الصوت تلقائياً",
      "morning-adhkar",
      { section: "morning", autoplay: true },
      "ADHKAR_CATEGORY",
      "adhkar-channel"
    );
  }
  if (settings.eveningEnabled) {
    await scheduleDaily(
      17, 0,
      "أذكار المساء 🌇",
      "حان وقت أذكار المساء — اضغط لتشغيل الصوت تلقائياً",
      "evening-adhkar",
      { section: "evening", autoplay: true },
      "ADHKAR_CATEGORY",
      "adhkar-channel"
    );
  }
  if (settings.sleepEnabled) {
    await scheduleDaily(
      21, 0,
      "أذكار النوم 🌙",
      "اقرأ أذكار النوم قبل أن تنام — الصوت يبدأ تلقائياً",
      "sleep-adhkar",
      { section: "sleep", autoplay: true },
      "ADHKAR_CATEGORY",
      "adhkar-channel"
    );
  }
  if (settings.wakeupEnabled) {
    await scheduleDaily(
      5, 30,
      "أذكار الاستيقاظ ☀️",
      "الحمد لله الذي أحيانا — اضغط لبدء الأذكار",
      "wakeup-adhkar",
      { section: "wakeup", autoplay: true },
      "ADHKAR_CATEGORY",
      "adhkar-channel"
    );
  }
  if (settings.quranReminderEnabled) {
    await scheduleDaily(
      20, 0,
      "تذكير قراءة القرآن 📖",
      "خذ ورداً من القرآن اليوم",
      "quran-reminder",
      {},
      undefined,
      "adhkar-channel"
    );
  }
  if (settings.mondayThursdayFastingEnabled) {
    await scheduleWeekday(2, 4, 0, "صيام الإثنين 🌙", "اليوم الإثنين، تذكر صيام التطوع", "fasting-mon");
    await scheduleWeekday(5, 4, 0, "صيام الخميس 🌙", "اليوم الخميس، تذكر صيام التطوع", "fasting-thu");
  }

  // Prayer-based scheduling (next 7 days). Each prayer schedules a full-screen
  // azan notification + optional pre-notification reminder.
  const now = new Date();
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const t = getPrayerTimes(settings.cityLat, settings.cityLng, date);
    const prayers: { p: PrayerName; t: Date }[] = [
      { p: "fajr", t: t.fajr },
      { p: "dhuhr", t: t.dhuhr },
      { p: "asr", t: t.asr },
      { p: "maghrib", t: t.maghrib },
      { p: "isha", t: t.isha },
    ];
    for (const { p, t: time } of prayers) {
      if (settings.prayerEnabled) {
        await scheduleDate(
          time,
          `حان وقت صلاة ${PRAYER_LABELS_AR[p]} 🕌`,
          "حي على الصلاة، حي على الفلاح — اضغط لفتح الأذان",
          `prayer-${p}-${dayOffset}`,
          { prayer: p, openAdhan: true, fullScreen: true },
          "PRAYER_CATEGORY",
          "prayer-channel"
        );
        if (settings.prayerOffsetMin > 0) {
          const preTime = new Date(time.getTime() - settings.prayerOffsetMin * 60 * 1000);
          await scheduleDate(
            preTime,
            `تذكير: صلاة ${PRAYER_LABELS_AR[p]} بعد ${settings.prayerOffsetMin} دقيقة`,
            "استعد للصلاة",
            `prayer-pre-${p}-${dayOffset}`,
            { prayer: p },
            undefined,
            "prayer-channel"
          );
        }
      }
    }
    if (settings.duhaEnabled) {
      await scheduleDate(
        t.duha,
        "صلاة الضحى ☀️",
        "وقت صلاة الضحى، صلِّ ركعتين",
        `duha-${dayOffset}`,
        {},
        undefined,
        "adhkar-channel"
      );
    }
  }

  // Inactive user reminder
  if (settings.inactiveReminderEnabled) {
    const inactiveDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await scheduleDate(
      inactiveDate,
      "نفتقدك في أذكاري 💚",
      "لا تنسَ ذكر الله، فبذكر الله تطمئن القلوب",
      "inactive-reminder",
      {},
      undefined,
      "adhkar-channel"
    );
  }

  // Dua reminders every 2 hours from 8:00 AM to 10:00 PM (8 slots per day),
  // rotating through 20 duas using day-of-year offset for variety.
  if (settings.duaReminderEnabled) {
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
    );
    const slots = [8, 10, 12, 14, 16, 18, 20, 22]; // 8 reminders/day
    let duaIdx = (dayOfYear * slots.length) % FLOATING_DUAS.length;
    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
      for (const hour of slots) {
        const d = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        d.setHours(hour, 0, 0, 0);
        if (d.getTime() <= Date.now()) {
          duaIdx = (duaIdx + 1) % FLOATING_DUAS.length;
          continue;
        }
        const dua = FLOATING_DUAS[duaIdx];
        await scheduleDate(
          d,
          "🤲 دعوة من القلب",
          dua,
          `dua-${dayOffset}-${hour}`,
          { dua, type: "floating-dua" },
          undefined,
          "dua-channel"
        );
        duaIdx = (duaIdx + 1) % FLOATING_DUAS.length;
      }
    }
  }
}

export async function refreshInactiveReminder(enabled: boolean) {
  await Notifications.cancelScheduledNotificationAsync("inactive-reminder").catch(() => {});
  if (!enabled) return;
  const inactiveDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await Notifications.scheduleNotificationAsync({
    identifier: "inactive-reminder",
    content: {
      title: "نفتقدك في أذكاري 💚",
      body: "لا تنسَ ذكر الله، فبذكر الله تطمئن القلوب",
      sound: "default",
      ...(Platform.OS === "android" ? { channelId: "adhkar-channel" } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: inactiveDate,
    },
  });
}

export async function loadSettings(): Promise<ScheduleSettings> {
  const data: ScheduleSettings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof ScheduleSettings)[]) {
    const v = await storage.getItem(`settings_${key}`, null as any);
    if (v !== null) (data as any)[key] = v;
  }
  return data;
}

export async function saveSettings(settings: ScheduleSettings) {
  for (const key of Object.keys(settings) as (keyof ScheduleSettings)[]) {
    await storage.setItem(`settings_${key}`, settings[key] as any);
  }
}

export type { ScheduleSettings };
