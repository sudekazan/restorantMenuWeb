/** Masa yönetimi ekranında ortak yardımcılar. */

export const STATUS_META = {
  available: { label: 'Boş', className: 'bg-emerald-100 text-emerald-800' },
  occupied: { label: 'Dolu', className: 'bg-brand-100 text-brand-700' },
  awaiting_payment: { label: 'Ödeme bekliyor', className: 'bg-amber-100 text-amber-800' },
  reserved: { label: 'Rezerve', className: 'bg-sky-100 text-sky-800' },
  inactive: { label: 'Pasif', className: 'bg-muted text-ink-soft' },
};

export const tableTitle = (t) => (t?.name ? `Masa ${t.number} · ${t.name}` : `Masa ${t?.number ?? ''}`);

/** Blob'u tarayıcıda dosya olarak indirir. */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Backend'in yinelenen kayıt (409 DUPLICATE) mesajını anlaşılır hale getirir. */
export function tableErrorMessage(err) {
  if (err?.code === 'DUPLICATE') return 'Bu numarada bir masa zaten var. Başka bir numara seçin.';
  return err?.message || 'Bir sorun oluştu. Lütfen tekrar deneyin.';
}

/** "12" -> 12, geçersizse NaN */
export const toInt = (value) => (String(value).trim() === '' ? NaN : Number(value));
export const isIntBetween = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
