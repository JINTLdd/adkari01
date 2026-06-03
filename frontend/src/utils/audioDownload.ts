import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";
import { morningEveningAdhkar } from "@/src/data/morningAdhkar";
import {
  miscAdhkar,
  istiftahAdhkar,
  afterPrayerAdhkar,
  sleepAdhkar,
  wakeupAdhkar,
  postAdhanDua,
  adhanOptions,
} from "@/src/data/otherAdhkar";

const AUDIO_DIR = (FileSystem.documentDirectory || "") + "adhkari_audio/";

function sanitizeFileName(url: string): string {
  return url.replace(/[^a-zA-Z0-9.]/g, "_");
}

export async function getLocalAudioPath(url: string): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const map = await storage.getItem<string>("audio_map", "{}");
    const parsed = JSON.parse(map || "{}");
    return parsed[url] || null;
  } catch {
    return null;
  }
}

export function getAllAudioUrls(): string[] {
  const urls: string[] = [];
  morningEveningAdhkar.forEach((d) => d.audioUrl && urls.push(d.audioUrl));
  miscAdhkar.forEach((d) => d.audioUrl && urls.push(d.audioUrl));
  istiftahAdhkar.forEach((d) => d.audioUrl && urls.push(d.audioUrl));
  afterPrayerAdhkar.forEach((d) => d.audioUrl && urls.push(d.audioUrl));
  sleepAdhkar.forEach((d) => d.audioUrl && urls.push(d.audioUrl));
  wakeupAdhkar.forEach((d) => d.audioUrl && urls.push(d.audioUrl));
  if (postAdhanDua.audioUrl) urls.push(postAdhanDua.audioUrl);
  adhanOptions.forEach((a) => urls.push(a.url));
  return Array.from(new Set(urls));
}

export async function downloadAllAudio(
  onProgress: (percent: number, currentIndex: number, total: number) => void
): Promise<boolean> {
  if (Platform.OS === "web") {
    // Skip filesystem on web
    onProgress(100, 0, 0);
    await storage.setItem("audio_downloaded", true);
    return true;
  }

  try {
    const dirInfo = await FileSystem.getInfoAsync(AUDIO_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
    }

    const urls = getAllAudioUrls();
    const total = urls.length;
    const map: Record<string, string> = {};

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const fileName = sanitizeFileName(url);
      const localUri = AUDIO_DIR + fileName;
      try {
        const info = await FileSystem.getInfoAsync(localUri);
        if (!info.exists) {
          await FileSystem.downloadAsync(url, localUri);
        }
        map[url] = localUri;
      } catch (e) {
        console.warn("Failed to download", url, e);
      }
      onProgress(Math.round(((i + 1) / total) * 100), i + 1, total);
    }

    await storage.setItem("audio_map", JSON.stringify(map));
    await storage.setItem("audio_downloaded", true);
    return true;
  } catch (e) {
    console.error("Download error", e);
    return false;
  }
}

export async function clearDownloadedAudio() {
  if (Platform.OS === "web") return;
  try {
    const dirInfo = await FileSystem.getInfoAsync(AUDIO_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(AUDIO_DIR, { idempotent: true });
    }
    await storage.removeItem("audio_map");
    await storage.removeItem("audio_downloaded");
  } catch (e) {
    console.warn("Clear audio error", e);
  }
}

export async function isAudioDownloaded(): Promise<boolean> {
  const v = await storage.getItem<boolean>("audio_downloaded", false);
  return v === true;
}
