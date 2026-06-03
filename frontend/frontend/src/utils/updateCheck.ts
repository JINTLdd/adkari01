// App update check - compares current version against a remote/local "latest" flag
import { Platform, Linking, Alert } from "react-native";
import { storage } from "@/src/utils/storage";

// Bump this constant whenever you publish a new mandatory version.
// On every app cold start we compare it to the stored "last_seen_version".
// If different, we show a forced-update modal directing the user to the store.
export const CURRENT_VERSION = "1.0.0";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.adhkari.app";

// Optional remote endpoint: a tiny static JSON the user can host (e.g., GitHub raw)
// containing { "latest_version": "1.1.0", "force_update": true, "message": "..." }
const REMOTE_VERSION_URL = "";

interface RemoteVersion {
  latest_version: string;
  force_update: boolean;
  message?: string;
  url?: string;
}

export async function checkForUpdates(): Promise<{ shouldUpdate: boolean; force: boolean; message: string; url: string } | null> {
  // 1) Try remote check (silent fail if no internet)
  if (REMOTE_VERSION_URL) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(REMOTE_VERSION_URL, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        const data: RemoteVersion = await res.json();
        if (data.latest_version && data.latest_version !== CURRENT_VERSION) {
          return {
            shouldUpdate: true,
            force: !!data.force_update,
            message:
              data.message ||
              `يتوفر إصدار جديد (${data.latest_version}). يرجى التحديث للاستمتاع بالمميزات الجديدة.`,
            url: data.url || PLAY_STORE_URL,
          };
        }
      }
    } catch {
      // offline — skip silently
    }
  }
  return null;
}

export function promptUpdate(message: string, url: string, force: boolean) {
  const buttons = [
    {
      text: "تحديث الآن",
      onPress: () => Linking.openURL(url).catch(() => {}),
    },
  ];
  if (!force) {
    buttons.unshift({ text: "لاحقاً", onPress: () => {} } as any);
  }
  Alert.alert("تحديث متوفر", message, buttons as any, { cancelable: !force });
}

export async function markVersionSeen() {
  await storage.setItem("last_seen_version", CURRENT_VERSION);
}
