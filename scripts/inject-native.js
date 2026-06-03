const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'frontend', 'android', 'app', 'src', 'main', 'java', 'com', 'jintl001', 'adhkari');

if (!fs.existsSync(baseDir)) {
  console.error('Android directory not found:', baseDir);
  process.exit(1);
}

const files = {
  'BootReceiver.kt': `package com.jintl001.adhkari

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.app.AlarmManager
import android.app.PendingIntent
import org.json.JSONArray

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == Intent.ACTION_LOCKED_BOOT_COMPLETED) {
            reRegisterAll(context)
        }
    }
    companion object {
        fun reRegisterAll(context: Context) {
            val prefs = context.getSharedPreferences("adhkari_alarms", Context.MODE_PRIVATE)
            val json = prefs.getString("alarms", "[]") ?: "[]"
            val arr = JSONArray(json)
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val id = obj.getString("id")
                val triggerMs = obj.getLong("triggerMs")
                val title = obj.getString("title")
                val body = obj.getString("body")
                val audioUrl = obj.optString("audioUrl", "")
                if (triggerMs > System.currentTimeMillis()) {
                    val i2 = Intent(context, PrayerAlarmReceiver::class.java).apply {
                        action = "com.jintl001.adhkari.PRAYER_ALARM"
                        putExtra("id", id)
                        putExtra("title", title)
                        putExtra("body", body)
                        putExtra("audioUrl", audioUrl)
                    }
                    val pi = PendingIntent.getBroadcast(
                        context, id.hashCode(), i2,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pi)
                }
            }
        }
    }
}`,

  'PrayerAlarmReceiver.kt': `package com.jintl001.adhkari

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

class PrayerAlarmReceiver : BroadcastReceiver() {
    companion object {
        const val CHANNEL_ID = "adhkari_prayer_channel"
    }
    override fun onReceive(context: Context, intent: Intent) {
        createChannel(context)
        val title = intent.getStringExtra("title") ?: "أذكاري"
        val body = intent.getStringExtra("body") ?: ""
        val id = intent.getStringExtra("id") ?: "prayer"
        val audioUrl = intent.getStringExtra("audioUrl") ?: ""
        val svc = Intent(context, AdhanPlaybackService::class.java).apply {
            putExtra("audioUrl", audioUrl)
            putExtra("title", title)
            putExtra("body", body)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(svc)
        } else {
            context.startService(svc)
        }
        val stopIntent = Intent(context, StopAdhanReceiver::class.java)
        val stopPI = PendingIntent.getBroadcast(context, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val openIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val openPI = PendingIntent.getActivity(context, 1, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_silent_mode_off)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openPI)
            .addAction(android.R.drawable.ic_media_pause, "إيقاف", stopPI)
            .setAutoCancel(true)
            .build()
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(id.hashCode(), notification)
    }
    private fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "مواقيت الصلاة والأذكار",
                NotificationManager.IMPORTANCE_HIGH).apply {
                enableVibration(true)
                setBypassDnd(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }
}`,

  'AdhanPlaybackService.kt': `package com.jintl001.adhkari

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.io.File

class AdhanPlaybackService : Service() {
    private var player: MediaPlayer? = null
    companion object {
        const val STOP_ACTION = "com.jintl001.adhkari.STOP_ADHAN"
    }
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == STOP_ACTION) { stopPlayback(); stopSelf(); return START_NOT_STICKY }
        startForeground(101, buildNotification())
        val audioUrl = intent?.getStringExtra("audioUrl") ?: ""
        val audioDir = filesDir.absolutePath + "/adhkari_audio/"
        val fileName = audioUrl.replace(Regex("[^a-zA-Z0-9.]"), "_")
        val audioFile = File(audioDir + fileName)
        try {
            if (audioFile.exists()) {
                player = MediaPlayer().apply {
                    setAudioAttributes(AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build())
                    setDataSource(audioFile.absolutePath)
                    prepare()
                    setOnCompletionListener { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() }
                    start()
                }
            } else { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() }
        } catch (e: Exception) { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() }
        return START_NOT_STICKY
    }
    private fun stopPlayback() {
        player?.apply { if (isPlaying) stop(); release() }
        player = null
        stopForeground(STOP_FOREGROUND_REMOVE)
    }
    private fun buildNotification() = run {
        val channelId = "adhkari_playback"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(channelId, "تشغيل الأذان", NotificationManager.IMPORTANCE_LOW)
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
        }
        val stopPI = android.app.PendingIntent.getBroadcast(this, 0,
            Intent(this, StopAdhanReceiver::class.java),
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE)
        NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_lock_silent_mode_off)
            .setContentTitle("أذكاري").setContentText("جاري تشغيل الأذان...")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(android.R.drawable.ic_media_pause, "إيقاف", stopPI).build()
    }
    override fun onDestroy() { stopPlayback(); super.onDestroy() }
}`,

  'StopAdhanReceiver.kt': `package com.jintl001.adhkari

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class StopAdhanReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        context.startService(Intent(context, AdhanPlaybackService::class.java).apply {
            action = AdhanPlaybackService.STOP_ACTION
        })
    }
}`,

  'AdhkariAlarmsModule.kt': `package com.jintl001.adhkari

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*
import org.json.JSONArray
import org.json.JSONObject

class AdhkariAlarmsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "AdhkariAlarms"
    private fun getAlarmManager() = reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    private fun buildPI(id: String, title: String, body: String, audioUrl: String) =
        PendingIntent.getBroadcast(reactApplicationContext, id.hashCode(),
            Intent(reactApplicationContext, PrayerAlarmReceiver::class.java).apply {
                action = "com.jintl001.adhkari.PRAYER_ALARM"
                putExtra("id", id); putExtra("title", title)
                putExtra("body", body); putExtra("audioUrl", audioUrl)
            }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    @ReactMethod
    fun scheduleAlarm(id: String, triggerMs: Double, title: String, body: String, audioUrl: String) {
        val am = getAlarmManager(); val t = triggerMs.toLong()
        if (t <= System.currentTimeMillis()) return
        val pi = buildPI(id, title, body, audioUrl)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (am.canScheduleExactAlarms()) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi)
            else am.set(AlarmManager.RTC_WAKEUP, t, pi)
        } else am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi)
        saveAlarm(id, t, title, body, audioUrl)
    }
    @ReactMethod
    fun cancelAlarm(id: String) {
        getAlarmManager().cancel(PendingIntent.getBroadcast(reactApplicationContext, id.hashCode(),
            Intent(reactApplicationContext, PrayerAlarmReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        removeAlarm(id)
    }
    @ReactMethod
    fun cancelAllAlarms() {
        val prefs = reactApplicationContext.getSharedPreferences("adhkari_alarms", Context.MODE_PRIVATE)
        val arr = JSONArray(prefs.getString("alarms", "[]") ?: "[]")
        for (i in 0 until arr.length()) cancelAlarm(arr.getJSONObject(i).getString("id"))
        prefs.edit().putString("alarms", "[]").apply()
    }
    private fun saveAlarm(id: String, t: Long, title: String, body: String, audioUrl: String) {
        val prefs = reactApplicationContext.getSharedPreferences("adhkari_alarms", Context.MODE_PRIVATE)
        val arr = JSONArray(prefs.getString("alarms", "[]") ?: "[]")
        arr.put(JSONObject().apply { put("id",id); put("triggerMs",t); put("title",title); put("body",body); put("audioUrl",audioUrl) })
        prefs.edit().putString("alarms", arr.toString()).apply()
    }
    private fun removeAlarm(id: String) {
        val prefs = reactApplicationContext.getSharedPreferences("adhkari_alarms", Context.MODE_PRIVATE)
        val arr = JSONArray(prefs.getString("alarms", "[]") ?: "[]")
        val newArr = JSONArray()
        for (i in 0 until arr.length()) { val o = arr.getJSONObject(i); if (o.getString("id") != id) newArr.put(o) }
        prefs.edit().putString("alarms", newArr.toString()).apply()
    }
}`,

  'AdhkariAlarmsPackage.kt': `package com.jintl001.adhkari

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AdhkariAlarmsPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(AdhkariAlarmsModule(reactContext))
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}`
};

