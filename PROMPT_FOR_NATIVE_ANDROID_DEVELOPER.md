# 🕌 برمبت لمطور Android Native — تطبيق "أذكاري"

> **لُغة:** عربي + كود إنجليزي  
> **الهدف:** جعل إشعارات الأذان والأذكار تعمل **حتى لو كان التطبيق مغلقاً تماماً** (مسحوب من شريط التطبيقات الحديثة) على كل أجهزة Android.

---

## 1) السياق

تطبيق إسلامي عربي اسمه **"أذكاري"** مبني بـ **React Native + Expo SDK 54 (Managed Workflow)**.  
- الواجهات والأذكار والمسبحة والقبلة وخط Amiri **مكتملة بالكامل ولا يجب تغييرها**.  
- يستخدم التطبيق حالياً `expo-notifications` لجدولة إشعارات الصلاة والأذكار.

### 🔴 المشكلة الحقيقية:

عند **إغلاق التطبيق بالكامل** (سحبه من قائمة "Recent Apps") على أجهزة:
- Xiaomi (MIUI), Huawei (EMUI/HarmonyOS), Vivo (FuntouchOS), Oppo (ColorOS), OnePlus (OxygenOS), Samsung (One UI)

→ **الإشعارات لا تظهر ولا يُسمع الأذان** بسبب نظام توفير البطارية في هذه الأجهزة.

`expo-notifications` (JavaScript) **لا يحل المشكلة** لأن النظام يقتل عملية JS عند إغلاق التطبيق.

### ✅ المطلوب منك:

كتابة **كود Android Native (Java/Kotlin)** يستخدم `AlarmManager` + `BroadcastReceiver` + `ForegroundService` + `Full-Screen Intent` لتشغيل الأذان والأذكار **بشكل موثوق 100% حتى مع إغلاق التطبيق**.

---

## 2) خطة العمل المطلوبة (خطوة بخطوة)

### ✦ المرحلة 1 — تحويل المشروع إلى Bare Workflow

```bash
cd frontend
npx expo prebuild --platform android --clean
```

سينشئ مجلد `android/` يحتوي على المشروع الأصلي.

---

### ✦ المرحلة 2 — الأذونات في `AndroidManifest.xml`

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
```

---

### ✦ المرحلة 3 — Native Module Bridge

أنشئ `AdhkariAlarms.java` كـ React Native Module يكشف هذه الدوال إلى JavaScript:

```java
@ReactMethod
public void schedulePrayerAlarm(String prayer, double triggerEpochMs, 
                                 String title, String body, String audioFileName) {
    AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    Intent i = new Intent(context, PrayerAlarmReceiver.class);
    i.setAction("com.adhkari.app.PRAYER_ALARM");
    i.putExtra("prayer", prayer);
    i.putExtra("title", title);
    i.putExtra("body", body);
    i.putExtra("audioFile", audioFileName);
    PendingIntent pi = PendingIntent.getBroadcast(
        context, prayer.hashCode(), i,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, (long) triggerEpochMs, pi);
}

@ReactMethod
public void cancelAlarm(String prayer) { /* الإلغاء عبر PendingIntent مطابق */ }

@ReactMethod
public void cancelAllAlarms() { /* حذف كل المنبهات */ }

@ReactMethod
public void requestExactAlarmPermission(Promise promise) {
    // فتح إعدادات Android 12+ للسماح بـ SCHEDULE_EXACT_ALARM
}

@ReactMethod
public void openBatteryOptimizationSettings() {
    // توجيه المستخدم لإيقاف توفير البطارية للتطبيق
}
```

من جهة JS: استبدل في `src/utils/notifications.ts` كل استدعاءات `Notifications.scheduleNotificationAsync()` للصلاة/الأذكار باستدعاء `AdhkariAlarms.schedulePrayerAlarm(...)`.

---

### ✦ المرحلة 4 — `PrayerAlarmReceiver.java`

هذا هو **العقل** — يستقبل المنبه من النظام ويُشغّل الأذان حتى لو كان التطبيق ميتاً.

```java
public class PrayerAlarmReceiver extends BroadcastReceiver {
    public static final String CHANNEL_ID = "adhkari_prayer_channel";

    @Override
    public void onReceive(Context context, Intent intent) {
        // 1. أنشئ Notification Channel (مرة واحدة)
        createHighImportanceChannel(context);

        // 2. ابدأ Foreground Service لتشغيل الأذان
        Intent svc = new Intent(context, AdhanPlaybackService.class);
        svc.putExtras(intent.getExtras());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(svc);
        } else {
            context.startService(svc);
        }

        // 3. أطلق Full-Screen Activity (تعمل حتى على شاشة القفل)
        Intent full = new Intent(context, FullScreenAdhanActivity.class);
        full.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        full.putExtras(intent.getExtras());

