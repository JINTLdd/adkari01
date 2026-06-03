# Adhkari — Native Android Implementation Brief

## Project Context

**App name:** أذكاري (Adhkari) — Arabic Islamic reminder app  
**Current stack:** React Native + Expo SDK 54 (Managed Workflow), TypeScript, expo-router  
**Source:** [GitHub repo URL — paste after Save-to-GitHub]  
**Target:** Production-ready Android APK / AAB for Google Play

## What's Already Done (JavaScript / Expo Layer)

The complete UI, audio playback, prayer-time calculation (Adhan lib), digital tasbih, theme system, Arabic typography (Amiri font), Qibla compass (expo-location heading), and 5-tab navigation are **fully implemented in JavaScript** and work perfectly when the app is open.

**Important:** Do NOT change any UI, screens, navigation, fonts, colors, or Arabic content. The app is already polished. Your job is **only** to add the native Android pieces that JavaScript / `expo-notifications` cannot reliably do.

## What You Need to Implement Natively

The user requires these features to work **even when the app is completely killed** (swiped from recents) on Android — including aggressive OEMs like Xiaomi MIUI, Huawei EMUI, Vivo FuntouchOS, Oppo ColorOS, OnePlus OxygenOS, Samsung One UI. `expo-notifications` JavaScript-scheduled notifications are unreliable on these OEMs when the app is killed. The solution is **pure native Android code**.

### Step 1: Convert to Expo Bare Workflow

```bash
cd /path/to/project/frontend
npx expo prebuild --platform android --clean
```

This generates an `android/` folder. From here you have full native access. **Do not** continue using `expo start` — switch to native development via `npx expo run:android` for testing.

### Step 2: AndroidManifest.xml Permissions

Add to `<manifest>` block:

```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>
<uses-permission android:name="android.permission.USE_EXACT_ALARM"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.WAKE_LOCK"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"/>
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
<uses-permission android:name="android.permission.VIBRATE"/>
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO"/>
```

Register inside `<application>`:

```xml
<receiver
    android:name=".PrayerAlarmReceiver"
    android:exported="true"
    android:enabled="true">
    <intent-filter>
        <action android:name="com.adhkari.app.PRAYER_ALARM"/>
        <action android:name="com.adhkari.app.ADHKAR_ALARM"/>
        <action android:name="com.adhkari.app.DUA_ALARM"/>
    </intent-filter>
</receiver>

<receiver
    android:name=".BootReceiver"
    android:exported="true"
    android:enabled="true">
    <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED"/>
        <action android:name="android.intent.action.QUICKBOOT_POWERON"/>
        <action android:name="android.intent.action.LOCKED_BOOT_COMPLETED"/>
    </intent-filter>
</receiver>

<service
    android:name=".AdhanPlaybackService"
    android:foregroundServiceType="mediaPlayback"
    android:exported="false"/>

<service
    android:name=".DuaOverlayService"
    android:exported="false"/>

<activity
    android:name=".FullScreenAdhanActivity"
    android:exported="false"
    android:showOnLockScreen="true"
    android:showWhenLocked="true"
    android:turnScreenOn="true"
    android:launchMode="singleInstance"
    android:theme="@style/Theme.AppCompat.DayNight.NoActionBar"/>
```

### Step 3: PrayerAlarmReceiver.java

`android/app/src/main/java/com/adhkari/app/PrayerAlarmReceiver.java`