for (const [filename, content] of Object.entries(files)) {
  const filePath = path.join(baseDir, filename);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Written:', filename);
}

// Fix MainApplication.kt
const mainAppPath = path.join(baseDir, 'MainApplication.kt');
let mainApp = fs.readFileSync(mainAppPath, 'utf8');
if (!mainApp.includes('AdhkariAlarmsPackage')) {
  mainApp = mainApp.replace(
    '// add(MyReactNativePackage())',
    '// add(MyReactNativePackage())\n              add(AdhkariAlarmsPackage())'
  );
  fs.writeFileSync(mainAppPath, mainApp, 'utf8');
  console.log('Updated: MainApplication.kt');
}

// Fix AndroidManifest.xml
const manifestPath = path.join(__dirname, '..', 'frontend', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('PrayerAlarmReceiver')) {
  manifest = manifest.replace('</application>', `    <receiver android:name=".PrayerAlarmReceiver" android:exported="false"/>
    <receiver android:name=".StopAdhanReceiver" android:exported="false"/>
    <receiver android:name=".BootReceiver" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED"/>
        <action android:name="android.intent.action.QUICKBOOT_POWERON"/>
        <action android:name="android.intent.action.LOCKED_BOOT_COMPLETED"/>
      </intent-filter>
    </receiver>
    <service android:name=".AdhanPlaybackService" android:foregroundServiceType="mediaPlayback" android:exported="false"/>
  </application>`);
  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log('Updated: AndroidManifest.xml');
}

console.log('Done! All native files injected.');
