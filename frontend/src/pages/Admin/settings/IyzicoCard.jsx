import React, { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { Field, Switch, inputClass, inputErrorClass, primaryBtn } from '../menu/menuUi.jsx';

const KEYS = [
  { key: 'apiKey', label: 'API anahtarı', min: 4 },
  { key: 'secretKey', label: 'Gizli anahtar (secret key)', min: 4 },
  { key: 'subMerchantKey', label: 'Alt üye işyeri anahtarı (isteğe bağlı)', min: 1 },
];

/**
 * İyzico ayarları. Backend anahtarları şifreli saklar ve hiçbir zaman geri döndürmez;
 * bu yüzden alanlar her zaman boş açılır. Boş bırakılan anahtar gönderilmez, mevcut değer korunur.
 * onSubmit(payload) Promise<boolean> döner (başarılıysa true).
 */
export default function IyzicoCard({ enabled, canEdit, onSubmit }) {
  const [on, setOn] = useState(!!enabled);
  const [keys, setKeys] = useState({ apiKey: '', secretKey: '', subMerchantKey: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => setOn(!!enabled), [enabled]);

  const setKey = (key, value) => {
    setKeys((k) => ({ ...k, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    KEYS.forEach(({ key, min }) => {
      const v = keys[key].trim();
      if (v && (v.length < min || v.length > 120)) next[key] = `${min} ile 120 karakter arasında olmalı.`;
    });
    return next;
  };

  const dirty = on !== !!enabled || KEYS.some(({ key }) => keys[key].trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload = {};
    if (on !== !!enabled) payload.enabled = on;
    KEYS.forEach(({ key }) => {
      const v = keys[key].trim();
      if (v) payload[key] = v;
    });

    setBusy(true);
    try {
      const saved = await onSubmit(payload);
      if (saved) setKeys({ apiKey: '', secretKey: '', subMerchantKey: '' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="bg-card border border-line rounded-3xl shadow-sm p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold text-ink">İyzico ile online ödeme</h2>
        <p className="text-sm text-ink-soft">Müşterilerin QR menüden kartla ödeme yapabilmesi için İyzico hesabınızın anahtarları.</p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">İyzico etkin</p>
          <p className="text-xs text-ink-soft">Kapalıyken kartla online ödeme alınmaz.</p>
        </div>
        <Switch checked={on} onChange={setOn} label="İyzico etkin" disabled={!canEdit || busy} />
      </div>

      {canEdit ? (
        <>
          <p className="flex items-start gap-2 text-xs text-ink-soft">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            Kayıtlı anahtarlar güvenlik için gösterilmez. Değiştirmek istemediğiniz alanı boş bırakın; mevcut anahtar korunur.
          </p>
          <div className="space-y-3">
            {KEYS.map(({ key, label }) => (
              <Field key={key} id={`iyzico-${key}`} label={label} error={errors[key]}>
                <input
                  id={`iyzico-${key}`}
                  type="password"
                  value={keys[key]}
                  onChange={(e) => setKey(key, e.target.value)}
                  onBlur={() => setErrors((er) => ({ ...er, [key]: validate()[key] }))}
                  placeholder="Değiştirmek için yeni anahtarı yapıştırın"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={120}
                  aria-invalid={!!errors[key]}
                  aria-describedby={errors[key] ? `iyzico-${key}-error` : undefined}
                  className={`${inputClass} ${errors[key] ? inputErrorClass : ''}`}
                />
              </Field>
            ))}
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={busy || !dirty} className={primaryBtn}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              İyzico Ayarlarını Kaydet
            </button>
          </div>
        </>
      ) : (
        <p className="flex items-start gap-2 text-xs text-ink-soft">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          İyzico anahtarlarını yalnızca işletme yöneticisi görebilir ve değiştirebilir.
        </p>
      )}
    </form>
  );
}
