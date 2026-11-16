/**
 * Saat dilimi yardımcıları. Sunucu UTC'de çalışsa bile "gün" kavramı
 * restoranın saat dilimine (varsayılan Europe/Istanbul) göre hesaplanır.
 */

/** Verilen andaki tarihi "YYYY-MM-DD" olarak döner (ilgili saat diliminde). */
export function dayKey(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function tzOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const v = Object.fromEntries(parts.map((p) => [p.type, Number(p.value)]));
  const asUTC = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}

/** "YYYY-MM-DD" gününün ilgili saat dilimindeki başlangıç anı (UTC Date). */
export function startOfDayInTz(ymd, timeZone) {
  const [y, m, d] = ymd.split('-').map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  return new Date(utcMidnight - tzOffsetMs(new Date(utcMidnight), timeZone));
}

export function addDays(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
