import React from 'react';

/** Özet kartı: etiket, büyük değer, isteğe bağlı açıklama. */
export function StatCard({ label, value, hint }) {
  return (
    <div className="bg-card border border-line rounded-3xl p-4 shadow-sm min-w-0">
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className="mt-1 text-lg sm:text-xl font-extrabold text-ink tabular-nums break-words">{value}</p>
      {hint && <p className="text-xs text-ink-faint mt-0.5">{hint}</p>}
    </div>
  );
}

/**
 * Dikey çubuk grafiği (paket yok, yalnızca div). Çok sütunda yatay kaydırılır.
 * items: [{ key, label, value, title }]
 */
export function ColumnChart({ items = [], formatValue = String, emptyText }) {
  const max = Math.max(0, ...items.map((i) => i.value || 0));
  if (!items.length || max === 0) return <p className="text-sm text-ink-soft py-4 text-center">{emptyText}</p>;

  const peak = items.find((i) => i.value === max);
  // Çok sütun varsa etiketlerin bir kısmı gizlenir ki üst üste binmesin
  const labelEvery = items.length > 16 ? Math.ceil(items.length / 8) : 1;

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-faint">
        En yüksek: <span className="font-semibold text-ink-soft">{peak.label}</span> · {formatValue(max)}
      </p>
      <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
        <ul className="flex items-end gap-1 h-40" style={{ minWidth: `${items.length * 14}px` }}>
          {items.map((item, idx) => {
            const h = item.value > 0 ? Math.max(3, Math.round((item.value / max) * 100)) : 0;
            return (
              <li key={item.key} className="flex-1 min-w-[10px] h-full flex flex-col justify-end items-center gap-1" title={item.title}>
                <span className="sr-only">{item.title}</span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={`w-full rounded-t-md ${item.value === max ? 'bg-brand-600' : 'bg-brand-400/70'}`}
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span className="text-[10px] leading-none text-ink-faint tabular-nums h-3" aria-hidden="true">
                  {idx % labelEvery === 0 ? item.label : ''}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Yatay çubuklu sıralı liste.
 * items: [{ key, label, value, max, right }]
 */
export function BarList({ items = [], emptyText }) {
  if (!items.length) return <p className="text-sm text-ink-soft py-4 text-center">{emptyText}</p>;
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={item.key} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">
              <span className="text-ink-faint tabular-nums mr-1.5">{i + 1}.</span>
              {item.label}
            </span>
            <span className="shrink-0 text-xs sm:text-sm tabular-nums">{item.right}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${item.max ? Math.max(2, Math.round((item.value / item.max) * 100)) : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