        PendingIntent fullPI = PendingIntent.getActivity(
            context, 1, full,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // 4. زر "إيقاف" داخل الإشعار
        Intent stopIntent = new Intent(context, StopAdhanReceiver.class);
        PendingIntent stopPI = PendingIntent.getBroadcast(
            context, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // 5. الإشعار مع Full-Screen Intent + صورة المسجد
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle(intent.getStringExtra("title"))
            .setContentText(intent.getStringExtra("body"))
            .setStyle(new NotificationCompat.BigPictureStyle()
                .bigPicture(loadMosqueBitmap(context, intent.getStringExtra("prayer"))))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullPI, true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(R.drawable.ic_stop, "إيقاف الأذان", stopPI)
            .setAutoCancel(true);

        NotificationManager nm = (NotificationManager) 
            context.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(intent.getStringExtra("prayer").hashCode(), builder.build());
    }
}
```

---

### ✦ المرحلة 5 — `AdhanPlaybackService.java` (Foreground Service)

```java
public class AdhanPlaybackService extends Service {
    private MediaPlayer player;
    public static final String STOP_ACTION = "com.adhkari.app.STOP_ADHAN";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP_ACTION.equals(intent.getAction())) {
            stopPlayback(); stopSelf();
            return START_NOT_STICKY;
        }

        // إجباري: يجب استدعاء startForeground خلال 5 ثوانٍ
        startForeground(101, buildForegroundNotification(intent));

        String audioFile = intent.getStringExtra("audioFile"); // مثلاً "adhan_madinah"
        int resId = getResources().getIdentifier(audioFile, "raw", getPackageName());

        try {
            player = MediaPlayer.create(this, resId);
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            player.setOnCompletionListener(mp -> {
                stopForeground(STOP_FOREGROUND_REMOVE);
                stopSelf();
            });
            player.start();
        } catch (Exception e) {
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        }
        return START_NOT_STICKY;
    }
}
```

سجّله في `AndroidManifest.xml`:
```xml
<service
    android:name=".AdhanPlaybackService"
    android:foregroundServiceType="mediaPlayback"
    android:exported="false"/>
```

---

### ✦ المرحلة 6 — `FullScreenAdhanActivity.java`

شاشة منبثقة فوق شاشة القفل تعرض صورة المسجد + اسم الصلاة + زر "إيقاف".

```java
@Override
protected void onCreate(@Nullable Bundle s) {
    super.onCreate(s);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        setShowWhenLocked(true);
        setTurnScreenOn(true);
        KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        km.requestDismissKeyguard(this, null);
    } else {
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        );
    }
    setContentView(R.layout.activity_full_screen_adhan);
    // ... عرض صورة المسجد المناسبة للصلاة + النص العربي + زر الإيقاف
}
```

تسجيل في AndroidManifest:
```xml
<activity
    android:name=".FullScreenAdhanActivity"
    android:exported="false"
    android:showOnLockScreen="true"
    android:showWhenLocked="true"
    android:turnScreenOn="true"
    android:launchMode="singleInstance"
    android:theme="@style/Theme.AppCompat.DayNight.NoActionBar"/>
```

---

### ✦ المرحلة 7 — `BootReceiver.java` (إعادة جدولة بعد إعادة التشغيل)

```java
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String a = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a)
            || "android.intent.action.QUICKBOOT_POWERON".equals(a)
            || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(a)) {
            // اقرأ المواقيت المحفوظة من SharedPreferences
            // وأعد جدولة كل المنبهات
            ScheduleStore.reRegisterAll(context);
        }
    }
}
```

تخزن كل عملية جدولة من JS الميقاتَ في SharedPreferences، و`ScheduleStore.reRegisterAll()` يقرأها بعد reboot.

---

### ✦ المرحلة 8 — تضمين الأصوات والصور

**ضع ملفات MP3 في** `android/app/src/main/res/raw/`:
- `adhan_madinah.mp3`, `adhan_makkah.mp3`, `adhan_kuwait.mp3` … (٨ مؤذنين)
- `adhkari_morning.mp3`, `adhkari_evening.mp3`, `adhkari_sleep.mp3`, `adhkari_wakeup.mp3`

**ضع صور المساجد في** `android/app/src/main/res/drawable-xxhdpi/`:
- `mosque_fajr.jpg`, `mosque_dhuhr.jpg`, `mosque_asr.jpg`, `mosque_maghrib.jpg`, `mosque_isha.jpg`

(الصور موجودة في الأصل على روابط `customer-assets.emergentagent.com` — حمّلها وضعها محلياً).

---

### ✦ المرحلة 9 — دليل المستخدم لإعدادات OEM

عند أول تشغيل، أو من شاشة الإعدادات، اعرض حواراً عربياً يشرح للمستخدم كيف يفعّل:

| الجهاز | المسار |
|---|---|
| **Xiaomi MIUI** | الإعدادات → التطبيقات → أذكاري → التشغيل التلقائي ✓ + توفير البطارية → بدون قيود |
| **Huawei EMUI** | الإعدادات → التطبيقات → أذكاري → البطارية → إدارة يدوية (الكل ✓) |
| **Samsung One UI** | الإعدادات → البطارية → التطبيقات الخاملة → احذف أذكاري |
| **Vivo / Oppo** | الإعدادات → البطارية → استهلاك خلفية مرتفع → اسمح |
| **OnePlus** | الإعدادات → البطارية → تحسين البطارية → أذكاري → لا تُحسّن |

استخدم Intent مباشر لفتح كل صفحة:
```java
Intent intent = new Intent();
intent.setComponent(new ComponentName(
    "com.miui.securitycenter",
    "com.miui.permcenter.autostart.AutoStartManagementActivity"));