```java
package com.adhkari.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;

public class PrayerAlarmReceiver extends BroadcastReceiver {
    public static final String CHANNEL_ID = "adhkari_prayer_channel";

    @Override
    public void onReceive(Context context, Intent intent) {
        String type = intent.getStringExtra("type"); // "prayer" | "adhkar" | "dua"
        String prayerName = intent.getStringExtra("prayer"); // "fajr" | "dhuhr" | etc.
        String section = intent.getStringExtra("section"); // "morning" | "evening" | etc.
        String body = intent.getStringExtra("body");
        String title = intent.getStringExtra("title");
        int imageRes = intent.getIntExtra("imageRes", 0); // mosque image drawable id

        createChannel(context);

        // Start foreground media service to play adhan / adhkar audio
        if ("prayer".equals(type) || "adhkar".equals(type)) {
            Intent serviceIntent = new Intent(context, AdhanPlaybackService.class);
            serviceIntent.putExtra("type", type);
            serviceIntent.putExtra("prayer", prayerName);
            serviceIntent.putExtra("section", section);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        }

        // Launch full-screen activity for prayer
        if ("prayer".equals(type)) {
            Intent fullIntent = new Intent(context, FullScreenAdhanActivity.class);
            fullIntent.putExtra("prayer", prayerName);
            fullIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            context.startActivity(fullIntent);
        }

        // Stop action (PendingIntent that broadcasts "STOP_ADHAN")
        Intent stopIntent = new Intent(context, StopAdhanReceiver.class);
        PendingIntent stopPI = PendingIntent.getBroadcast(
            context, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigPictureStyle()
                .bigPicture(android.graphics.BitmapFactory.decodeResource(context.getResources(), imageRes)))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(buildFullScreenPI(context, prayerName), true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(R.drawable.ic_stop, "إيقاف", stopPI)
            .setAutoCancel(true);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(prayerName != null ? prayerName.hashCode() : 0, builder.build());
    }

    private PendingIntent buildFullScreenPI(Context context, String prayer) {
        Intent i = new Intent(context, FullScreenAdhanActivity.class);
        i.putExtra("prayer", prayer);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            context, 1, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        Uri sound = Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.adhan_madinah);
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "مواقيت الصلاة", NotificationManager.IMPORTANCE_HIGH);
        ch.setSound(sound, attrs);
        ch.enableLights(true);
        ch.enableVibration(true);
        ch.setBypassDnd(true);
        ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }
}
```

### Step 4: AdhanPlaybackService.java (Foreground Service)

`android/app/src/main/java/com/adhkari/app/AdhanPlaybackService.java`

```java
package com.adhkari.app;

import android.app.Service;
import android.content.Intent;
import android.media.MediaPlayer;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import androidx.annotation.Nullable;

public class AdhanPlaybackService extends Service {
    private MediaPlayer player;
    public static final String STOP_ACTION = "com.adhkari.app.STOP_ADHAN";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP_ACTION.equals(intent.getAction())) {
            stopPlayback();
            stopSelf();
            return START_NOT_STICKY;
        }

        startForeground(101, buildForegroundNotification());

        String type = intent.getStringExtra("type");
        int audioRes = "prayer".equals(type)
            ? R.raw.adhan_madinah         // bundled MP3 in res/raw
            : R.raw.adhkari_morning;      // bundled MP3 in res/raw

        try {
            player = MediaPlayer.create(this, audioRes);
            player.setOnCompletionListener(mp -> {
                stopForeground(true);
                stopSelf();
            });
            player.start();
        } catch (Exception e) {
            stopForeground(true);
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private void stopPlayback() {
        if (player != null) {
            try { player.stop(); player.release(); } catch (Exception ignored) {}
            player = null;
        }
        stopForeground(true);
    }

    @Override
    public void onDestroy() {
        stopPlayback();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    private android.app.Notification buildForegroundNotification() {
        return new NotificationCompat.Builder(this, PrayerAlarmReceiver.CHANNEL_ID)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle("جاري تشغيل الأذان")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build();
    }
}
```

### Step 5: FullScreenAdhanActivity (Java)

`android/app/src/main/java/com/adhkari/app/FullScreenAdhanActivity.java`

A full-screen activity launched even over the lock screen showing:
- Mosque image for the specific prayer (5 images: bundle in `res/drawable/mosque_fajr.jpg`, `mosque_dhuhr.jpg`, etc.)
- "حان وقت صلاة [الفجر/الظهر/العصر/المغرب/العشاء]"
- Animated azan text scrolling line by line
- Stop button → sends `STOP_ADHAN` intent to `AdhanPlaybackService`

