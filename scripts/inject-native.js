#!/usr/bin/env node
const fs   = require("fs");
const path = require("path");

const FRONTEND = path.resolve(__dirname, "../frontend");
const ANDROID  = path.join(FRONTEND, "android");
const APP_SRC  = path.join(ANDROID, "app/src/main");
const JAVA_DIR = path.join(APP_SRC, "java/com/adhkari/app");
const RES_DIR  = path.join(APP_SRC, "res");
const MANIFEST = path.join(APP_SRC, "AndroidManifest.xml");

fs.mkdirSync(JAVA_DIR, { recursive: true });
fs.mkdirSync(path.join(RES_DIR, "layout"), { recursive: true });

console.log("📁 المجلدات جاهزة...");

// ══ 1. AdhkariAlarms.java ══
fs.writeFileSync(path.join(JAVA_DIR, "AdhkariAlarms.java"), `package com.adhkari.app;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import org.json.JSONObject;
public class AdhkariAlarms extends ReactContextBaseJavaModule {
    static final String PREFS = "adhkari_alarms";
    public AdhkariAlarms(ReactApplicationContext ctx) { super(ctx); }
    @Override public String getName() { return "AdhkariAlarms"; }
    @ReactMethod
    public void schedulePrayerAlarm(String prayer, double triggerEpochMs, String title, String body, String audioFileName) {
        Context ctx = getReactApplicationContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        Intent i = new Intent(ctx, PrayerAlarmReceiver.class);
        i.setAction("com.adhkari.app.PRAYER_ALARM");
        i.putExtra("prayer", prayer); i.putExtra("title", title);
        i.putExtra("body", body); i.putExtra("audioFile", audioFileName);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, prayer.hashCode(), i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, (long) triggerEpochMs, pi);
        } else { am.setExact(AlarmManager.RTC_WAKEUP, (long) triggerEpochMs, pi); }
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONObject obj = new JSONObject();
            obj.put("prayer", prayer); obj.put("triggerMs", triggerEpochMs);
            obj.put("title", title); obj.put("body", body); obj.put("audio", audioFileName);
            prefs.edit().putString("alarm_" + prayer, obj.toString()).apply();
        } catch (Exception ignored) {}
    }
    @ReactMethod
    public void cancelAlarm(String prayer) {
        Context ctx = getReactApplicationContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        Intent i = new Intent(ctx, PrayerAlarmReceiver.class);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, prayer.hashCode(), i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("alarm_" + prayer).apply();
    }
    @ReactMethod
    public void cancelAllAlarms() {
        Context ctx = getReactApplicationContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        for (String key : prefs.getAll().keySet()) {
            if (!key.startsWith("alarm_")) continue;
            String prayer = key.substring(6);
            Intent i = new Intent(ctx, PrayerAlarmReceiver.class);
            PendingIntent pi = PendingIntent.getBroadcast(ctx, prayer.hashCode(), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.cancel(pi);
        }
        prefs.edit().clear().apply();
    }
    @ReactMethod
    public void requestExactAlarmPermission(Promise promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getReactApplicationContext().getSystemService(Context.ALARM_SERVICE);
            if (!am.canScheduleExactAlarms()) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:" + getReactApplicationContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getReactApplicationContext().startActivity(intent);
                promise.resolve(false); return;
            }
        }
        promise.resolve(true);
    }
    @ReactMethod
    public void openBatteryOptimizationSettings() {
        Context ctx = getReactApplicationContext();
        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:" + ctx.getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(intent);
    }
}`);
console.log("✅ AdhkariAlarms.java");

// ══ 2. AdhkariAlarmsPackage.java ══
fs.writeFileSync(path.join(JAVA_DIR, "AdhkariAlarmsPackage.java"), `package com.adhkari.app;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.Collections;
import java.util.List;
public class AdhkariAlarmsPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext ctx) {
        return Collections.singletonList(new AdhkariAlarms(ctx));
    }
    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext ctx) {
        return Collections.emptyList();
    }
}`);
console.log("✅ AdhkariAlarmsPackage.java");

// ══ 3. PrayerAlarmReceiver.java ══
fs.writeFileSync(path.join(JAVA_DIR, "PrayerAlarmReceiver.java"), `package com.adhkari.app;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
public class PrayerAlarmReceiver extends BroadcastReceiver {
    public static final String CHANNEL_ID = "adhkari_prayer_channel";
    @Override
    public void onReceive(Context context, Intent intent) {
        createChannel(context);
        String prayer = intent.getStringExtra("prayer");
        String title  = intent.getStringExtra("title");
        String body   = intent.getStringExtra("body");
        String audio  = intent.getStringExtra("audioFile");
        Intent svc = new Intent(context, AdhanPlaybackService.class);
        svc.putExtra("prayer", prayer); svc.putExtra("title", title);
        svc.putExtra("body", body);
        svc.putExtra("audioFile", audio != null ? audio : "adhan_madinah");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(svc);
        } else { context.startService(svc); }
        Intent full = new Intent(context, FullScreenAdhanActivity.class);
        full.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        full.putExtra("prayer", prayer); full.putExtra("title", title);
        PendingIntent fullPI = PendingIntent.getActivity(context, 1, full,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent stop = new Intent(context, StopAdhanReceiver.class);
        PendingIntent stopPI = PendingIntent.getBroadcast(context, 0, stop,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title).setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullPI, true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_media_pause, "إيقاف الأذان", stopPI)
            .setAutoCancel(true);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(prayer != null ? prayer.hashCode() : 9999, builder.build());
    }
    private void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "مواقيت الصلاة", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("أذان وإشعارات الصلاة");
        ch.enableVibration(true); ch.setBypassDnd(true);
        ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }
}`);
console.log("✅ PrayerAlarmReceiver.java");

