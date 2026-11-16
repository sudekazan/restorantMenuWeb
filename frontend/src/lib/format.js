const trFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Kuruş (int: 24990) -> "249,90 ₺" */
export function formatKurus(kurus = 0, currency = 'TRY') {
  const amount = Number(kurus || 0) / 100;
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '₺';
  return `${trFormatter.format(amount)} ${symbol}`;
}

export const ORDER_STATUS_META = Object.freeze({
  new: {
    label: 'Sipariş Alındı',
    shortLabel: 'Yeni',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
    step: 1,
  },
  preparing: {
    label: 'Mutfakta Hazırlanıyor',
    shortLabel: 'Hazırlanıyor',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    dotClass: 'bg-blue-500',
    step: 2,
  },
  ready: {
    label: 'Servise Hazır',
    shortLabel: 'Hazır',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    dotClass: 'bg-purple-500',
    step: 3,
  },
  delivered: {
    label: 'Masaya Teslim Edildi',
    shortLabel: 'Teslim Edildi',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500',
    step: 4,
  },
  cancelled: {
    label: 'İptal Edildi',
    shortLabel: 'İptal',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    dotClass: 'bg-red-500',
    step: 0,
  },
});

export const CALL_TYPE_LABELS = Object.freeze({
  call_waiter: 'Garson Çağrısı',
  request_bill: 'Hesap İsteği',
  request_cash_payment: 'Nakit / POS Ödeme İsteği',
  other: 'Özel İstek',
});

export function formatTimeTR(dateInput) {
  if (!dateInput) return '';
  return new Date(dateInput).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Kanban kolon sırası (iptal edilenler panoda gösterilmez). */
export const KANBAN_COLUMNS = Object.freeze(['new', 'preparing', 'ready', 'delivered']);

export const TABLE_STATUS_META = Object.freeze({
  available: {
    label: 'Boş',
    cardClass: 'bg-card border-line hover:border-ink-faint/60',
    badgeClass: 'bg-muted text-ink-soft border-line',
    dotClass: 'bg-ink-faint',
  },
  occupied: {
    label: 'Dolu',
    cardClass: 'bg-sky-50 border-sky-200 hover:border-sky-400',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
    dotClass: 'bg-sky-500',
  },
  awaiting_payment: {
    label: 'Ödeme Bekliyor',
    cardClass: 'bg-rose-50 border-rose-300 hover:border-rose-500',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    dotClass: 'bg-rose-500',
  },
  reserved: {
    label: 'Rezerve',
    cardClass: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    dotClass: 'bg-indigo-500',
  },
  inactive: {
    label: 'Kapalı',
    cardClass: 'bg-card/50 border-line opacity-60',
    badgeClass: 'bg-muted text-ink-faint border-line',
    dotClass: 'bg-ink-faint/60',
  },
});

export const PAYMENT_METHOD_LABELS = Object.freeze({
  online_card: 'Online Kart',
  cash: 'Nakit',
  pos_card: 'POS (Kart)',
});

export const PAYMENT_STATE_LABELS = Object.freeze({
  pending: 'Bekliyor',
  success: 'Başarılı',
  failed: 'Başarısız',
  refunded: 'İade Edildi',
  cancelled: 'İptal',
});

export const ROLE_LABELS = Object.freeze({
  super_admin: 'Platform Yöneticisi',
  admin: 'Yönetici',
  manager: 'Müdür',
  waiter: 'Garson',
  kitchen: 'Mutfak',
  cashier: 'Kasa',
});

/** "125,50" | "125.5" | "125" -> 12550 (kuruş). Geçersiz/boş girişte null döner. */
export function parseTlToKurus(input) {
  if (input === undefined || input === null) return null;
  const normalized = String(input).trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!normalized) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** Kuruşu düzenlenebilir TL metnine çevirir: 12550 -> "125,50" */
export function kurusToInput(kurus = 0) {
  return (Number(kurus || 0) / 100).toFixed(2).replace('.', ',');
}

/** Verilen tarihten bu yana geçen süre: "Şimdi", "7 dk", "1 sa 12 dk" */
export function formatElapsed(dateInput, now = Date.now()) {
  if (!dateInput) return '';
  const minutes = Math.max(0, Math.floor((now - new Date(dateInput).getTime()) / 60000));
  if (minutes < 1) return 'Şimdi';
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} sa ${rest} dk` : `${hours} sa`;
}

/** Masa etiketi: "Masa 12" veya "Masa 12 · Bahçe 3" */
export function tableLabel(table) {
  if (!table) return 'Masa';
  const base = table.number != null ? `Masa ${table.number}` : 'Masa';
  return table.name ? `${base} · ${table.name}` : base;
}
