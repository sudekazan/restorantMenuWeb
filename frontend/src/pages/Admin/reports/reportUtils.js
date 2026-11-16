/** Rapor ekranı tarih yardımcıları. Tarihler "YYYY-MM-DD" anahtarı olarak taşınır. */

const pad = (n) => String(n).padStart(2, '0');

/** Tarayıcının yerel saatine göre bugünün anahtarı. */
export function todayKey(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "2026-11-15" + (-6) -> "2026-11-09" (UTC üzerinden, saat dilimi kaymasız). */
export function addDaysKey(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

const keyToDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** "2026-11-15" -> "15 Kas" */
export function formatDayLabel(key) {
  return keyToDate(key).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "15 Kas 2026" veya "9 Kas – 15 Kas 2026" */
export function rangeLabel(from, to) {
  const full = (k) => keyToDate(k).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  if (!from) return '';
  if (!to || from === to) return full(from);
  return `${full(from)} – ${full(to)}`;
}

/** Backend yalnızca tahsilat olan günleri döndürür; aradaki günler 0 ile doldurulur. */
export function fillDaily(daily = [], from, to, maxDays = 370) {
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const out = [];
  for (let key = from, i = 0; key <= to && i < maxDays; key = addDaysKey(key, 1), i += 1) {
    out.push(byDate.get(key) || { date: key, total: 0, online: 0 });
  }
  return out;
}

/** Saatlik seriyi ilk ve son dolu saat arasında boşluksuz hale getirir. */
export function fillHourly(hourly = []) {
  if (!hourly.length) return [];
  const byHour = new Map(hourly.map((h) => [h.hour, h]));
  const hours = hourly.map((h) => h.hour);
  const out = [];
  for (let h = Math.min(...hours); h <= Math.max(...hours); h += 1) {
    out.push(byHour.get(h) || { hour: h, orders: 0, revenue: 0 });
  }
  return out;
}
