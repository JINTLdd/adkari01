// Audio playback wrapper built on expo-audio (Expo SDK 54+)
//
// Public API kept intentionally compatible with the previous expo-av based
// implementation so that callers do not need to change:
//   - configureAudioMode()
//   - playAudio(url, { onStatus, onFinish })
//   - pauseCurrent()
//   - resumeCurrent()
//   - stopCurrent()
//   - getCurrentSound() -> the underlying AudioPlayer (or null)
//
// Internally we use `createAudioPlayer` (imperative API) because audio is
// triggered from non-component code paths (e.g. scheduled auto-play).

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import type { EventSubscription } from "expo-modules-core";
import { getLocalAudioPath } from "./audioDownload";

let currentPlayer: AudioPlayer | null = null;
let currentStatusSub: EventSubscription | null = null;
let lastFinishHandled = false;

export async function configureAudioMode() {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
      shouldRouteThroughEarpiece: false,
    });
  } catch (e) {
    console.warn("configureAudioMode error", e);
  }
}

export async function stopCurrent() {
  if (currentStatusSub) {
    try {
      currentStatusSub.remove();
    } catch {
      // ignore
    }
    currentStatusSub = null;
  }
  if (currentPlayer) {
    try {
      currentPlayer.pause();
    } catch {
      // ignore
    }
    try {
      currentPlayer.remove();
    } catch {
      // ignore
    }
    currentPlayer = null;
  }
  lastFinishHandled = false;
}

export interface PlayCallbacks {
  onStatus?: (s: { positionMs: number; durationMs: number; isPlaying: boolean }) => void;
  onFinish?: () => void;
}

export async function playAudio(
  url: string,
  callbacks?: PlayCallbacks
): Promise<AudioPlayer | null> {
  if (!url) return null;
  await stopCurrent();

  // Prefer the offline-downloaded local copy when available.
  const local = await getLocalAudioPath(url);
  const source = local ? { uri: local } : { uri: url };

  try {
    const player = createAudioPlayer(source, { updateInterval: 300 });
    currentPlayer = player;
    lastFinishHandled = false;

    // Subscribe to playback status updates.
    currentStatusSub = player.addListener("playbackStatusUpdate", (status) => {
      if (!status || !status.isLoaded) return;
      const positionMs = Math.round((status.currentTime || 0) * 1000);
      const durationMs = Math.round((status.duration || 0) * 1000);
      callbacks?.onStatus?.({
        positionMs,
        durationMs,
        isPlaying: !!status.playing,
      });
      if (status.didJustFinish && !lastFinishHandled) {
        lastFinishHandled = true;
        try {
          callbacks?.onFinish?.();
        } catch (e) {
          console.warn("onFinish callback error", e);
        }
      }
    });

    // Start playback immediately.
    player.play();
    return player;
  } catch (e) {
    console.warn("playAudio error", e);
    return null;
  }
}

export async function pauseCurrent() {
  if (currentPlayer) {
    try {
      currentPlayer.pause();
    } catch {
      // ignore
    }
  }
}

export async function resumeCurrent() {
  if (currentPlayer) {
    try {
      currentPlayer.play();
    } catch {
      // ignore
    }
  }
}

export function getCurrentSound(): AudioPlayer | null {
  return currentPlayer;
}