// ══ 4. AdhanPlaybackService.java ══
fs.writeFileSync(path.join(JAVA_DIR, "AdhanPlaybackService.java"), `package com.adhkari.app;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
public class AdhanPlaybackService extends Service {
    public static final String STOP_ACTION = "com.adhkari.app.STOP_ADHAN";
    private MediaPlayer player;
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP_ACTION.equals(intent.getAction())) {
            stopPlayback(); stopSelf(); return START_NOT_STICKY;
        }
        String title = intent != null ? intent.getStringExtra("title") : "أذان";
        startForeground(101, buildNotification(title));
        String audioFile = intent != null ? intent.getStringExtra("audioFile") : "adhan_madinah";
        if (audioFile == null) audioFile = "adhan_madinah";
        int resId = getResources().getIdentifier(audioFile, "raw", getPackageName());
        if (resId == 0) resId = getResources().getIdentifier("adhan_madinah", "raw", getPackageName());
        if (resId != 0) {
            try {
                player = MediaPlayer.create(this, resId);
                if (player != null) {
                    player.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
                    player.setOnCompletionListener(mp -> { stopForeground(true); stopSelf(); });
                    player.start();
                }
            } catch (Exception e) { stopForeground(true); stopSelf(); }
        } else { stopForeground(true); stopSelf(); }
        return START_NOT_STICKY;
    }
    private void stopPlayback() {
        if (player != null) {
            try { if (player.isPlaying()) player.stop(); } catch (Exception ignored) {}
            player.release(); player = null;
        }
        stopForeground(true);
    }
    private Notification buildNotification(String title) {
        String ch = "adhkari_playback";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm.getNotificationChannel(ch) == null) {
                nm.createNotificationChannel(new NotificationChannel(ch, "تشغيل الأذان", NotificationManager.IMPORTANCE_LOW));
            }
        }
        return new NotificationCompat.Builder(this, ch)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title != null ? title : "أذان")
            .setContentText("جارٍ تشغيل الأذان...")
            .setPriority(NotificationCompat.PRIORITY_LOW).build();
    }
    @Override public void onDestroy() { stopPlayback(); super.onDestroy(); }
    @Nullable @Override public IBinder onBind(Intent i) { return null; }
}`);
console.log("✅ AdhanPlaybackService.java");

// ══ 5. StopAdhanReceiver.java ══
fs.writeFileSync(path.join(JAVA_DIR, "StopAdhanReceiver.java"), `package com.adhkari.app;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
public class StopAdhanReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Intent stop = new Intent(context, AdhanPlaybackService.class);
        stop.setAction(AdhanPlaybackService.STOP_ACTION);
        context.startService(stop);
    }
}`);
console.log("✅ StopAdhanReceiver.java");

// ══ 6. BootReceiver.java ══
fs.writeFileSync(path.join(JAVA_DIR, "BootReceiver.java"), `package com.adhkari.app;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONObject;
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
            && !"android.intent.action.QUICKBOOT_POWERON".equals(action)
            && !Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)) return;
        SharedPreferences prefs = context.getSharedPreferences(AdhkariAlarms.PREFS, Context.MODE_PRIVATE);
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        for (java.util.Map.Entry<String, ?> entry : prefs.getAll().entrySet()) {
            if (!entry.getKey().startsWith("alarm_")) continue;
            try {
                JSONObject obj = new JSONObject((String) entry.getValue());
                long triggerMs = (long) obj.getDouble("triggerMs");
                if (triggerMs <= System.currentTimeMillis()) continue;
                String prayer = obj.getString("prayer");
                Intent i = new Intent(context, PrayerAlarmReceiver.class);
                i.setAction("com.adhkari.app.PRAYER_ALARM");
                i.putExtra("prayer", prayer); i.putExtra("title", obj.getString("title"));
                i.putExtra("body", obj.getString("body")); i.putExtra("audioFile", obj.getString("audio"));
                PendingIntent pi = PendingIntent.getBroadcast(context, prayer.hashCode(), i,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pi);
                } else { am.setExact(AlarmManager.RTC_WAKEUP, triggerMs, pi); }
            } catch (Exception ignored) {}
        }
    }
}`);
console.log("✅ BootReceiver.java");

