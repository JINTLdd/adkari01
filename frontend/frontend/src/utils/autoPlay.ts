// Auto-play scheduled audio when app opens within the time window
// (5:00-5:15 AM = morning, 5:00-5:15 PM = evening, 9:00-9:15 PM = sleep,
//  5:30-5:45 AM = wakeup)
import { playAudio, configureAudioMode } from "./audioPlayer";
import { storage } from "@/src/utils/storage";
import { morningEveningAdhkar } from "@/src/data/morningAdhkar";
import { sleepAdhkarExpanded } from "@/src/data/extraAdhkar";
import { wakeupAdhkar } from "@/src/data/otherAdhkar";

interface ScheduleSlot {
  id: string;
  hour: number;
  minute: number;
  windowMin: number;
  audioUrl: string;
  settingKey: string;
}

function getFirstAudio(items: { audioUrl: string }[]): string {
  return items.find((i) => i.audioUrl)?.audioUrl || "";
}

function getSlots(): ScheduleSlot[] {
  return [
    {
      id: "morning",
      hour: 5,
      minute: 0,
      windowMin: 30,
      audioUrl: getFirstAudio(morningEveningAdhkar),
      settingKey: "settings_morningEnabled",
    },
    {
      id: "evening",
      hour: 17,
      minute: 0,
      windowMin: 30,
      audioUrl: getFirstAudio(morningEveningAdhkar),
      settingKey: "settings_eveningEnabled",
    },
    {
      id: "sleep",
      hour: 21,
      minute: 0,
      windowMin: 30,
      audioUrl: getFirstAudio(sleepAdhkarExpanded),
      settingKey: "settings_sleepEnabled",
    },
    {
      id: "wakeup",
      hour: 5,
      minute: 30,
      windowMin: 30,
      audioUrl: getFirstAudio(wakeupAdhkar),
      settingKey: "settings_wakeupEnabled",
    },
  ];
}

function todayKey(slotId: string): string {
  const d = new Date();
  return `autoplay_${slotId}_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Check if current time is within any auto-play window and play it.
 * Returns the slot id if played, or null.
 */
export async function checkAndAutoPlay(): Promise<string | null> {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const slots = getSlots();

  for (const slot of slots) {
    const slotMins = slot.hour * 60 + slot.minute;
    if (nowMins >= slotMins && nowMins < slotMins + slot.windowMin) {
      // Within window — check setting + not already played today
      const enabled = await storage.getItem<boolean>(slot.settingKey, true);
      if (enabled === false) continue;
      const playedToday = await storage.getItem<boolean>(todayKey(slot.id), false);
      if (playedToday) continue;
      if (!slot.audioUrl) continue;

      try {
        await configureAudioMode();
        await playAudio(slot.audioUrl);
        await storage.setItem(todayKey(slot.id), true);
        return slot.id;
      } catch (e) {
        console.warn("Auto-play failed", slot.id, e);
      }
    }
  }
  return null;
}