```java
@Override
protected void onCreate(@Nullable Bundle s) {
    super.onCreate(s);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        setShowWhenLocked(true);
        setTurnScreenOn(true);
    } else {
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );
    }
    setContentView(R.layout.activity_full_screen_adhan);

    String prayer = getIntent().getStringExtra("prayer");
    int imgRes = getMosqueImage(prayer); // map fajr → R.drawable.mosque_fajr, etc.
    ((ImageView) findViewById(R.id.mosque_image)).setImageResource(imgRes);
    ((TextView) findViewById(R.id.prayer_name)).setText(getPrayerArName(prayer));

    findViewById(R.id.stop_btn).setOnClickListener(v -> {
        Intent stop = new Intent(this, AdhanPlaybackService.class);
        stop.setAction(AdhanPlaybackService.STOP_ACTION);
        startService(stop);
        finish();
    });
}
```

XML layout `res/layout/activity_full_screen_adhan.xml`: ImageView (full-screen mosque background) + dark overlay + Arabic title + animated Azan text + STOP button.

### Step 6: AlarmManager Scheduling Bridge (React Native Module)

Create a TurboModule or simple `ReactContextBaseJavaModule` named `AdhkariAlarms`:

```java
@ReactMethod
public void schedulePrayerAlarm(String prayer, double triggerEpochMs, String title, String body, int imageDrawableId) {
    AlarmManager am = (AlarmManager) getReactApplicationContext().getSystemService(Context.ALARM_SERVICE);
    Intent i = new Intent(getReactApplicationContext(), PrayerAlarmReceiver.class);
    i.setAction("com.adhkari.app.PRAYER_ALARM");
    i.putExtra("type", "prayer");
    i.putExtra("prayer", prayer);
    i.putExtra("title", title);
    i.putExtra("body", body);
    i.putExtra("imageRes", imageDrawableId);
    PendingIntent pi = PendingIntent.getBroadcast(
        getReactApplicationContext(),
        prayer.hashCode(),
        i,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, (long) triggerEpochMs, pi);
    } else {
        am.setExact(AlarmManager.RTC_WAKEUP, (long) triggerEpochMs, pi);
    }
}

@ReactMethod
public void cancelAllAlarms() { /* keep IDs and cancel each PendingIntent */ }
```

Expose to JS so `src/utils/notifications.ts` can call `AdhkariAlarms.schedulePrayerAlarm(...)` **instead of** `expo-notifications` for prayer/adhkar/dua alarms. Keep expo-notifications for fasting / Quran reminders (non-critical).

### Step 7: BootReceiver.java

```java
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
            || "android.intent.action.QUICKBOOT_POWERON".equals(action)
            || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)) {
            // Read stored schedule from SharedPreferences and re-register all alarms
            ScheduleStore.reRegisterAll(context);
        }
    }
}
```

`ScheduleStore` persists last-known prayer times + adhkar/dua slots in SharedPreferences after each successful schedule, and re-creates the PendingIntents after reboot.

### Step 8: DuaOverlayService.java (SYSTEM_ALERT_WINDOW)

`android/app/src/main/java/com/adhkari/app/DuaOverlayService.java`

Inflates a small floating window using `WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY` (or `TYPE_PHONE` on older devices). Shows a dark-background card with Arabic gold text of the dua. Auto-dismiss after 10s or tap to dismiss.

```java
WindowManager.LayoutParams params = new WindowManager.LayoutParams(
    WindowManager.LayoutParams.MATCH_PARENT,
    WindowManager.LayoutParams.WRAP_CONTENT,
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        : WindowManager.LayoutParams.TYPE_PHONE,
    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
    PixelFormat.TRANSLUCENT
);
params.gravity = Gravity.BOTTOM;
windowManager.addView(overlayView, params);
new Handler(Looper.getMainLooper()).postDelayed(this::removeOverlay, 10_000);
```

JS must call `Settings.canDrawOverlays(context)` first and request via `Settings.ACTION_MANAGE_OVERLAY_PERMISSION`.

### Step 9: Bundle Audio Files

Place these MP3s into `android/app/src/main/res/raw/` (lowercase, no special chars):

