import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Platform, Linking, Vibration } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";
import { Magnetometer, DeviceMotion } from "expo-sensors";
import { COLORS } from "@/src/context/ThemeContext";
import { PatternBackground } from "@/src/components/PatternBackground";

// Kaaba coordinates (Makkah)
const KAABA_LAT = 21.4225;
const KAABA_LNG = 39.8262;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Forward azimuth from (lat,lng) to Kaaba, in degrees [0,360). */
function calculateQiblaBearing(lat: number, lng: number): number {
  const phi1 = toRad(lat);
  const phi2 = toRad(KAABA_LAT);
  const deltaLambda = toRad(KAABA_LNG - lng);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  let bearing = toDeg(Math.atan2(y, x));
  bearing = (bearing + 360) % 360;
  return bearing;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Compute the magnetic compass heading from raw magnetometer (x,y) values.
 *  This returns 0° when the device's top points to magnetic north.
 *  Note: this is a magnetic-north heading; magnetic declination is not applied
 *  (the small offset is acceptable for prayer direction guidance and matches
 *  what most consumer "qibla" apps show).
 */
function headingFromMagnetometer(x: number, y: number): number {
  let angle = Math.atan2(y, x);
  let deg = toDeg(angle);
  // Convert so that 0° is "device-top pointing north".
  deg = 90 - deg;
  deg = ((deg % 360) + 360) % 360;
  return deg;
}

/** Returns the shortest signed delta (b - a) in degrees within [-180, 180]. */
function shortestDelta(a: number, b: number): number {
  let d = b - a;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

export default function QiblaScreen() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [qiblaBearing, setQiblaBearing] = useState(0);
  const [heading, setHeading] = useState(0); // continuous "unwrapped" heading for animations
  const [headingDisplay, setHeadingDisplay] = useState(0); // 0..360 for display
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [sensorAvailable, setSensorAvailable] = useState(true);
  const [usingTrueNorth, setUsingTrueNorth] = useState(false);

  // Animated values
  const arrowRotation = useRef(new Animated.Value(0)).current;
  const roseRotation = useRef(new Animated.Value(0)).current;

  // Refs for low-pass filtering & unwrapping
  const filteredHeadingRef = useRef<number | null>(null);
  const continuousHeadingRef = useRef(0); // unwrapped value to feed Animated
  const lastWrappedRef = useRef(0); // last wrapped 0..360 reading
  const wasAlignedRef = useRef(false);

  // Get user location and Qibla bearing
  useEffect(() => {
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setPermissionError("location");
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const lat = loc.coords.latitude;
        const lng = loc.coords.longitude;
        setCoords({ lat, lng });
        setQiblaBearing(calculateQiblaBearing(lat, lng));
      } catch {
        setPermissionError("location");
      }
    })();
  }, []);

  // Subscribe to a compass-fused heading.
  // Strategy: prefer Location.watchHeadingAsync (uses sensor fusion + declination
  // -> trueHeading). Fall back to raw Magnetometer if the API is unavailable.
  useEffect(() => {
    let locSub: Location.LocationSubscription | null = null;
    let magSub: { remove: () => void } | null = null;
    let motionSub: { remove: () => void } | null = null;
    let cancelled = false;

    const applyHeading = (rawDeg: number, isTrue: boolean) => {
      if (cancelled) return;
      if (!isFinite(rawDeg) || rawDeg < 0) return;
      const wrapped = ((rawDeg % 360) + 360) % 360;

      // Low-pass filter to smooth jitter (more smoothing = larger alpha)
      const prev = filteredHeadingRef.current;
      let filtered: number;
      if (prev == null) {
        filtered = wrapped;
      } else {
        // Smooth around the circular axis using shortest delta.
        const delta = shortestDelta(prev, wrapped);
        filtered = (prev + delta * 0.18 + 360) % 360;
      }
      filteredHeadingRef.current = filtered;

      // Build a continuous "unwrapped" heading so Animated never jumps from 359→0.
      const lastWrapped = lastWrappedRef.current;
      const delta = shortestDelta(lastWrapped, filtered);
      continuousHeadingRef.current += delta;
      lastWrappedRef.current = filtered;

      // Update state (rate-limited via animation, not raw setState)
      setHeading(continuousHeadingRef.current);
      setHeadingDisplay(filtered);
      if (isTrue) setUsingTrueNorth(true);
    };

    (async () => {
      // 1) Try Location heading API (uses fused sensors + declination on most devices).
      try {
        locSub = await Location.watchHeadingAsync((h) => {
          const trueH = (h as { trueHeading?: number }).trueHeading;
          const magH = (h as { magHeading?: number }).magHeading;
          const accuracy = (h as { accuracy?: number }).accuracy;
          // Trust true heading when accuracy is 'good enough'
          if (typeof trueH === "number" && trueH >= 0 && (accuracy ?? 2) >= 1) {
            applyHeading(trueH, true);
          } else if (typeof magH === "number" && magH >= 0) {
            applyHeading(magH, false);
          }
        });
      } catch {
        locSub = null;
      }

      // 2) Always attach raw magnetometer as a fallback / supplement.
      try {
        const available = await Magnetometer.isAvailableAsync().catch(() => false);
        if (available) {
          Magnetometer.setUpdateInterval(120);
          magSub = Magnetometer.addListener(({ x, y }) => {
            if (locSub) return; // location heading is sufficient
            const deg = headingFromMagnetometer(x, y);
            applyHeading(deg, false);
          });
        } else if (!locSub) {
          setSensorAvailable(false);
        }
      } catch {
        if (!locSub) setSensorAvailable(false);
      }

      // 3) Bonus: use DeviceMotion to detect device-flat orientation (for hint UI).
      try {
        const ok = await DeviceMotion.isAvailableAsync().catch(() => false);
        if (ok) {
          DeviceMotion.setUpdateInterval(400);
          motionSub = DeviceMotion.addListener(() => {
            // Currently unused — kept here for future "tilt your phone flat" hint.
          });
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
      try {
        locSub?.remove();
      } catch {
        // ignore
      }
      try {
        magSub?.remove();
      } catch {
        // ignore
      }
      try {
        motionSub?.remove();
      } catch {
        // ignore
      }
    };
  }, []);

  // Drive rose & arrow animations from the continuous heading
  useEffect(() => {
    // Rose rotates opposite to phone heading (so N stays at magnetic north on screen).
    Animated.timing(roseRotation, {
      toValue: -heading,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    const arrowTarget = qiblaBearing - heading;
    Animated.timing(arrowRotation, {
      toValue: arrowTarget,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [heading, qiblaBearing, roseRotation, arrowRotation]);

  // Haptic on alignment transition (off → aligned)
  const angleDiff = useMemo(() => {
    const d = Math.abs(((qiblaBearing - headingDisplay) + 540) % 360 - 180);
    return d;
  }, [qiblaBearing, headingDisplay]);
  const isAligned = angleDiff < 6;

  useEffect(() => {
    if (isAligned && !wasAlignedRef.current) {
      wasAlignedRef.current = true;
      try {
        Vibration.vibrate(50);
      } catch {
        // ignore
      }
    } else if (!isAligned && wasAlignedRef.current) {
      wasAlignedRef.current = false;
    }
  }, [isAligned]);

  const dist = coords ? Math.round(distanceKm(coords.lat, coords.lng, KAABA_LAT, KAABA_LNG)) : 0;

  const roseStyle = {
    transform: [
      {
        rotate: roseRotation.interpolate({
          inputRange: [-100000, 100000],
          outputRange: ["-100000deg", "100000deg"],
        }),
      },
    ],
  };
  const arrowStyle = {
    transform: [
      {
        rotate: arrowRotation.interpolate({
          inputRange: [-100000, 100000],
          outputRange: ["-100000deg", "100000deg"],
        }),
      },
    ],
  };

  return (
    <PatternBackground>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <TouchableOpacity testID="qibla-back-btn" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-forward" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.topBarTextWrap}>
            <Text style={styles.topBarTitle}>اتجاه القبلة</Text>
            <Text style={styles.topBarSub}>بوصلة الكعبة المشرفة — بدون إنترنت</Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        {permissionError === "location" ? (
          <View style={styles.errorBox}>
            <Ionicons name="location-outline" size={64} color={COLORS.gold} />
            <Text style={styles.errorTitle}>إذن الموقع مطلوب</Text>
            <Text style={styles.errorText}>لحساب اتجاه القبلة بدقة من موقعك</Text>
            <TouchableOpacity
              style={styles.openBtn}
              onPress={() => Linking.openSettings().catch(() => {})}
            >
              <Text style={styles.openBtnText}>فتح الإعدادات</Text>
            </TouchableOpacity>
          </View>
        ) : !sensorAvailable ? (
          <View style={styles.errorBox}>
            <Ionicons name="compass-outline" size={64} color={COLORS.gold} />
            <Text style={styles.errorTitle}>البوصلة غير متوفرة</Text>
            <Text style={styles.errorText}>
              جهازك لا يحتوي على حساس مغناطيسي. جرب جهازًا آخر أو استخدم بوصلة منفصلة.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.infoRow}>
              <View style={styles.infoChip}>
                <Text style={styles.infoLabel}>اتجاه القبلة</Text>
                <Text style={styles.infoValue}>{Math.round(qiblaBearing)}°</Text>
              </View>
              <View style={styles.infoChip}>
                <Text style={styles.infoLabel}>اتجاه الجهاز</Text>
                <Text style={styles.infoValue}>{Math.round(headingDisplay)}°</Text>
              </View>
              <View style={styles.infoChip}>
                <Text style={styles.infoLabel}>المسافة</Text>
                <Text style={styles.infoValue}>{dist} كم</Text>
              </View>
            </View>

            <View style={styles.compassArea}>
              {/* Outer ring */}
              <View style={styles.outerRing} />

              {/* Compass rose (cardinal directions, rotates opposite to phone heading) */}
              <Animated.View style={[styles.compassRose, roseStyle]}>
                <View style={styles.tickRing} />
                <Text style={[styles.cardinal, styles.cardinalN]}>ش</Text>
                <Text style={[styles.cardinal, styles.cardinalE]}>ق</Text>
                <Text style={[styles.cardinal, styles.cardinalS]}>ج</Text>
                <Text style={[styles.cardinal, styles.cardinalW]}>غ</Text>
                {/* Small degree marks */}
                {Array.from({ length: 12 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.tickMark,
                      { transform: [{ rotate: `${i * 30}deg` }, { translateY: -132 }] },
                    ]}
                  />
                ))}
              </Animated.View>

              {/* Qibla arrow — points to Kaaba relative to current heading */}
              <Animated.View style={[styles.arrow, arrowStyle]}>
                <View
                  style={[
                    styles.arrowHead,
                    { borderBottomColor: isAligned ? "#22C55E" : COLORS.gold },
                  ]}
                />
                <View
                  style={[
                    styles.arrowBody,
                    { backgroundColor: isAligned ? "#22C55E" : COLORS.gold },
                  ]}
                />
              </Animated.View>

              {/* Center medallion with Kaaba */}
              <View
                style={[
                  styles.centerMedallion,
                  isAligned && { borderColor: "#22C55E", shadowColor: "#22C55E" },
                ]}
              >
                <Text style={styles.kaabaEmoji}>🕋</Text>
              </View>
            </View>

            <View style={[styles.statusCard, isAligned && { borderColor: "#22C55E" }]}>
              <Ionicons
                name={isAligned ? "checkmark-circle" : "compass"}
                size={28}
                color={isAligned ? "#22C55E" : COLORS.gold}
              />
              <View style={{ flex: 1, marginHorizontal: 10 }}>
                <Text style={[styles.statusTitle, isAligned && { color: "#22C55E" }]}>
                  {isAligned ? "أنت تواجه القبلة الآن ✓" : "وجّه جهازك حتى يصبح السهم أخضر"}
                </Text>
                <Text style={styles.statusSub}>
                  الانحراف: {Math.round(angleDiff)}°
                  {usingTrueNorth ? " · شمال حقيقي" : " · شمال مغناطيسي"}
                </Text>
              </View>
            </View>

            <Text style={styles.hint}>
              💡 ضع الجهاز أفقياً وابتعد عن المعادن. لمعايرة البوصلة، حرّك الهاتف على شكل رقم 8 في الهواء.
            </Text>
          </>
        )}
      </SafeAreaView>
    </PatternBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  topBarTextWrap: { flex: 1, alignItems: "center" },
  topBarTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  topBarSub: { color: "#CBD5E1", fontSize: 12, marginTop: 2 },
  infoRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginTop: 6, marginBottom: 12 },
  infoChip: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderColor: "rgba(212,175,55,0.35)",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  infoLabel: { color: "#CBD5E1", fontSize: 11 },
  infoValue: { color: COLORS.goldLight, fontSize: 20, fontWeight: "800", marginTop: 2 },
  compassArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  outerRing: {
    width: 310,
    height: 310,
    borderRadius: 155,
    borderColor: "rgba(212,175,55,0.18)",
    borderWidth: 1,
    position: "absolute",
  },
  compassRose: {
    width: 290,
    height: 290,
    borderRadius: 145,
    borderColor: "rgba(212,175,55,0.45)",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
  },
  tickRing: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    borderColor: "rgba(212,175,55,0.18)",
    borderWidth: 1,
  },
  tickMark: {
    position: "absolute",
    width: 2,
    height: 10,
    backgroundColor: "rgba(212,175,55,0.45)",
    top: "50%",
    left: "50%",
    marginLeft: -1,
    marginTop: -5,
  },
  cardinal: {
    position: "absolute",
    color: COLORS.goldLight,
    fontSize: 22,
    fontWeight: "800",
  },
  cardinalN: { top: 6 },
  cardinalE: { left: 6 },
  cardinalS: { bottom: 6 },
  cardinalW: { right: 6 },
  arrow: {
    width: 60,
    height: 240,
    alignItems: "center",
    justifyContent: "flex-start",
    position: "absolute",
  },
  arrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 22,
    borderRightWidth: 22,
    borderBottomWidth: 38,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: COLORS.gold,
  },
  arrowBody: {
    width: 6,
    height: 90,
    backgroundColor: COLORS.gold,
    marginTop: -2,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  centerMedallion: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderColor: COLORS.gold,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.gold,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  kaabaEmoji: { fontSize: 40 },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.32)",
    borderColor: "rgba(212,175,55,0.4)",
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  statusTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", textAlign: Platform.OS === "ios" ? "right" : "auto" },
  statusSub: { color: "#CBD5E1", fontSize: 12, marginTop: 2 },
  hint: { color: "#CBD5E1", fontSize: 12, textAlign: "center", padding: 12 },
  errorBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "700", marginTop: 14 },
  errorText: { color: "#CBD5E1", fontSize: 14, marginTop: 8, textAlign: "center" },
  openBtn: {
    backgroundColor: COLORS.gold,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 20,
  },
  openBtnText: { color: "#1a1a1a", fontSize: 16, fontWeight: "800" },
});
