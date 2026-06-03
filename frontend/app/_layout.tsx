import { Stack, router } from "expo-router";
import { I18nManager, StatusBar, AppState } from "react-native";
import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { ThemeProvider } from "@/src/context/ThemeContext";
import { configureAudioMode, stopCurrent } from "@/src/utils/audioPlayer";
import { ensureNotificationPermissions } from "@/src/utils/notifications";
import { checkAndAutoPlay } from "@/src/utils/autoPlay";
import { checkForUpdates, promptUpdate } from "@/src/utils/updateCheck";

// Force RTL
if (!I18nManager.isRTL) {
  try {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  } catch {
    // ignore
  }
}

export default function RootLayout() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    configureAudioMode().catch(() => {});
    ensureNotificationPermissions().catch(() => {});
    // Initial autoplay + update check
    checkAndAutoPlay().catch(() => {});
    checkForUpdates()
      .then((r) => {
        if (r?.shouldUpdate) promptUpdate(r.message, r.url, r.force);
      })
      .catch(() => {});

    // Re-check when app comes back to foreground
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        checkAndAutoPlay().catch(() => {});
      }
      appState.current = next;
    });

    // Handle notification taps and action buttons (Stop / Open / etc.)
    const respSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data: any = response.notification.request.content.data || {};
      const actionId = response.actionIdentifier;

      // Stop button on any notification → stop currently playing audio
      if (actionId === "STOP_ACTION") {
        stopCurrent().catch(() => {});
        return;
      }

      // Prayer notification → open adhan tab with full-screen popup
      if (data.prayer && (actionId === "OPEN_ACTION" || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER)) {
        router.push({ pathname: "/(tabs)/adhan", params: { autoplay: "1", prayer: String(data.prayer) } } as any);
        return;
      }

      // Adhkar notification → open the session with autoplay
      if (data.section) {
        router.push({ pathname: `/session/${data.section}` as any, params: { autoplay: "1" } });
        return;
      }
    });

    return () => {
      sub.remove();
      respSub.remove();
    };
  }, []);

  return (
    <ThemeProvider>
      <StatusBar barStyle="light-content" />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session/[category]" options={{ presentation: "card" }} />
        <Stack.Screen name="qibla" options={{ presentation: "card" }} />
      </Stack>
    </ThemeProvider>
  );
}