- `adhan_madinah.mp3` — default adhan
- `adhan_kuwait.mp3`, `adhan_makkah_haram.mp3`, etc. (8 muezzins)
- `adhkari_morning.mp3` — first morning dhikr audio
- `adhkari_evening.mp3`, `adhkari_sleep.mp3`, `adhkari_wakeup.mp3`

Reference as `R.raw.adhan_madinah`. These become the notification sound + service playback source.

### Step 10: Bundle Mosque Images

Place into `android/app/src/main/res/drawable-xxhdpi/`:

- `mosque_fajr.jpg`
- `mosque_dhuhr.jpg`
- `mosque_asr.jpg`
- `mosque_maghrib.jpg`
- `mosque_isha.jpg`

Source URLs (user-provided):
1. https://customer-assets.emergentagent.com/job_adhkary-app/artifacts/vgg574fa_IMG_20260520_222015_505.jpg
2. https://customer-assets.emergentagent.com/job_adhkary-app/artifacts/f1dtrf2g_IMG_20260520_222015_583.jpg
3. https://customer-assets.emergentagent.com/job_adhkary-app/artifacts/4fg3tybm_IMG_20260520_222015_953.jpg
4. https://customer-assets.emergentagent.com/job_adhkary-app/artifacts/0jgkx3xh_IMG_20260520_222015_725.jpg
5. https://customer-assets.emergentagent.com/job_adhkary-app/artifacts/gk5zsctn_IMG_20260520_222016_170.jpg

### Step 11: Battery / Auto-start Whitelist Helper

Many OEMs kill background apps aggressively. On first launch (or in Settings), show a guided dialog directing the user to:

- **Xiaomi MIUI:** Settings → Apps → Adhkari → Autostart ON + Battery Saver → No restrictions
- **Huawei EMUI:** Settings → Apps → Adhkari → Battery → App launch → Manage manually (all ON)
- **Samsung One UI:** Settings → Battery → Background usage limits → Sleeping apps → ensure Adhkari is NOT there
- **Vivo / Oppo:** Settings → Battery → High Background Power Consumption → Allow

Use intents like:
```java
Intent intent = new Intent();
intent.setComponent(new ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
startActivity(intent);
```

### Step 12: Build & Test Matrix

Test on real devices (emulator won't show OEM issues):
- ✅ Stock Pixel (Android 14)
- ✅ Samsung Galaxy (One UI 6)
- ✅ Xiaomi (MIUI 14)
- ✅ Huawei (EMUI / HarmonyOS)
- ✅ Vivo / Oppo (FuntouchOS / ColorOS)

For each: kill the app from recents → wait for next prayer time → notification + full-screen + audio must fire.

### Step 13: Build the APK / AAB

```bash
cd android
./gradlew bundleRelease       # → app-release.aab for Play Store
./gradlew assembleRelease     # → app-release.apk for direct distribution
```

Sign with the existing keystore (preserve from Emergent publish OR generate new + update Play Console signing).

## What NOT to Change

- ✅ Keep all React Native screens / UI / Arabic content as-is
- ✅ Keep Amiri font integration
- ✅ Keep Qibla compass (expo-location heading)
- ✅ Keep tasbih, theme, settings, audio download flow
- ✅ Keep `src/data/morningAdhkar.ts`, `otherAdhkar.ts`, `extraAdhkar.ts`, `floatingDuas.ts` data files
- ❌ Do NOT migrate prayer scheduling logic out of `src/utils/notifications.ts` — instead, **replace its internal calls to `Notifications.scheduleNotificationAsync()` with calls to the new `AdhkariAlarms.schedulePrayerAlarm()` bridge** for prayer/adhkar/dua notifications.

## Estimated Effort

- Senior Android developer: **8–14 hours** (config + 4 Java classes + bridge module + 1 Activity + testing)
- Including OEM testing matrix: **+4 hours**

## Deliverable

A signed `app-release.aab` ready for Google Play upload, plus updated source pushed to GitHub. All notifications fire reliably with the app killed on all major Android OEMs.

---

**Contact:** أذكاري — قسم تطوير الأندرويد الأصلي  
**Repo:** [pasted after Save-to-GitHub]
