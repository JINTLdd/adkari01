import { CalculationMethod, Coordinates, PrayerTimes, SunnahTimes } from "adhan";

export type PrayerName = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";

export const PRAYER_LABELS_AR: Record<PrayerName, string> = {
  fajr: "الفجر",
  sunrise: "الشروق",
  dhuhr: "الظهر",
  asr: "العصر",
  maghrib: "المغرب",
  isha: "العشاء",
};

export function getPrayerTimes(lat: number, lng: number, date: Date = new Date()) {
  const coords = new Coordinates(lat, lng);
  const params = CalculationMethod.UmmAlQura();
  const pt = new PrayerTimes(coords, date, params);
  const sunnah = new SunnahTimes(pt);
  return {
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
    duha: new Date(pt.sunrise.getTime() + 20 * 60 * 1000),
    lastThirdNight: sunnah.lastThirdOfTheNight,
  };
}

export function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "م" : "ص";
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function getNextPrayer(times: ReturnType<typeof getPrayerTimes>, now: Date = new Date()) {
  const order: PrayerName[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
  for (const p of order) {
    if (times[p] > now) return { name: p, time: times[p] };
  }
  return { name: "fajr" as PrayerName, time: times.fajr };
}

export function minutesUntil(target: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((target.getTime() - now.getTime()) / 60000));
}
