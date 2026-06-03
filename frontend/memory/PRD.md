# أذكاري (Adhkari) - PRD

## Overview
A comprehensive Arabic Islamic mobile app providing daily adhkar (remembrances), prayer times, adhan player, and digital tasbih. Built with Expo SDK 54, fully RTL Arabic, offline-capable.

## Features Implemented

### 1. Welcome / Onboarding Screen
- Islamic geometric pattern background (day/night variants)
- One-time audio bulk download with progress bar (~60MB)
- "Download Now" or "Skip" options
- Skipped users can download later from Settings
- Stores `welcome_seen` flag in AsyncStorage

### 2. Bottom Tab Navigation (5 tabs)
- الرئيسية (Home) - categories list
- الأذان (Adhan) - prayer times + adhan player
- المسبحة (Tasbih) - digital counter
- المزيد (More) - misc + istiftah adhkar
- الإعدادات (Settings)

### 3. Adhkar Session Screen (with auto-advance)
Categories: Morning, Evening, Sleep, Wakeup, After-prayer
- Shows current dhikr with Arabic text + audio player
- Tap-to-count button with target (e.g., 1/3, 0/100)
- Auto-advances to next dhikr when target reached (with success haptic)
- Final screen shows completion message + reset option
- Audio plays from local cache if downloaded, otherwise streams

### 4. Adhan & Prayer Times
- Adhan library for prayer time calculation (Umm Al-Qura method)
- Pre-loaded cities: Aden, Sanaa, Riyadh + Current Location (GPS)
- 8 muezzin options selectable
- Next prayer card with countdown
- Auto-play adhan when prayer time arrives (within 45s window, app open)
- Post-adhan dua popup with Prophet's Mosque image + audio

### 5. Digital Tasbih
- 5 sequenced dhikrs (Subhan Allah ×33, Alhamdulillah ×33, La Ilaha ×33, Allahu Akbar ×33, Astaghfirullah ×100)
- Large tap button with haptic feedback per tap
- Double haptic on completion + auto-advance
- Daily total counter persisted

### 6. Settings
- Day/Night theme toggle (#355070 / #2D2438)
- Sound & vibration toggles
- 8 scheduled notifications (morning 5AM, evening 5PM, sleep 9PM, wakeup 5:30AM, duha, Mon/Thu fasting, Quran reminder, prayer reminders)
- Prayer offset selector (5/10/15/30 min)
- City selector for prayer times
- Audio re-download
- "We miss you" inactive user notification (24h after last open)

## Technical Stack
- Expo SDK 54 + Expo Router (file-based)
- expo-av for audio (background playback configured)
- expo-notifications for scheduled local notifications
- expo-location for GPS
- expo-file-system for audio download/caching
- adhan library for prayer times
- AsyncStorage for all persistence (no backend required)

## Background Behavior
- Local notifications fire at scheduled times even when app is closed
- Audio configured with `staysActiveInBackground: true`
- Full background services (auto adhan playback when app fully killed) requires native APK build via Emergent publish