startActivity(intent);
```

---

### ✦ المرحلة 10 — اختبار

اختبر على **أجهزة حقيقية** (المحاكي لا يُظهر مشاكل OEM):

✓ Pixel (Android 14)  
✓ Samsung One UI 6+  
✓ Xiaomi MIUI 14+  
✓ Huawei EMUI 13+ / HarmonyOS  
✓ Vivo FuntouchOS  
✓ Oppo ColorOS

**سيناريو الاختبار لكل جهاز:**
1. اضبط ميقات صلاة بعد دقيقة من الآن.
2. اسحب التطبيق من شريط Recent Apps.
3. **اقفل الشاشة**.
4. انتظر دقيقة → يجب أن:
   - تنطلق الشاشة وتظهر صورة المسجد فوق شاشة القفل.
   - يبدأ صوت الأذان.
   - يظهر إشعار مع زر "إيقاف".

---

### ✦ المرحلة 11 — بناء الـ APK / AAB

```bash
cd android
./gradlew bundleRelease       # ← للنشر على Google Play (.aab)
./gradlew assembleRelease     # ← للتوزيع المباشر (.apk)
```

وقّعه بـ keystore حالي أو أنشئ جديداً وحدّث Play Console.

---

## 3) ما **يجب الحفاظ عليه** (لا تغيّره):

- ✅ كل شاشات React Native (الواجهات، الألوان، النصوص العربية)
- ✅ خط Amiri ودمج الخطوط
- ✅ شاشة القبلة (تستخدم `expo-location` + `expo-sensors` — تعمل بالفعل)
- ✅ المسبحة والثيم النهاري/الليلي
- ✅ ملفات البيانات: `src/data/morningAdhkar.ts`, `otherAdhkar.ts`, `extraAdhkar.ts`, `floatingDuas.ts`
- ✅ تحميل الصوتيات للوضع غير المتصل (`expo-file-system`)
- ✅ مكتبة `adhan` لحساب مواقيت الصلاة (Um al-Qura)

**التغيير الوحيد المطلوب في JavaScript:**  
في `src/utils/notifications.ts`، استبدل استدعاءات `Notifications.scheduleNotificationAsync()` للصلاة/الأذكار/الدعاء بـ `NativeModules.AdhkariAlarms.schedulePrayerAlarm(...)`. اترك إشعارات الصوم/القرآن (غير الحرجة) كما هي على `expo-notifications`.

---

## 4) التقدير والتسليم

| البند | الجهد |
|---|---|
| إعدادات + Manifest | 1 ساعة |
| Native Module + 4 Java classes + Activity واحدة | 6–9 ساعات |
| تضمين الصوتيات والصور | 1 ساعة |
| اختبار على مصفوفة OEM | 4 ساعات |
| توقيع وبناء | 1 ساعة |
| **الإجمالي** | **13–16 ساعة** |

### 📦 التسليمات:

1. ملف `app-release.aab` موقّع جاهز للرفع على Google Play.
2. ملف `app-release.apk` للتوزيع المباشر.
3. الكود المحدّث على GitHub (push على فرع `native-android`).
4. ملف README صغير يشرح كيف يجدول JavaScript المنبهات عبر الـ Bridge الجديد.

---

## 5) المرجع الكامل (إنجليزي)

يوجد ملف فني تفصيلي بكل أكواد الـ Java الجاهزة للنسخ على المسار:

```
/app/ANDROID_NATIVE_BRIEF.md
```

ارجع إليه عند تنفيذ كل مرحلة — يحتوي على كل الـ XML والـ Java بنسخة كاملة قابلة للنسخ مباشرة.

---

**شكراً لك. أسأل الله أن يبارك في عملك وأن يجعله صدقة جارية. 🤲**
