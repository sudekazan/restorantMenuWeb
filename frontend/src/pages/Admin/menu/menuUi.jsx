import React from 'react';

/** Menü yönetimi ekranında ortak kullanılan sınıflar ve küçük bileşenler. */
export const inputClass =
  'w-full rounded-2xl bg-card border border-line px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none';
export const inputErrorClass = 'border-rose-400 focus:border-rose-500';
export const primaryBtn =
  'px-4 py-2.5 rounded-2xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 inline-flex items-center justify-center gap-2 transition disabled:opacity-60';
export const secondaryBtn =
  'px-4 py-2.5 rounded-2xl text-sm font-semibold text-ink bg-muted hover:bg-line inline-flex items-center justify-center gap-2 transition disabled:opacity-60';
export const iconBtn =
  'w-9 h-9 rounded-xl flex items-center justify-center text-ink-soft hover:text-ink hover:bg-muted transition disabled:opacity-40 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

export function Field({ id, label, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-rose-600">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-ink-faint">{hint}</p>
      )}
    </div>
  );
}

/** Açık/kapalı anahtarı (Staff > ProductAvailability ile aynı görünüm). */
export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-7 rounded-full transition shrink-0 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        checked ? 'bg-emerald-500' : 'bg-ink-faint/50'
      }`}
    >
      <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

/** Virgülle ayrılmış metin <-> dizi */
export function splitList(text) {
  return String(text || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