// ══ 7. FullScreenAdhanActivity.java ══
fs.writeFileSync(path.join(JAVA_DIR, "FullScreenAdhanActivity.java"), `package com.adhkari.app;
import android.app.KeyguardManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
public class FullScreenAdhanActivity extends AppCompatActivity {
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true); setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON   |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON   |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        }
        setContentView(R.layout.activity_full_screen_adhan);
        String title = getIntent().getStringExtra("title");
        TextView tv = findViewById(R.id.tv_prayer_name);
        if (tv != null && title != null) tv.setText(title);
        Button btn = findViewById(R.id.btn_stop);
        if (btn != null) {
            btn.setOnClickListener(v -> {
                Intent stop = new Intent(this, AdhanPlaybackService.class);
                stop.setAction(AdhanPlaybackService.STOP_ACTION);
                startService(stop); finish();
            });
        }
    }
}`);
console.log("✅ FullScreenAdhanActivity.java");

// ══ 8. Layout XML ══
fs.writeFileSync(path.join(RES_DIR, "layout/activity_full_screen_adhan.xml"),
`<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent" android:layout_height="match_parent"
    android:orientation="vertical" android:gravity="center"
    android:background="#1a3a2a" android:padding="32dp">
    <TextView android:id="@+id/tv_adhan_label"
        android:layout_width="wrap_content" android:layout_height="wrap_content"
        android:text="🕌" android:textSize="64sp" android:layout_marginBottom="16dp"/>
    <TextView android:id="@+id/tv_prayer_name"
        android:layout_width="wrap_content" android:layout_height="wrap_content"
        android:text="حان وقت الصلاة" android:textSize="28sp"
        android:textColor="#D4AF37" android:textStyle="bold"
        android:gravity="center" android:layout_marginBottom="32dp"/>
    <Button android:id="@+id/btn_stop"
        android:layout_width="200dp" android:layout_height="56dp"
        android:text="إيقاف الأذان" android:textSize="18sp"
        android:backgroundTint="#D4AF37" android:textColor="#1a3a2a"/>
</LinearLayout>`);
console.log("✅ activity_full_screen_adhan.xml");

// ══ 9. تعديل AndroidManifest.xml ══
let manifest = fs.readFileSync(MANIFEST, "utf8");
const perms = `
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>
    <uses-permission android:name="android.permission.USE_EXACT_ALARM"/>
    <uses-permission android:name="android.permission.WAKE_LOCK"/>
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"/>
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
    <uses-permission android:name="android.permission.VIBRATE"/>
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>`;
if (!manifest.includes("RECEIVE_BOOT_COMPLETED")) {
    manifest = manifest.replace("<application", perms + "\n\n    <application");
}
const components = `
        <receiver android:name=".PrayerAlarmReceiver" android:exported="false">
            <intent-filter><action android:name="com.adhkari.app.PRAYER_ALARM"/></intent-filter>
        </receiver>
        <receiver android:name=".StopAdhanReceiver" android:exported="false"/>
        <receiver android:name=".BootReceiver" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED"/>
                <action android:name="android.intent.action.QUICKBOOT_POWERON"/>
                <action android:name="android.intent.action.LOCKED_BOOT_COMPLETED"/>
            </intent-filter>
        </receiver>
        <service android:name=".AdhanPlaybackService"
            android:foregroundServiceType="mediaPlayback" android:exported="false"/>
        <activity android:name=".FullScreenAdhanActivity"
            android:exported="false" android:showWhenLocked="true"
            android:turnScreenOn="true" android:launchMode="singleInstance"
            android:theme="@style/Theme.AppCompat.DayNight.NoActionBar"/>`;
if (!manifest.includes("PrayerAlarmReceiver")) {
    manifest = manifest.replace("</application>", components + "\n    </application>");
}
fs.writeFileSync(MANIFEST, manifest);
console.log("✅ AndroidManifest.xml");

// ══ 10. تسجيل Package في MainApplication ══
function findFile(dir, name) {
    try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const f of files) {
            const full = path.join(dir, f.name);
            if (f.isDirectory()) { const r = findFile(full, name); if (r) return r; }
            else if (f.name === name) return full;
        }
    } catch(e) {}
    return null;
}
const mainApp = findFile(path.join(APP_SRC, "java"), "MainApplication.kt")
             || findFile(path.join(APP_SRC, "java"), "MainApplication.java");
if (mainApp) {
    let content = fs.readFileSync(mainApp, "utf8");
    if (!content.includes("AdhkariAlarmsPackage")) {
        if (mainApp.endsWith(".kt")) {
            content = "import com.adhkari.app.AdhkariAlarmsPackage\n" + content;
            content = content.replace(
                "PackageList(this).packages",
                "PackageList(this).packages.also { it.add(AdhkariAlarmsPackage()) }"
            );
        } else {
            content = content.replace(
                "new PackageList(this).getPackages()",
                "new PackageList(this).getPackages(); packages.add(new com.adhkari.app.AdhkariAlarmsPackage())"
            );
        }
        fs.writeFileSync(mainApp, content);
        console.log("✅ MainApplication مُعدَّل");
    }
} else {
    console.warn("⚠️  MainApplication غير موجود — سيتم إضافته لاحقاً");
}

console.log("\n🎉 تم حقن كل الكود النيتف بنجاح!");
